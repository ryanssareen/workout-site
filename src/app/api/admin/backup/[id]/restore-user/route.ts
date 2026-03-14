export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminStorage } from '@/lib/firebase/admin';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import admin from 'firebase-admin';

// POST — restore a single user's data from a snapshot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  const { id } = await params;

  let targetUsername: string;
  try {
    const body = await request.json();
    if (!body.username || typeof body.username !== 'string') throw new Error();
    targetUsername = body.username;
  } catch {
    return NextResponse.json({ error: 'Missing username' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const storage = getAdminStorage();

    const metaDoc = await db.collection('backups').doc(id).get();
    if (!metaDoc.exists) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    const meta = metaDoc.data()!;

    const file = storage.file(meta.storagePath);
    const [contents] = await file.download();
    const backup = JSON.parse(contents.toString('utf8'));

    // Find the user in the backup
    const userData = backup.users.find((u: any) => u.id === targetUsername);
    if (!userData) {
      return NextResponse.json({ error: 'User not found in this backup' }, { status: 404 });
    }

    // Restore user doc
    const { id: userId, ...userFields } = userData;
    const userDocData: Record<string, any> = { ...userFields };
    for (const key of ['createdAt', 'updatedAt', 'stravaConnectedAt', 'lastSummaryDate']) {
      if (typeof userDocData[key] === 'number') {
        userDocData[key] = admin.firestore.Timestamp.fromMillis(userDocData[key]);
      }
    }
    await db.collection('users').doc(userId).set(userDocData, { merge: true });

    // Restore workouts
    const workouts: any[] = backup.workouts[targetUsername] ?? [];
    const BATCH_SIZE = 490;
    let restoredWorkouts = 0;

    for (let i = 0; i < workouts.length; i += BATCH_SIZE) {
      const chunk = workouts.slice(i, i + BATCH_SIZE);
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
          db.collection('users').doc(targetUsername).collection('workouts').doc(workoutId),
          docData,
          { merge: true }
        );
        restoredWorkouts++;
      }
      await writeBatch.commit();
    }

    await logAdminAction(session.uid, 'user_restore_triggered', {
      backupId: id,
      targetUid: targetUsername,
      restoredWorkouts,
    });

    return NextResponse.json({ success: true, restoredWorkouts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
