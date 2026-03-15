export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds

import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin';

type WorkoutEntry = {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
  createdAtMs: number;
};

const STRAVA_MERGE_FIELDS = [
  'actualStats',
  'stravaData',
  'routeData',
  'stravaExtended',
  'laps',
  'splits',
  'splitsMetric',
  'splitsStandard',
  'photos',
  'run',
  'bike',
  'swim',
] as const;

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value === 'object' && value !== null && '_seconds' in value && typeof value._seconds === 'number') {
    return value._seconds * 1000;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function pickCanonicalDoc(stravaId: string, group: WorkoutEntry[]): WorkoutEntry {
  const standaloneId = `strava_${stravaId}`;
  const nonStandalone = group.filter((entry) => entry.id !== standaloneId);
  const firstPool = nonStandalone.length > 0 ? nonStandalone : group;
  const nonStravaSource = firstPool.filter((entry) => entry.data.source !== 'strava');
  const secondPool = nonStravaSource.length > 0 ? nonStravaSource : firstPool;

  return secondPool.sort((a, b) => a.createdAtMs - b.createdAtMs)[0];
}

function getBestFieldValue(group: WorkoutEntry[], field: (typeof STRAVA_MERGE_FIELDS)[number]): unknown {
  for (const entry of group) {
    const value = entry.data[field];
    if (hasValue(value)) return value;
  }
  return undefined;
}

function getBestCompletionTimestamp(group: WorkoutEntry[]): FirebaseFirestore.Timestamp | null {
  const candidates: Array<{ ts: FirebaseFirestore.Timestamp; ms: number }> = [];

  for (const entry of group) {
    const completedAt = entry.data.completedAt;
    if (completedAt?.toDate) {
      const ms = completedAt.toDate().getTime();
      candidates.push({ ts: completedAt, ms });
      continue;
    }

    const dateTs = entry.data.date;
    if (dateTs?.toDate && (entry.data.completed || entry.data.completedBy === 'strava' || entry.data.source === 'strava')) {
      const ms = dateTs.toDate().getTime();
      candidates.push({ ts: dateTs, ms });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.ms - a.ms);
  return candidates[0].ts;
}

function buildMergeUpdate(stravaId: string, canonical: WorkoutEntry, group: WorkoutEntry[]): Record<string, unknown> {
  const update: Record<string, unknown> = {
    stravaActivityId: stravaId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  for (const field of STRAVA_MERGE_FIELDS) {
    if (hasValue(canonical.data[field])) continue;
    const bestValue = getBestFieldValue(group, field);
    if (hasValue(bestValue)) update[field] = bestValue;
  }

  const hasPhotos = group.some((entry) => entry.data.hasStravaPhotos === true);
  if (hasPhotos && canonical.data.hasStravaPhotos !== true) {
    update.hasStravaPhotos = true;
  }

  const detailsFetched = group.some((entry) => entry.data.stravaDetailsFetched === true);
  if (detailsFetched && canonical.data.stravaDetailsFetched !== true) {
    update.stravaDetailsFetched = true;
  }

  const shouldMarkCompleted = group.some(
    (entry) => entry.data.completedBy === 'strava' || entry.data.source === 'strava' || entry.data.completed === true
  );
  if (shouldMarkCompleted) {
    if (canonical.data.completed !== true) update.completed = true;
    if (canonical.data.completedBy !== 'strava') update.completedBy = 'strava';
    if (!canonical.data.completedAt) {
      const bestCompletedAt = getBestCompletionTimestamp(group);
      if (bestCompletedAt) update.completedAt = bestCompletedAt;
    }
  }

  return update;
}

// GET: Reconcile duplicate Strava-linked workouts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const dryRunParam = (searchParams.get('dryRun') || '').toLowerCase();
    const dryRun = dryRunParam === '1' || dryRunParam === 'true' || dryRunParam === 'yes';

    // If email provided, look up user ID
    if (!userId && email) {
      const usersSnapshot = await adminDb
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
      }

      userId = usersSnapshot.docs[0].id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID or email is required' }, { status: 400 });
    }

    // Pull all workouts and group by stravaActivityId so we can keep one canonical doc and merge data into it.
    const workoutsSnapshot = await adminDb
      .collection('users')
      .doc(userId)
      .collection('workouts')
      .get();

    const workoutsByStravaId: Record<string, WorkoutEntry[]> = {};
    for (const doc of workoutsSnapshot.docs) {
      const data = doc.data();
      const stravaId = data.stravaActivityId ? String(data.stravaActivityId) : '';
      if (!stravaId) continue;

      if (!workoutsByStravaId[stravaId]) {
        workoutsByStravaId[stravaId] = [];
      }
      workoutsByStravaId[stravaId].push({
        id: doc.id,
        ref: doc.ref,
        data,
        createdAtMs: toMillis(data.createdAt) || toMillis(data.date),
      });
    }

    let batch = adminDb.batch();
    let batchOps = 0;
    const commitBatch = async () => {
      if (batchOps === 0) return;
      await batch.commit();
      batch = adminDb.batch();
      batchOps = 0;
    };

    const reconciledGroups: Array<{
      stravaActivityId: string;
      keptWorkoutId: string;
      deletedWorkoutIds: string[];
    }> = [];
    let deletedCount = 0;
    let updatedCount = 0;

    for (const [stravaId, group] of Object.entries(workoutsByStravaId)) {
      if (group.length < 2) continue;

      const canonical = pickCanonicalDoc(stravaId, group);
      const toDelete = group.filter((entry) => entry.id !== canonical.id);
      const mergeUpdate = buildMergeUpdate(stravaId, canonical, group);
      const hasMergeUpdates = Object.keys(mergeUpdate).some((key) => key !== 'updatedAt' && key !== 'stravaActivityId');

      reconciledGroups.push({
        stravaActivityId: stravaId,
        keptWorkoutId: canonical.id,
        deletedWorkoutIds: toDelete.map((entry) => entry.id),
      });

      if (dryRun) continue;

      if (hasMergeUpdates || String(canonical.data.stravaActivityId || '') !== stravaId) {
        batch.update(canonical.ref, mergeUpdate);
        batchOps++;
        updatedCount++;
      }

      for (const duplicate of toDelete) {
        batch.delete(duplicate.ref);
        batchOps++;
        deletedCount++;
      }

      if (batchOps >= 450) {
        await commitBatch();
      }
    }

    if (!dryRun) {
      await commitBatch();
    }

    return NextResponse.json({
      success: true,
      dryRun,
      totalWorkouts: workoutsSnapshot.size,
      duplicateGroups: reconciledGroups.length,
      updatedWorkouts: updatedCount,
      deletedWorkouts: deletedCount,
      remainingWorkouts: workoutsSnapshot.size - deletedCount,
      groups: reconciledGroups,
      message: reconciledGroups.length > 0
        ? dryRun
          ? `Dry run: found ${reconciledGroups.length} duplicate Strava groups.`
          : `Reconciled ${reconciledGroups.length} duplicate Strava groups.`
        : 'No duplicate Strava groups found.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to cleanup duplicates';
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
