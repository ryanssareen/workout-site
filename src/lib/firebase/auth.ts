import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { User, UserRole } from '@/types';

export async function createUser(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
  coachId?: string
): Promise<User> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = userCredential.user;
    const userProfile: Omit<User, 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any; } = {
      uid, email, displayName, role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(role === 'student' && coachId ? { coachId } : {}),
    };
    await setDoc(doc(db, 'users', uid), userProfile);
    return userProfile as User;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create user');
  }
}

export async function signIn(email: string, password: string): Promise<FirebaseUser> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to sign in');
  }
}

export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to sign out');
  }
}

export async function getUserProfile(uid: string): Promise<User | null> {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as User;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}
