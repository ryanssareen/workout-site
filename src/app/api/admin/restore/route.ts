export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import { BackupPayload } from '@/lib/backup';
import admin from 'firebase-admin';

const BATCH_SIZE = 490;

function toTimestamp(val: any): admin.firestore.Timestamp | undefined {
  if (typeof val === 'number') return admin.firestore.Timestamp.fromMillis(val);
  return undefined;
}

function rehydrateTimestamps(data: Record<string, any>, keys: string[]): Record<string, any> {
  const out = { ...data };
  for (const key of keys) {
    const ts = toTimestamp(out[key]);
    if (ts) out[key] = ts;
  }
  return out;
}

// POST — restore from an uploaded backup JSON
// Body: { data: BackupPayload, username?: string }
//   - If username is provided: restore only that user's data
//   - If not: restore all users + workouts + personal records
export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  let body: { data: BackupPayload; username?: string };
  try {
    body = await request.json();
    if (!body.data?.users || !body.data?.workouts) throw new Error('Invalid backup format');
  } catch (err: any) {
    return NextResponse.json({ error: `Bad request: ${err.message}` }, { status: 400 });
  }

  const { data, username } = body;
  const db = getAdminDb();
  let restoredUsers = 0;
  let restoredWorkouts = 0;

  try {
    // Filter to target user only if specified
    const usersToRestore = username
      ? data.users.filter((u: any) => u.id === username)
      : data.users;

    if (username && usersToRestore.length === 0) {
      return NextResponse.json({ error: `User "${username}" not found in backup` }, { status: 404 });
    }

    // Restore user docs in batches
    for (let i = 0; i < usersToRestore.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const user of usersToRestore.slice(i, i + BATCH_SIZE)) {
        const { id: userId, ...fields } = user;
        const docData = rehydrateTimestamps(fields, ['createdAt', 'updatedAt', 'stravaConnectedAt', 'lastSummaryDate']);
        batch.set(db.collection('users').doc(userId), docData, { merge: true });
        restoredUsers++;
      }
      await batch.commit();
    }

    // Restore workouts
    for (const user of usersToRestore) {
      const workouts: any[] = data.workouts[user.id] ?? [];
      for (let i = 0; i < workouts.length; i += BATCH_SIZE) {
        const batch = db.batch();
        for (const workout of workouts.slice(i, i + BATCH_SIZE)) {
          const { id: workoutId, ...fields } = workout;
          const docData = rehydrateTimestamps(fields, ['date', 'completedAt', 'createdAt', 'updatedAt']);
          batch.set(
            db.collection('users').doc(user.id).collection('workouts').doc(workoutId),
            docData,
            { merge: true }
          );
          restoredWorkouts++;
        }
        await batch.commit();
      }
    }

    // Restore personal records (skip if per-user restore to keep it focused)
    if (!username) {
      const allPrs = Object.values(data.personalRecords ?? {}).flat() as any[];
      for (let i = 0; i < allPrs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        for (const pr of allPrs.slice(i, i + BATCH_SIZE)) {
          const { id: prId, ...fields } = pr;
          batch.set(db.collection('personalRecords').doc(prId), fields, { merge: true });
        }
        await batch.commit();
      }
    }

    await logAdminAction(session.uid, username ? 'user_restore_triggered' : 'restore_triggered', {
      targetUid: username ?? null,
      restoredUsers,
      restoredWorkouts,
      backupCreatedAt: data.createdAt,
    });

    return NextResponse.json({ success: true, restoredUsers, restoredWorkouts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
