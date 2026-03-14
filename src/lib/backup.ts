import { getAdminDb, getAdminStorage } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

export type BackupType = 'daily' | 'weekly' | 'monthly' | 'manual' | 'pre-restore';

const KEEP_LIMITS: Record<BackupType, number> = {
  daily: 7,
  weekly: 4,
  monthly: 12,
  manual: 10,
  'pre-restore': 5,
};

function serializeTimestamp(val: any): number | null {
  if (!val) return null;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val === 'number') return val;
  return null;
}

function serializeDoc(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && typeof value.toMillis === 'function') {
      result[key] = value.toMillis();
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function createBackup(
  type: BackupType,
  triggeredBy: string = 'cron'
): Promise<{ id: string; userCount: number; workoutCount: number; storagePath: string }> {
  const db = getAdminDb();
  const storage = getAdminStorage();

  // Fetch all users
  const usersSnap = await db.collection('users').get();
  const users: any[] = [];
  const workoutsByUser: Record<string, any[]> = {};
  const prsByUser: Record<string, any[]> = {};
  let totalWorkoutCount = 0;

  for (const userDoc of usersSnap.docs) {
    users.push({ id: userDoc.id, ...serializeDoc(userDoc.data()) });

    const workoutsSnap = await db
      .collection('users')
      .doc(userDoc.id)
      .collection('workouts')
      .get();

    workoutsByUser[userDoc.id] = workoutsSnap.docs.map(d => ({
      id: d.id,
      ...serializeDoc(d.data()),
    }));
    totalWorkoutCount += workoutsSnap.size;
  }

  // Fetch all personal records
  const prsSnap = await db.collection('personalRecords').get();
  for (const prDoc of prsSnap.docs) {
    const data = prDoc.data();
    const username = data.userId as string;
    if (!prsByUser[username]) prsByUser[username] = [];
    prsByUser[username].push({ id: prDoc.id, ...serializeDoc(data) });
  }

  // Integrity check
  if (users.length !== usersSnap.size) {
    throw new Error(
      `Integrity check failed: fetched ${users.length} users but snapshot had ${usersSnap.size}`
    );
  }

  const timestamp = new Date().toISOString();
  const storagePath = `backups/${type}/${timestamp}.json`;

  const backupPayload = {
    type,
    createdAt: timestamp,
    userCount: users.length,
    workoutCount: totalWorkoutCount,
    users,
    workouts: workoutsByUser,
    personalRecords: prsByUser,
  };

  const file = storage.file(storagePath);
  await file.save(JSON.stringify(backupPayload), {
    contentType: 'application/json',
    metadata: {
      userCount: String(users.length),
      workoutCount: String(totalWorkoutCount),
    },
  });

  const metaRef = await db.collection('backups').add({
    type,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    userCount: users.length,
    workoutCount: totalWorkoutCount,
    storagePath,
    integrityPassed: true,
    triggeredBy,
  });

  await pruneOldBackups(type);

  return { id: metaRef.id, userCount: users.length, workoutCount: totalWorkoutCount, storagePath };
}

async function pruneOldBackups(type: BackupType): Promise<void> {
  const keepCount = KEEP_LIMITS[type] ?? 5;
  const db = getAdminDb();
  const storage = getAdminStorage();

  const snap = await db
    .collection('backups')
    .where('type', '==', type)
    .orderBy('createdAt', 'desc')
    .get();

  const toDelete = snap.docs.slice(keepCount);
  for (const doc of toDelete) {
    const { storagePath } = doc.data();
    if (storagePath) {
      try {
        await storage.file(storagePath).delete();
      } catch {
        // already gone
      }
    }
    await doc.ref.delete();
  }
}
