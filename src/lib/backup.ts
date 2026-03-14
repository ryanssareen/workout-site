import { getAdminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

export type BackupType = 'daily' | 'weekly' | 'monthly' | 'manual' | 'pre-restore';

const KEEP_LIMITS: Record<BackupType, number> = {
  daily: 7,
  weekly: 4,
  monthly: 12,
  manual: 10,
  'pre-restore': 5,
};

export interface BackupPayload {
  createdAt: string;
  userCount: number;
  workoutCount: number;
  users: any[];
  workouts: Record<string, any[]>;
  personalRecords: Record<string, any[]>;
}

function serializeDoc(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v === 'object' && typeof v.toMillis === 'function' ? v.toMillis() : v;
  }
  return out;
}

// Fetches all data and returns it — used by the download endpoint
export async function generateBackupData(): Promise<BackupPayload> {
  const db = getAdminDb();

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

  const prsSnap = await db.collection('personalRecords').get();
  for (const prDoc of prsSnap.docs) {
    const data = prDoc.data();
    const username = data.userId as string;
    if (!prsByUser[username]) prsByUser[username] = [];
    prsByUser[username].push({ id: prDoc.id, ...serializeDoc(data) });
  }

  if (users.length !== usersSnap.size) {
    throw new Error(
      `Integrity check failed: fetched ${users.length} users but snapshot had ${usersSnap.size}`
    );
  }

  return {
    createdAt: new Date().toISOString(),
    userCount: users.length,
    workoutCount: totalWorkoutCount,
    users,
    workouts: workoutsByUser,
    personalRecords: prsByUser,
  };
}

// Writes a lightweight metadata-only snapshot to Firestore — no file storage needed
export async function createBackup(
  type: BackupType,
  triggeredBy: string = 'cron'
): Promise<{ id: string; userCount: number; workoutCount: number }> {
  const db = getAdminDb();

  const usersSnap = await db.collection('users').get();
  let totalWorkoutCount = 0;

  for (const userDoc of usersSnap.docs) {
    const countSnap = await db
      .collection('users')
      .doc(userDoc.id)
      .collection('workouts')
      .count()
      .get();
    totalWorkoutCount += countSnap.data().count;
  }

  const userCount = usersSnap.size;

  const metaRef = await db.collection('backups').add({
    type,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    userCount,
    workoutCount: totalWorkoutCount,
    integrityPassed: userCount > 0,
    triggeredBy,
    storageType: 'metadata_only',
  });

  await pruneOldBackups(type);

  return { id: metaRef.id, userCount, workoutCount: totalWorkoutCount };
}

async function pruneOldBackups(type: BackupType): Promise<void> {
  const keepCount = KEEP_LIMITS[type] ?? 5;
  const db = getAdminDb();
  const snap = await db
    .collection('backups')
    .where('type', '==', type)
    .orderBy('createdAt', 'desc')
    .get();

  for (const doc of snap.docs.slice(keepCount)) {
    await doc.ref.delete();
  }
}
