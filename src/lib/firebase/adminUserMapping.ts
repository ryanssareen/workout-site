import { getAdminDb } from './admin';

export async function adminGetUsernameFromUid(uid: string): Promise<string | null> {
  const db = getAdminDb();
  const mappingDoc = await db.collection('userMappings').doc(uid).get();
  if (mappingDoc.exists) {
    return mappingDoc.data()?.username || null;
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
