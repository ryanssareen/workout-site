import { getAdminDb } from '@/lib/firebase/admin';
import { put, del, list, get } from '@vercel/blob';
import admin from 'firebase-admin';

export type BackupType = 'daily' | 'weekly' | 'monthly' | 'manual' | 'pre-restore';
export type BackupTier = 'full' | 'delta';

const KEEP_LIMITS: Record<string, number> = {
  daily: 7,
  weekly: 4,
  monthly: 6,
  manual: 10,
  'pre-restore': 5,
  full: 6,
};

export interface BackupPayload {
  createdAt: string;
  userCount: number;
  workoutCount: number;
  users: any[];
  workouts: Record<string, any[]>;
  personalRecords: Record<string, any[]>;
}

export interface DeltaPayload {
  createdAt: string;
  basedOnTimestamp: string;
  changedUsers: any[];
  changedWorkouts: Record<string, any[]>;
  changedPRs: Record<string, any[]>;
  changedUserCount: number;
  changedWorkoutCount: number;
}

interface BackupResult {
  id: string;
  tier: BackupTier;
  userCount: number;
  workoutCount: number;
  storagePath: string | null;
}

function serializeDoc(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v === 'object' && typeof v.toMillis === 'function' ? v.toMillis() : v;
  }
  return out;
}

// ─── Legacy: generateBackupData (used by download endpoint) ─────────────────

// WARNING: Full DB read — costs 1 read per user doc + 1 read per workout doc + all PRs.
// This is intentional for backups (need complete snapshot). Only call from
// admin-triggered or cron backup flows, never from user-facing endpoints.
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

  return {
    createdAt: new Date().toISOString(),
    userCount: users.length,
    workoutCount: totalWorkoutCount,
    users,
    workouts: workoutsByUser,
    personalRecords: prsByUser,
  };
}

// ─── Legacy: createBackup (metadata-only, kept for backward compat) ─────────

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
    tier: 'full' as BackupTier,
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

// ─── Storage helpers (Vercel Blob) ──────────────────────────────────────────

async function uploadToStorage(path: string, data: object): Promise<string> {
  const blob = await put(path, JSON.stringify(data), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  return blob.url;
}

async function uploadRawToStorage(path: string, raw: string): Promise<string> {
  const blob = await put(path, raw, {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  return blob.url;
}

async function downloadFromStorage<T>(path: string): Promise<T> {
  // path could be a full Vercel Blob URL or a relative path
  const url = path.startsWith('http') ? path : await getBlobUrl(path);
  const result = await get(url, { access: 'private' });
  if (!result || result.statusCode !== 200) throw new Error(`Blob not found: ${path}`);
  const response = new Response(result.stream);
  return (await response.json()) as T;
}

async function getBlobUrl(path: string): Promise<string> {
  const { blobs } = await list({ prefix: path, limit: 1 });
  if (blobs.length === 0) throw new Error(`Blob not found: ${path}`);
  return blobs[0].url;
}

async function deleteFromStorage(path: string): Promise<void> {
  try {
    if (path.startsWith('http')) {
      await del(path);
    } else {
      const url = await getBlobUrl(path);
      await del(url);
    }
  } catch {
    // Non-fatal — blob may already be gone
  }
}

// ─── Seed Backup (full snapshot to Storage) ─────────────────────────────────

export async function createSeedBackup(
  triggeredBy: string = 'cron'
): Promise<BackupResult> {
  const payload = await generateBackupData();
  const storagePath = `backups/full/${new Date().toISOString()}.json`;

  await uploadToStorage(storagePath, payload);

  const db = getAdminDb();
  const metaRef = await db.collection('backups').add({
    type: 'manual' as BackupType,
    tier: 'full' as BackupTier,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    userCount: payload.userCount,
    workoutCount: payload.workoutCount,
    integrityPassed: payload.userCount > 0,
    triggeredBy,
    storagePath,
  });

  await pruneOldBackups('manual');

  return {
    id: metaRef.id,
    tier: 'full',
    userCount: payload.userCount,
    workoutCount: payload.workoutCount,
    storagePath,
  };
}

// ─── Delta Backup (changed docs only) ───────────────────────────────────────

export async function createDeltaBackup(
  type: 'daily' | 'weekly',
  triggeredBy: string = 'cron'
): Promise<BackupResult> {
  const db = getAdminDb();

  // Find the timestamp to diff from: use the most recent backup's createdAt
  const lastBackupSnap = await db
    .collection('backups')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (lastBackupSnap.empty) {
    // No prior backup exists — create a seed first
    return createSeedBackup(triggeredBy);
  }

  const lastBackupDoc = lastBackupSnap.docs[0];
  const lastCreatedAt = lastBackupDoc.data().createdAt;
  if (!lastCreatedAt || typeof lastCreatedAt.toDate !== 'function') {
    return createSeedBackup(triggeredBy);
  }

  const sinceTimestamp = lastCreatedAt as admin.firestore.Timestamp;
  const sinceDate = sinceTimestamp.toDate();

  // For weekly: go back to the most recent full or weekly backup instead
  if (type === 'weekly') {
    const lastFullSnap = await db
      .collection('backups')
      .where('tier', 'in', ['full'])
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    const lastWeeklySnap = await db
      .collection('backups')
      .where('type', '==', 'weekly')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    // Use the more recent of full or weekly as base
    let weeklyBase: admin.firestore.Timestamp | null = null;
    if (!lastFullSnap.empty) {
      weeklyBase = lastFullSnap.docs[0].data().createdAt;
    }
    if (!lastWeeklySnap.empty) {
      const weeklyTs = lastWeeklySnap.docs[0].data().createdAt;
      if (!weeklyBase || (weeklyTs && weeklyTs.toMillis() > weeklyBase.toMillis())) {
        weeklyBase = weeklyTs;
      }
    }

    // If we found a base, use it; otherwise fall through to sinceTimestamp
    if (weeklyBase && typeof weeklyBase.toDate === 'function') {
      Object.assign(sinceDate, {}); // no-op, use weeklyBase below
      return createDeltaFromTimestamp(type, weeklyBase, triggeredBy);
    }
  }

  return createDeltaFromTimestamp(type, sinceTimestamp, triggeredBy);
}

async function createDeltaFromTimestamp(
  type: 'daily' | 'weekly' | 'manual',
  sinceTimestamp: admin.firestore.Timestamp,
  triggeredBy: string
): Promise<BackupResult> {
  const db = getAdminDb();
  const sinceDate = sinceTimestamp.toDate();

  // Query changed users
  const changedUsersSnap = await db
    .collection('users')
    .where('updatedAt', '>', sinceTimestamp)
    .get();

  const changedUsers = changedUsersSnap.docs.map(d => ({
    id: d.id,
    ...serializeDoc(d.data()),
  }));

  // Query changed workouts via collection group query
  const changedWorkoutsSnap = await db
    .collectionGroup('workouts')
    .where('updatedAt', '>', sinceTimestamp)
    .get();

  const changedWorkouts: Record<string, any[]> = {};
  let changedWorkoutCount = 0;
  for (const doc of changedWorkoutsSnap.docs) {
    const userId = doc.ref.parent.parent?.id;
    if (!userId) continue;
    if (!changedWorkouts[userId]) changedWorkouts[userId] = [];
    changedWorkouts[userId].push({ id: doc.id, ...serializeDoc(doc.data()) });
    changedWorkoutCount++;
  }

  // Query changed PRs
  const changedPRsSnap = await db
    .collection('personalRecords')
    .where('updatedAt', '>', sinceTimestamp)
    .get();

  const changedPRs: Record<string, any[]> = {};
  for (const doc of changedPRsSnap.docs) {
    const data = doc.data();
    const userId = data.userId as string;
    if (!changedPRs[userId]) changedPRs[userId] = [];
    changedPRs[userId].push({ id: doc.id, ...serializeDoc(data) });
  }

  const changedUserCount = changedUsers.length;
  const totalChanged = changedUserCount + changedWorkoutCount + changedPRsSnap.size;

  // If nothing changed, write metadata-only (no Storage upload)
  let storagePath: string | null = null;
  if (totalChanged > 0) {
    const delta: DeltaPayload = {
      createdAt: new Date().toISOString(),
      basedOnTimestamp: sinceDate.toISOString(),
      changedUsers,
      changedWorkouts,
      changedPRs,
      changedUserCount,
      changedWorkoutCount,
    };

    storagePath = `backups/delta/${type}-${new Date().toISOString()}.json`;
    await uploadToStorage(storagePath, delta);
  }

  const metaRef = await db.collection('backups').add({
    type,
    tier: 'delta' as BackupTier,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    userCount: changedUserCount,
    workoutCount: changedWorkoutCount,
    integrityPassed: true,
    triggeredBy,
    storagePath,
    basedOnTimestamp: sinceTimestamp,
  });

  await pruneOldBackups(type);

  return {
    id: metaRef.id,
    tier: 'delta',
    userCount: changedUserCount,
    workoutCount: changedWorkoutCount,
    storagePath,
  };
}

// ─── Compact Full Backup (merge from Storage, zero Firestore data reads) ────

export async function compactFullBackup(
  triggeredBy: string = 'cron'
): Promise<BackupResult> {
  const db = getAdminDb();

  // Find most recent full backup with a storagePath
  const fullSnap = await db
    .collection('backups')
    .where('tier', '==', 'full')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (fullSnap.empty || !fullSnap.docs[0].data().storagePath) {
    // No prior full backup in Storage — need to create a seed
    return createSeedBackup(triggeredBy);
  }

  const fullDoc = fullSnap.docs[0];
  const fullData = fullDoc.data();

  // Download the base full backup
  let basePayload: BackupPayload;
  try {
    basePayload = await downloadFromStorage<BackupPayload>(fullData.storagePath);
  } catch {
    // Storage file missing/corrupt — fall back to seed
    return createSeedBackup(triggeredBy);
  }

  // Find all delta backups since the full backup
  const deltaSnap = await db
    .collection('backups')
    .where('tier', '==', 'delta')
    .where('createdAt', '>', fullData.createdAt)
    .orderBy('createdAt', 'asc')
    .get();

  // Download and merge each delta
  const deltas: DeltaPayload[] = [];
  for (const doc of deltaSnap.docs) {
    const sp = doc.data().storagePath;
    if (!sp) continue; // empty delta, skip
    try {
      const delta = await downloadFromStorage<DeltaPayload>(sp);
      deltas.push(delta);
    } catch {
      // Skip corrupt deltas
      console.warn(`Skipping corrupt delta: ${sp}`);
    }
  }

  // Merge
  const merged = mergeBackups(basePayload, deltas);

  // Integrity check
  if (merged.userCount === 0 && basePayload.userCount > 0) {
    throw new Error('Compaction integrity check failed: merged result has 0 users but base had ' + basePayload.userCount);
  }

  // Upload new full
  const storagePath = `backups/full/${new Date().toISOString()}.json`;
  await uploadToStorage(storagePath, merged);

  const metaRef = await db.collection('backups').add({
    type: 'monthly' as BackupType,
    tier: 'full' as BackupTier,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    userCount: merged.userCount,
    workoutCount: merged.workoutCount,
    integrityPassed: true,
    triggeredBy,
    storagePath,
  });

  // Prune old full backups (keep 6)
  await pruneBackupsByTier('full', KEEP_LIMITS.full);

  return {
    id: metaRef.id,
    tier: 'full',
    userCount: merged.userCount,
    workoutCount: merged.workoutCount,
    storagePath,
  };
}

// ─── Merge Logic ────────────────────────────────────────────────────────────

export function mergeBackups(full: BackupPayload, deltas: DeltaPayload[]): BackupPayload {
  // Index users by id for fast lookup
  const usersMap = new Map<string, any>();
  for (const user of full.users) {
    usersMap.set(user.id, user);
  }

  // Index workouts: userId -> workoutId -> workout
  const workoutsMap = new Map<string, Map<string, any>>();
  for (const [userId, workouts] of Object.entries(full.workouts)) {
    const wMap = new Map<string, any>();
    for (const w of workouts) {
      wMap.set(w.id, w);
    }
    workoutsMap.set(userId, wMap);
  }

  // Index PRs: userId -> prId -> pr
  const prsMap = new Map<string, Map<string, any>>();
  for (const [userId, prs] of Object.entries(full.personalRecords)) {
    const pMap = new Map<string, any>();
    for (const pr of prs) {
      pMap.set(pr.id, pr);
    }
    prsMap.set(userId, pMap);
  }

  // Apply each delta in chronological order
  for (const delta of deltas) {
    for (const user of delta.changedUsers) {
      usersMap.set(user.id, user);
    }

    for (const [userId, workouts] of Object.entries(delta.changedWorkouts)) {
      if (!workoutsMap.has(userId)) workoutsMap.set(userId, new Map());
      const wMap = workoutsMap.get(userId)!;
      for (const w of workouts) {
        wMap.set(w.id, w);
      }
    }

    for (const [userId, prs] of Object.entries(delta.changedPRs)) {
      if (!prsMap.has(userId)) prsMap.set(userId, new Map());
      const pMap = prsMap.get(userId)!;
      for (const pr of prs) {
        pMap.set(pr.id, pr);
      }
    }
  }

  // Convert maps back to arrays/records
  const users = Array.from(usersMap.values());
  const workouts: Record<string, any[]> = {};
  let totalWorkoutCount = 0;
  for (const [userId, wMap] of workoutsMap) {
    workouts[userId] = Array.from(wMap.values());
    totalWorkoutCount += workouts[userId].length;
  }

  const personalRecords: Record<string, any[]> = {};
  for (const [userId, pMap] of prsMap) {
    personalRecords[userId] = Array.from(pMap.values());
  }

  return {
    createdAt: new Date().toISOString(),
    userCount: users.length,
    workoutCount: totalWorkoutCount,
    users,
    workouts,
    personalRecords,
  };
}

// ─── Restore from Storage ───────────────────────────────────────────────────

export async function restoreFromStorage(): Promise<{
  payload: BackupPayload;
  fullBackupId: string;
  deltaCount: number;
}> {
  const db = getAdminDb();

  // Find most recent full backup
  const fullSnap = await db
    .collection('backups')
    .where('tier', '==', 'full')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (fullSnap.empty || !fullSnap.docs[0].data().storagePath) {
    throw new Error('No full backup found in Storage');
  }

  const fullDoc = fullSnap.docs[0];
  const fullData = fullDoc.data();
  const basePayload = await downloadFromStorage<BackupPayload>(fullData.storagePath);

  // Find deltas since the full backup
  const deltaSnap = await db
    .collection('backups')
    .where('tier', '==', 'delta')
    .where('createdAt', '>', fullData.createdAt)
    .orderBy('createdAt', 'asc')
    .get();

  const deltas: DeltaPayload[] = [];
  for (const doc of deltaSnap.docs) {
    const sp = doc.data().storagePath;
    if (!sp) continue;
    try {
      deltas.push(await downloadFromStorage<DeltaPayload>(sp));
    } catch {
      console.warn(`Skipping corrupt delta during restore: ${sp}`);
    }
  }

  const merged = deltas.length > 0 ? mergeBackups(basePayload, deltas) : basePayload;

  return {
    payload: merged,
    fullBackupId: fullDoc.id,
    deltaCount: deltas.length,
  };
}

// ─── Pruning ────────────────────────────────────────────────────────────────

async function pruneOldBackups(type: BackupType | string): Promise<void> {
  const keepCount = KEEP_LIMITS[type] ?? 5;
  const db = getAdminDb();
  const snap = await db
    .collection('backups')
    .where('type', '==', type)
    .orderBy('createdAt', 'desc')
    .get();

  const toDelete = snap.docs.slice(keepCount);
  for (const doc of toDelete) {
    const sp = doc.data().storagePath;
    if (sp) await deleteFromStorage(sp);
    await doc.ref.delete();
  }
}

async function pruneBackupsByTier(tier: BackupTier, keepCount: number): Promise<void> {
  const db = getAdminDb();
  const snap = await db
    .collection('backups')
    .where('tier', '==', tier)
    .orderBy('createdAt', 'desc')
    .get();

  const toDelete = snap.docs.slice(keepCount);
  for (const doc of toDelete) {
    const sp = doc.data().storagePath;
    if (sp) await deleteFromStorage(sp);
    await doc.ref.delete();
  }
}
