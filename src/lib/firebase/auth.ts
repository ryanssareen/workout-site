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
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuthInstance, getDbInstance } from './config';
import { User, UserRole } from '@/types';

export async function createUser(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
  coachId?: string
): Promise<User> {
  try {
    const userCredential = await createUserWithEmailAndPassword(getAuthInstance(), email, password);
    const { uid } = userCredential.user;

    const userProfile: Omit<User, 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any; } = {
      uid,
      email,
      displayName,
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      onboardingCompleted: false,
      ...(coachId ? { coachId } : {}),
    };

    await setDoc(doc(getDbInstance(), 'users', uid), userProfile);
    return userProfile as User;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create user');
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

// Hardcoded coach config — rsareen@gmail.com auto-connects as coach to these athletes
const AUTO_COACH_EMAIL = 'rsareen@gmail.com';
const AUTO_COACH_ATHLETES = [
  'rsareen+hetal@gmail.com',
  'rsareen+rohin@gmail.com',
  'rsareen+rupesh@gmail.com',
];

export async function getUserProfile(uid: string): Promise<User | null> {
  try {
    const docRef = doc(getDbInstance(), 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as User;

      // Auto-promote rsareen@gmail.com to coach
      if (data.email === AUTO_COACH_EMAIL && data.role !== 'coach') {
        await setDoc(docRef, { role: 'coach', updatedAt: serverTimestamp() }, { merge: true });
        return { ...data, role: 'coach' };
      }

      // Auto-assign athletes to their coach
      if (AUTO_COACH_ATHLETES.includes(data.email || '') && !data.coachId) {
        const coachSnap = await getDocs(query(
          collection(getDbInstance(), 'users'),
          where('email', '==', AUTO_COACH_EMAIL),
        ));
        if (!coachSnap.empty) {
          const coachId = coachSnap.docs[0].id;
          await setDoc(docRef, { coachId, role: 'athlete', updatedAt: serverTimestamp() }, { merge: true });
          return { ...data, coachId, role: 'athlete' };
        }
      }

      return data;
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

// Sign in with Google
export async function signInWithGoogle(): Promise<User> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(getAuthInstance(), provider);
    const { uid, email, displayName, photoURL } = result.user;

    if (!email) {
      throw new Error('Google account does not have an email address');
    }

    // Check if user already exists in Firestore
    const existingUser = await getUserProfile(uid);

    if (existingUser) {
      // User exists, just return their profile
      console.log('✅ Existing Google user signed in:', existingUser.displayName);
      return existingUser;
    }

    // New user - create profile
    const isAutoCoach = email === AUTO_COACH_EMAIL;
    const isAutoAthlete = AUTO_COACH_ATHLETES.includes(email);

    // If auto-athlete, find coach uid
    let autoCoachId: string | undefined;
    if (isAutoAthlete) {
      const coachSnap = await getDocs(query(
        collection(getDbInstance(), 'users'),
        where('email', '==', AUTO_COACH_EMAIL),
      ));
      if (!coachSnap.empty) autoCoachId = coachSnap.docs[0].id;
    }

    const userProfile: Omit<User, 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any; photoURL?: string; coachId?: string } = {
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      role: isAutoCoach ? 'coach' : 'athlete',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      onboardingCompleted: false,
      ...(photoURL ? { photoURL } : {}),
      ...(autoCoachId ? { coachId: autoCoachId } : {}),
    };

    await setDoc(doc(getDbInstance(), 'users', uid), userProfile);
    console.log('✅ New Google user created:', userProfile.displayName);

    return userProfile as User;
  } catch (error: any) {
    // Handle specific popup errors
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled');
    }
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this site.');
    }
    throw new Error(error.message || 'Failed to sign in with Google');
  }
}
