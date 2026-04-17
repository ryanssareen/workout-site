/**
 * POST /api/plans/[id]/abandon (Unit 15)
 *
 * Owner-only. Marks the plan `abandoned`, clears `user.activePlanId` inside
 * a transaction, and soft-deletes future plan workouts (adds
 * `abandonedByPlan: true`). Past plan workouts stay as historical data.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin';
import { verifyPlanAccess, isVerifiedUser } from '@/lib/api-auth';

const BATCH_LIMIT = 490;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await verifyPlanAccess(request);
  if (!isVerifiedUser(access)) return access;
  const user = access;
  const { id } = await params;

  const planRef = adminDb.collection('trainingPlans').doc(id);
  const planSnap = await planRef.get();
  if (!planSnap.exists) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }
  const plan = planSnap.data()!;
  if (plan.userId !== user.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (plan.status === 'abandoned' || plan.status === 'completed') {
    return NextResponse.json({ success: true, unchanged: true, status: plan.status });
  }

  // Transaction — flip plan + clear activePlanId. The soft-delete of future
  // workouts happens after; if it fails partially it can be retried since
  // the abandoned status is already persisted.
  try {
    await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection('users').doc(user.username);
      tx.update(planRef, {
        status: 'abandoned',
        abandonedAt: admin.firestore.FieldValue.serverTimestamp(),
        version: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.update(userRef, {
        activePlanId: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    console.error('[plans.abandon] transaction failed:', err);
    return NextResponse.json({ error: 'Abandon failed, please retry.' }, { status: 500 });
  }

  // Soft-delete future plan workouts — today and beyond. Past workouts stay
  // for historical analytics.
  try {
    const today = admin.firestore.Timestamp.fromDate(startOfToday());
    const snap = await adminDb
      .collection('users')
      .doc(user.username)
      .collection('workouts')
      .where('planId', '==', id)
      .where('date', '>=', today)
      .get();
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
      const batch = adminDb.batch();
      for (const d of chunk) {
        batch.update(d.ref, {
          abandonedByPlan: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn('[plans.abandon] soft-delete partial (non-fatal):', err);
  }

  return NextResponse.json({ success: true, planId: id });
}

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
