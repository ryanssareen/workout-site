import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getAuthInstance, getDbInstance } from './config';
import { User, UserRole } from '@/types';
import { getUsernameFromUid } from './userMapping';

// Result type for Google Sign-In (may need username selection)
export type GoogleSignInResult =
  | { type: 'existing'; user: User }
  | { type: 'needs_username'; uid: string; email: string; displayName: string; photoURL?: string };

/**
 * Server-side user creation — sends auth token + profile data to API route.
 * The API uses Admin SDK to bypass Firestore security rules, handling:
 * - Existing userMappings from previous failed registrations
 * - Atomic user doc + mapping creation
 * - Username uniqueness validation
 */
async function createUserViaAPI(
  token: string,
  data: {
    username: string;
    email: string;
    displayName: string;
    role?: UserRole;
    photoURL?: string;
    coachUsername?: string;
  }
): Promise<User> {
  const response = await fetch('/api/auth/create-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to create user');
  }

  return result.user as User;
}

export async function createUser(
  email: string,
  password: string,
  displayName: string,
  username: string,
  role: UserRole,
  coachUsername?: string
): Promise<User> {
  try {
    // Step 1: Create Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(getAuthInstance(), email, password);

    // Step 2: Get auth token and create user doc via server API
    const token = await userCredential.user.getIdToken();

    return await createUserViaAPI(token, {
      username,
      email,
      displayName,
      role,
      coachUsername,
    });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create user');
  }
}

/**
 * Create user doc for Google Sign-In users after they pick a username.
 * Uses server API to handle edge cases (existing mappings, retries, etc.)
 */
export async function createGoogleUser(
  uid: string,
  email: string,
  displayName: string,
  username: string,
  photoURL?: string,
): Promise<User> {
  try {
    // Google user is already authenticated — get their token
    const auth = getAuthInstance();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated. Please sign in again.');
    }

    const token = await currentUser.getIdToken();

    return await createUserViaAPI(token, {
      username,
      email,
      displayName,
      photoURL,
    });
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create Google user');
  }
}

export async function signIn(email: string, password: string, rememberMe: boolean = true): Promise<FirebaseUser> {
  try {
    const auth = getAuthInstance();
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to sign in');
  }
}

export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(getAuthInstance());
  } catch (error: any) {
    throw new Error(error.message || 'Failed to sign out');
  }
}

export async function getUserProfile(uid: string): Promise<User | null> {
  try {
    // Look up username from UID mapping
    const username = await getUsernameFromUid(uid);
    if (!username) return null;

    const userDoc = await getDoc(doc(getDbInstance(), 'users', username));
    if (userDoc.exists()) {
      return { username: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(getAuthInstance(), callback);
}

/**
 * Google Sign-In with split flow:
 * - Existing users: returns their profile
 * - New users: returns pending data so they can pick a username
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(getAuthInstance(), provider);
    const { uid, email, displayName, photoURL } = result.user;

    if (!email) {
      throw new Error('Google account does not have an email address');
    }

    // Check if user already has a mapping (existing user)
    const username = await getUsernameFromUid(uid);
    if (username) {
      const profile = await getUserProfile(uid);
      if (profile) {
        return { type: 'existing', user: profile };
      }
    }

    // New user — needs to choose a username
    return {
      type: 'needs_username',
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      photoURL: photoURL || undefined,
    };
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled');
    }
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this site.');
    }
    throw new Error(error.message || 'Failed to sign in with Google');
  }
}
