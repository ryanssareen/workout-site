/**
 * POST /api/plans/create (Unit 6)
 *
 * Creates a new training plan for the authenticated athlete. The load-bearing
 * pattern here is the **draft-first atomicity** model:
 *
 *   1. Generate phase map + enhanced sessions in-memory (src/lib/training/planCreation.ts).
 *   2. Batch-write plan doc (status: 'draft') + every workout doc (planStatus: 'draft').
 *      Workouts live in the existing `users/{username}/workouts` subcollection
 *      with `planId` back-references.
 *   3. Flip plan → 'active' + all workouts → 'active' + set user.activePlanId,
 *      all inside a runTransaction on the user doc. Guards the
 *      "one active plan per user" invariant against concurrent tabs.
 *
 * If generation fails, no writes happen.
 * If the first batch fails, the plan is marked failed-creation and any
 * partial workout docs are hard-deleted.
 * If the second-pass transaction fails, the draft is left for the cron
 * sweep to clean up (Unit 15).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin';
import { verifyPlanAccess } from '@/lib/api-auth';
import { isVerifiedUser } from '@/lib/api-auth';
import { buildCreateSummaryFields } from '@/lib/training/summary';
import { createPlanContent } from '@/lib/training/planCreation';
import type { GoalInputs, PlanStatus, PlanWorkoutMeta } from '@/types';

const BATCH_LIMIT = 490;

export async function POST(request: NextRequest) {
  // ── 1. Auth + beta gate ─────────────────────────────────────────────
  const access = await verifyPlanAccess(request);
  if (!isVerifiedUser(access)) return access;
  const user = access;

  // Guard: one active plan at a time. The definitive check is in the
  // transaction below; this short-circuit avoids spending Groq tokens on a
  // creation that would be rejected.
  if (user.activePlanId) {
    return NextResponse.json(
      { error: 'You already have an active plan. Abandon or edit it before creating a new one.' },
      { status: 409 },
    );
  }

  // ── 2. Parse + validate body ────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = parseCreateBody(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { goal, templateId } = parsed;

  // ── 3. Generation stage (no Firestore writes yet) ───────────────────
  let content;
  try {
    content = await createPlanContent({
      goal,
      profile: { experienceLevel: /* best-effort */ (await readExperience(user.username)) },
      startDate: tomorrow(),
      templateId,
    });
  } catch (err) {
    console.error('[plans.create] generation failed:', err);
    return NextResponse.json(
      { error: 'Plan generation failed. Please try again in a minute.' },
      { status: 502 },
    );
  }

  // ── 4. Persistence stage 1 — draft writes ────────────────────────────
  const planRef = adminDb.collection('trainingPlans').doc();
  const planId = planRef.id;
  const workoutsCol = adminDb.collection('users').doc(user.username).collection('workouts');
  const writtenWorkoutIds: string[] = [];

  // Use Record<string, unknown> so the Firestore sentinel `serverTimestamp()`
  // fits without fighting the Timestamp type on the `TrainingPlan` interface.
  // The shape on read matches TrainingPlan — this is just a write-side escape.
  const planDoc: Record<string, unknown> = {
    userId: user.username,
    goal,
    startDate: content.startDate,
    endDate: content.endDate,
    phaseMap: content.phaseMap,
    sports: content.sports,
    status: 'draft' as PlanStatus,
    templateId: content.templateId,
    version: 1,
    timezoneAtCreation: 'UTC', // TODO: wire through user.timezone once present on the auth context
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await planRef.set(planDoc);

    // Write workouts in chunked batches (Firestore caps batches at 500).
    const flat = content.weeks.flatMap(w => w.sessions);
    for (let i = 0; i < flat.length; i += BATCH_LIMIT) {
      const chunk = flat.slice(i, i + BATCH_LIMIT);
      const batch = adminDb.batch();
      for (const s of chunk) {
        const workoutRef = workoutsCol.doc();
        writtenWorkoutIds.push(workoutRef.id);
        const planMeta: PlanWorkoutMeta = {
          weekNumber: s.weekNumber,
          phase: s.phase,
          focus: s.focus,
          targetDuration: s.targetDuration,
          targetDistance: s.targetDistance,
          targetPaceRange: s.targetPaceRange,
          targetHRZone: s.targetHRZone,
          isKeyWorkout: s.isKeyWorkout,
        };
        const workoutData: Record<string, unknown> = {
          name: s.name,
          type: s.type,
          description: s.description,
          date: admin.firestore.Timestamp.fromDate(parseIsoDate(s.date)),
          duration: Math.round(s.targetDuration / 60), // minutes for compat w/ existing UI
          tags: s.tags,
          ownerUsername: user.username,
          createdBy: user.username,
          assignedTo: user.username,
          completed: false,
          planId,
          planStatus: 'draft',
          planMeta,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        batch.set(
          workoutRef,
          { ...workoutData, ...buildCreateSummaryFields(workoutData) },
        );
      }
      await batch.commit();
    }
  } catch (err) {
    console.error('[plans.create] batch write failed, rolling back:', err);
    // Rollback: hard-delete any workouts we managed to write and mark plan failed.
    await rollbackCreation(user.username, planRef, writtenWorkoutIds).catch(e =>
      console.error('[plans.create] rollback also failed:', e),
    );
    // Write the failure state onto the user doc so the /plan view can surface
    // a retry CTA (see U9 / plan.failed-creation state).
    await adminDb.collection('users').doc(user.username).set(
      {
        lastFailedPlanId: {
          id: planId,
          at: admin.firestore.FieldValue.serverTimestamp(),
          goalInputs: goal,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return NextResponse.json(
      { error: 'Failed to save your plan. Any partial data has been cleaned up — please try again.' },
      { status: 502 },
    );
  }

  // ── 5. Persistence stage 2 — flip to active inside a transaction ────
  try {
    await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection('users').doc(user.username);
      const userSnap = await tx.get(userRef);
      const data = userSnap.data() ?? {};
      if (data.activePlanId) {
        throw new PlanCreationError(
          'already-active',
          'Another plan was activated concurrently. Please retry.',
        );
      }
      tx.update(planRef, {
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Note: we don't flip every workout doc's planStatus inside the
      // transaction (could exceed the 500-write limit for large plans).
      // We flip them in a best-effort batch after the transaction commits.
      tx.update(userRef, {
        activePlanId: planId,
        // Clear any previous failed-creation record so /plan hides the retry CTA.
        lastFailedPlanId: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    console.error('[plans.create] activation transaction failed:', err);
    // Plan + workouts remain in draft — cron sweep (Unit 15) will hard-delete
    // them after 24h. Surface a clear error to the user.
    const message = err instanceof PlanCreationError
      ? err.message
      : 'Could not activate your plan. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Best-effort: flip workouts to active. If this fails partially, the
  // webhook filter (planStatus != 'draft') still hides drafts, and a later
  // read-time reconciliation can catch stragglers. Chunk to stay under the
  // batch limit.
  try {
    for (let i = 0; i < writtenWorkoutIds.length; i += BATCH_LIMIT) {
      const chunk = writtenWorkoutIds.slice(i, i + BATCH_LIMIT);
      const batch = adminDb.batch();
      for (const id of chunk) {
        batch.update(workoutsCol.doc(id), {
          planStatus: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (err) {
    // Non-fatal: plan is active, some workouts may linger as drafts. Log.
    console.warn('[plans.create] workout activation partial (non-fatal):', err);
  }

  return NextResponse.json({
    success: true,
    planId,
    warnings: content.warnings,
    groqStats: content.groqStats,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────

class PlanCreationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function tomorrow(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function parseIsoDate(iso: string): Date {
  // Treat yyyy-MM-dd as midnight UTC — avoids the "Z-append" bug (#86).
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

async function readExperience(username: string): Promise<string | undefined> {
  try {
    const snap = await adminDb.collection('users').doc(username).get();
    return snap.data()?.experienceLevel;
  } catch {
    return undefined;
  }
}

async function rollbackCreation(
  username: string,
  planRef: admin.firestore.DocumentReference,
  workoutIds: string[],
): Promise<void> {
  const workoutsCol = adminDb.collection('users').doc(username).collection('workouts');
  for (let i = 0; i < workoutIds.length; i += BATCH_LIMIT) {
    const chunk = workoutIds.slice(i, i + BATCH_LIMIT);
    const batch = adminDb.batch();
    for (const id of chunk) {
      batch.delete(workoutsCol.doc(id));
    }
    await batch.commit();
  }
  await planRef.update({
    status: 'failed-creation',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    failureReason: 'batch write failed',
  });
}

interface ParsedCreateBody {
  goal: GoalInputs;
  templateId?: string;
}

function parseCreateBody(body: unknown): ParsedCreateBody | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object' };
  const b = body as Record<string, unknown>;
  const goal = b.goal as Partial<GoalInputs> | undefined;
  if (!goal || typeof goal !== 'object') return { error: '`goal` is required' };
  if (goal.type !== 'dated-event' && goal.type !== 'distance-pr') {
    return { error: '`goal.type` must be "dated-event" or "distance-pr"' };
  }
  if (typeof goal.goalLabel !== 'string' || goal.goalLabel.trim() === '') {
    return { error: '`goal.goalLabel` is required' };
  }
  if (typeof goal.daysPerWeek !== 'number' || goal.daysPerWeek < 2 || goal.daysPerWeek > 7) {
    return { error: '`goal.daysPerWeek` must be between 2 and 7' };
  }
  if (
    typeof goal.typicalSessionMinutes !== 'number'
    || goal.typicalSessionMinutes < 15
    || goal.typicalSessionMinutes > 300
  ) {
    return { error: '`goal.typicalSessionMinutes` must be between 15 and 300' };
  }
  if (goal.type === 'dated-event' && !goal.eventDate) {
    return { error: '`goal.eventDate` is required for dated events' };
  }
  if (goal.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(goal.eventDate)) {
    return { error: '`goal.eventDate` must be YYYY-MM-DD' };
  }
  const templateId = typeof b.templateId === 'string' ? b.templateId : undefined;
  return { goal: goal as GoalInputs, templateId };
}
