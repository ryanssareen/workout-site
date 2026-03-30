export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, logAdminAction } from '@/lib/admin-auth';

// POST — one-time backfill of workoutCount on all user docs
export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const usersSnap = await db.collection('users').get();
    let updated = 0;

    for (const userDoc of usersSnap.docs) {
      const countSnap = await db
        .collection('users')
        .doc(userDoc.id)
        .collection('workouts')
        .count()
        .get();
      const count = countSnap.data().count;

      await db.collection('users').doc(userDoc.id).update({ workoutCount: count });
      updated++;
    }

    await logAdminAction(session.uid, 'backfill_workout_counts', { updated });

    return NextResponse.json({ success: true, updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
