import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy initialization - only runs on client side
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

function initializeFirebase() {
  // CRITICAL: Only initialize on client side
  if (typeof window === 'undefined') {
    return;
  }

  // Only initialize once
  if (app) {
    return;
  }

  // Initialize Firebase
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

// Getters that initialize on first access (client-side only)
export function getAuthInstance(): Auth {
  initializeFirebase();
  if (!auth) {
    throw new Error('Firebase Auth not initialized. Are you on the client side?');
  }
  return auth;
}

export function getDbInstance(): Firestore {
  initializeFirebase();
  if (!db) {
    throw new Error('Firebase Firestore not initialized. Are you on the client side?');
  }
  return db;
}

export function getStorageInstance(): FirebaseStorage {
  initializeFirebase();
  if (!storage) {
    throw new Error('Firebase Storage not initialized. Are you on the client side?');
  }
  return storage;
}

export function getAppInstance(): FirebaseApp {
  initializeFirebase();
  if (!app) {
    throw new Error('Firebase App not initialized. Are you on the client side?');
  }
  return app;
}

// For backward compatibility - use getters
// These will work but throw errors if accessed during SSR
export { getAuthInstance as auth };
export { getDbInstance as db };
export { getStorageInstance as storage };
export { getAppInstance as default };
