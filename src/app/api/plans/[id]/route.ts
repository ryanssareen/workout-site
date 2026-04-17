/**
 * GET /api/plans/[id]  → plan detail (owner only)
 * PATCH /api/plans/[id] → edit goal (Unit 15 — not implemented in this slice,
 *                         returns 501 as a placeholder).
 *
 * Writes are forbidden to clients via Firestore rules — all mutations go
 * through API routes.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyPlanAccess, isVerifiedUser } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await verifyPlanAccess(request);
  if (!isVerifiedUser(access)) return access;
  const user = access;
  const { id } = await params;

  const planSnap = await adminDb.collection('trainingPlans').doc(id).get();
  if (!planSnap.exists) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }
  const plan = planSnap.data()!;
  if (plan.userId !== user.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({
    plan: {
      id,
      ...plan,
      createdAt: plan.createdAt?.toMillis?.() ?? null,
      updatedAt: plan.updatedAt?.toMillis?.() ?? null,
      completedAt: plan.completedAt?.toMillis?.() ?? null,
      abandonedAt: plan.abandonedAt?.toMillis?.() ?? null,
    },
  });
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Edit goal is part of Unit 15 (deferred). Use abandon + create for now.' },
    { status: 501 },
  );
}
