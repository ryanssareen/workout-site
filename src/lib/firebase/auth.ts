import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './config';
import { User, UserRole } from '@/types';

// Generate a unique 6-letter coach code
function generateCoachCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding I and O to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if coach code already exists
async function isCoachCodeUnique(code: string): Promise<boolean> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('coachCode', '==', code));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty;
}

// Generate unique coach code
async function generateUniqueCoachCode(): Promise<string> {
  let code = generateCoachCode();
  let attempts = 0;
  while (!(await isCoachCodeUnique(code)) && attempts < 10) {
    code = generateCoachCode();
    attempts++;
  }
  return code;
}

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
    
    // Generate coach code for coaches (except rsareen@gmail.com)
    let coachCode: string | undefined;
    if (role === 'coach' && email !== 'rsareen@gmail.com') {
      coachCode = await generateUniqueCoachCode();
    }
    
    const userProfile: Omit<User, 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any; } = {
      uid, 
      email, 
      displayName, 
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(role === 'student' && coachId ? { coachId } : {}),
      ...(coachCode ? { coachCode } : {}),
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


// Find coach by coach code
export async function findCoachByCode(coachCode: string): Promise<User | null> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef, 
      where('role', '==', 'coach'),
      where('coachCode', '==', coachCode.toUpperCase())
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const coachDoc = querySnapshot.docs[0];
    return { uid: coachDoc.id, ...coachDoc.data() } as User;
  } catch (error) {
    console.error('Error finding coach by code:', error);
    return null;
  }
}
