export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import { BackupPayload, restoreFromStorage } from '@/lib/backup';
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

async function applyPayload(
  db: admin.firestore.Firestore,
  data: BackupPayload,
  username?: string
): Promise<{ restoredUsers: number; restoredWorkouts: number }> {
  let restoredUsers = 0;
  let restoredWorkouts = 0;

  const usersToRestore = username
    ? data.users.filter((u: any) => u.id === username)
    : data.users;

  if (username && usersToRestore.length === 0) {
    throw new Error(`User "${username}" not found in backup`);
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

  // Restore personal records (skip if per-user restore)
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

  return { restoredUsers, restoredWorkouts };
}

// POST — restore from backup
// Body options:
//   { data: BackupPayload, username?: string }  — restore from uploaded JSON (existing behavior)
//   { fromStorage: true, username?: string }     — restore from latest Storage backup (full + deltas merged)
export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  let body: { data?: BackupPayload; fromStorage?: boolean; username?: string };
  try {
    body = await request.json();
  } catch (err: any) {
    return NextResponse.json({ error: `Bad request: ${err.message}` }, { status: 400 });
  }

  const db = getAdminDb();

  try {
    if (body.fromStorage) {
      // Restore from Firebase Storage (full + deltas merged)
      const { payload, fullBackupId, deltaCount } = await restoreFromStorage();
      const { restoredUsers, restoredWorkouts } = await applyPayload(db, payload, body.username);

      await logAdminAction(session.uid, body.username ? 'user_restore_triggered' : 'restore_triggered', {
        targetUid: body.username ?? null,
        source: 'storage',
        fullBackupId,
        deltaCount,
        restoredUsers,
        restoredWorkouts,
        backupCreatedAt: payload.createdAt,
      });

      return NextResponse.json({
        success: true,
        source: 'storage',
        fullBackupId,
        deltaCount,
        restoredUsers,
        restoredWorkouts,
      });
    }

    // Restore from uploaded JSON (existing behavior)
    if (!body.data?.users || !body.data?.workouts) {
      return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 });
    }

    const { restoredUsers, restoredWorkouts } = await applyPayload(db, body.data, body.username);

    await logAdminAction(session.uid, body.username ? 'user_restore_triggered' : 'restore_triggered', {
      targetUid: body.username ?? null,
      source: 'upload',
      restoredUsers,
      restoredWorkouts,
      backupCreatedAt: body.data.createdAt,
    });

    return NextResponse.json({ success: true, restoredUsers, restoredWorkouts });
  } catch (err: any) {
    const msg = err.message ?? String(err);
    const notFound = msg.includes('not found in backup') || msg.includes('No full backup found');
    return NextResponse.json({ error: msg }, { status: notFound ? 404 : 500 });
  }
}
