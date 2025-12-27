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
    console.log('🚫 Firebase init skipped - running on server');
    return;
  }

  // Only initialize once
  if (app) {
    console.log('✅ Firebase already initialized');
    return;
  }

  try {
    console.log('🔵 Initializing Firebase on client side...');
    console.log('🔵 Config check:', {
      apiKey: firebaseConfig.apiKey ? '✅ Set' : '❌ Missing',
      authDomain: firebaseConfig.authDomain ? '✅ Set' : '❌ Missing',
      projectId: firebaseConfig.projectId ? '✅ Set' : '❌ Missing',
      storageBucket: firebaseConfig.storageBucket ? '✅ Set' : '❌ Missing',
      messagingSenderId: firebaseConfig.messagingSenderId ? '✅ Set' : '❌ Missing',
      appId: firebaseConfig.appId ? '✅ Set' : '❌ Missing',
    });

    // Check if any required field is missing
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error('Firebase config is missing required fields! Check your environment variables.');
    }

    // Initialize Firebase
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    
    console.log('✅ Firebase initialized successfully!');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    console.error('❌ This usually means environment variables are not set correctly.');
    throw error;
  }
}

// Getters that initialize on first access (client-side only)
export function getAuthInstance(): Auth {
  initializeFirebase();
  if (!auth) {
    console.error('❌ Firebase Auth not initialized!');
    console.error('❌ Environment variables:', {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'MISSING!',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'Set' : 'MISSING!',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Set' : 'MISSING!',
    });
    throw new Error('Firebase Auth not initialized. Check browser console for details.');
  }
  return auth;
}

export function getDbInstance(): Firestore {
  initializeFirebase();
  if (!db) {
    console.error('❌ Firebase Firestore not initialized!');
    throw new Error('Firebase Firestore not initialized. Check browser console for details.');
  }
  return db;
}

export function getStorageInstance(): FirebaseStorage {
  initializeFirebase();
  if (!storage) {
    console.error('❌ Firebase Storage not initialized!');
    throw new Error('Firebase Storage not initialized. Check browser console for details.');
  }
  return storage;
}

export function getAppInstance(): FirebaseApp {
  initializeFirebase();
  if (!app) {
    console.error('❌ Firebase App not initialized!');
    throw new Error('Firebase App not initialized. Check browser console for details.');
  }
  return app;
}

// For backward compatibility - use getters
// These will work but throw errors if accessed during SSR
export { getAuthInstance as auth };
export { getDbInstance as db };
export { getStorageInstance as storage };
export { getAppInstance as default };
