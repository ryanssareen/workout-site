import { getAdminDb } from './admin';

export async function adminGetUsernameFromUid(uid: string): Promise<string | null> {
  const db = getAdminDb();

  // Fast path: check userMappings collection
  const mappingDoc = await db.collection('userMappings').doc(uid).get();
  if (mappingDoc.exists) {
    return mappingDoc.data()?.username || null;
  }

  // Fallback: query users collection by uid field (for accounts created before
  // the userMappings system). If found, backfill the mapping for next time.
  const usersQuery = await db.collection('users').where('uid', '==', uid).limit(1).get();
  if (!usersQuery.empty) {
    const username = usersQuery.docs[0].id;
    // Backfill the mapping so future lookups use the fast path
    await db.collection('userMappings').doc(uid).set({ username }).catch(() => {});
    console.log(`🔵 Backfilled userMapping for UID ${uid} → ${username}`);
    return username;
  }

  return null;
}

export async function adminGetUserByUsername(username: string): Promise<FirebaseFirestore.DocumentData | null> {
  const db = getAdminDb();
  const userDoc = await db.collection('users').doc(username).get();
  if (userDoc.exists) {
    return { username: userDoc.id, ...userDoc.data() };
  }
  return null;
}

export async function adminGetUserDocRef(username: string): Promise<FirebaseFirestore.DocumentReference> {
  return getAdminDb().collection('users').doc(username);
}

/**
 * Resolve a UID to username, throwing if not found.
 * Use at the top of API routes that receive a UID.
 */
export async function adminResolveUsername(uid: string): Promise<string> {
  const username = await adminGetUsernameFromUid(uid);
  if (!username) throw new Error(`No username mapping found for UID: ${uid}`);
  return username;
}
