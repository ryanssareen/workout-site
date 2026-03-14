export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminStorage } from '@/lib/firebase/admin';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import { createBackup } from '@/lib/backup';
import admin from 'firebase-admin';

// GET — fetch backup metadata
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const db = getAdminDb();
    const doc = await db.collection('backups').doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data()?.createdAt?.toMillis?.() ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — full restore from this snapshot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  const { id } = await params;

  try {
    const db = getAdminDb();
    const storage = getAdminStorage();

    // Step 1: pre-restore snapshot of current state
    const preSnapshot = await createBackup('pre-restore', session.uid);
    await logAdminAction(session.uid, 'pre_restore_snapshot', {
      snapshotId: preSnapshot.id,
      restoringFrom: id,
    });

    // Step 2: load the backup metadata
    const metaDoc = await db.collection('backups').doc(id).get();
    if (!metaDoc.exists) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    const meta = metaDoc.data()!;

    // Step 3: download backup JSON from Storage
    const file = storage.file(meta.storagePath);
    const [contents] = await file.download();
    const backup = JSON.parse(contents.toString('utf8'));

    // Step 4: restore users
    let restoredUsers = 0;
    const BATCH_SIZE = 490;

    const userBatches: any[][] = [];
    for (let i = 0; i < backup.users.length; i += BATCH_SIZE) {
      userBatches.push(backup.users.slice(i, i + BATCH_SIZE));
    }

    for (const batch of userBatches) {
      const writeBatch = db.batch();
      for (const user of batch) {
        const { id: userId, ...userData } = user;
        // Convert epoch ms back to Timestamps
        const docData: Record<string, any> = { ...userData };
        for (const key of ['createdAt', 'updatedAt', 'stravaConnectedAt', 'lastSummaryDate']) {
          if (typeof docData[key] === 'number') {
            docData[key] = admin.firestore.Timestamp.fromMillis(docData[key]);
          }
        }
        writeBatch.set(db.collection('users').doc(userId), docData, { merge: true });
        restoredUsers++;
      }
      await writeBatch.commit();
    }

    // Step 5: restore workouts
    let restoredWorkouts = 0;
    for (const [username, workouts] of Object.entries(backup.workouts as Record<string, any[]>)) {
      const chunks: any[][] = [];
      for (let i = 0; i < workouts.length; i += BATCH_SIZE) {
        chunks.push(workouts.slice(i, i + BATCH_SIZE));
      }
      for (const chunk of chunks) {
        const writeBatch = db.batch();
        for (const workout of chunk) {
          const { id: workoutId, ...workoutData } = workout;
          const docData: Record<string, any> = { ...workoutData };
          for (const key of ['date', 'completedAt', 'createdAt', 'updatedAt']) {
            if (typeof docData[key] === 'number') {
              docData[key] = admin.firestore.Timestamp.fromMillis(docData[key]);
            }
          }
          writeBatch.set(
            db.collection('users').doc(username).collection('workouts').doc(workoutId),
            docData,
            { merge: true }
          );
          restoredWorkouts++;
        }
        await writeBatch.commit();
      }
    }

    await logAdminAction(session.uid, 'restore_triggered', {
      backupId: id,
      restoredUsers,
      restoredWorkouts,
    });

    return NextResponse.json({ success: true, restoredUsers, restoredWorkouts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
