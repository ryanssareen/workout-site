/**
 * Admin-only endpoint to toggle `user.planBetaEnabled` (Unit 5, R18).
 *
 * Enforces a soft cap of 20 simultaneously-enabled users. Cap is best-effort
 * (not atomic) — at 20-user scale, two admins racing could push 1 over the
 * cap, which is acceptable per the plan's Key Technical Decisions.
 *
 * PATCH body: `{ enabled: boolean }`
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';

const BETA_CAP = 20;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  if (!checkOrigin(request)) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
  }
  const session = await verifyAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uid } = await params;

  let body: { enabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: '`enabled` must be a boolean' }, { status: 400 });
  }
  const enabled = body.enabled;

  // The admin targets by username (the user doc id). Resolve to confirm the
  // doc exists — and to avoid silent writes to non-existent users.
  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: `User not found: ${uid}` }, { status: 404 });
  }
  const user = userSnap.data() ?? {};
  const currentlyEnabled = user.planBetaEnabled === true;

  // Idempotent no-op.
  if (enabled === currentlyEnabled) {
    return NextResponse.json({
      success: true,
      unchanged: true,
      enabled: currentlyEnabled,
      capCount: null,
    });
  }

  // Enforce cap on enable — skip the read when disabling.
  let capCount: number | null = null;
  if (enabled) {
    const countSnap = await adminDb
      .collection('users')
      .where('planBetaEnabled', '==', true)
      .count()
      .get();
    capCount = countSnap.data().count;
    if (capCount >= BETA_CAP) {
      return NextResponse.json(
        {
          error: `Beta cap reached (${capCount}/${BETA_CAP}). Disable a user before enabling another.`,
          capCount,
        },
        { status: 409 },
      );
    }
  }

  await userRef.update({
    planBetaEnabled: enabled,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logAdminAction(session.uid, 'plan_beta_toggled', {
    targetUid: uid,
    enabled,
    capCountAtToggle: capCount,
  });

  return NextResponse.json({
    success: true,
    enabled,
    capCount: capCount === null ? null : capCount + (enabled ? 1 : 0),
  });
}
