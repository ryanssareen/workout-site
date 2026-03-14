import * as admin from 'firebase-admin';

let initialized = false;

function parseServiceAccount(raw: string): any {
  // Try 1: base64-encoded JSON
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    if (parsed.project_id) return parsed;
  } catch {}

  // Try 2: raw JSON string (not base64 encoded)
  try {
    const parsed = JSON.parse(raw);
    if (parsed.project_id) return parsed;
  } catch {}

  // Try 3: URL-encoded or escaped JSON
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (parsed.project_id) return parsed;
  } catch {}

  throw new Error('Could not parse FIREBASE_SERVICE_ACCOUNT — tried base64, raw JSON, and URL-encoded');
}

function initializeFirebaseAdmin() {
  if (initialized || admin.apps.length > 0) {
    return;
  }

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!raw) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable is not set!');
      return;
    }

    const serviceAccount = parseServiceAccount(raw);
    console.log('🔵 Firebase Admin: project =', serviceAccount.project_id);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

    console.log('✅ Firebase Admin initialized successfully!');
    initialized = true;
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error instanceof Error ? error.message : error);
  }
}

// Lazy getters that initialize on first access
export const getAdminAuth = () => {
  initializeFirebaseAdmin();
  if (!initialized && admin.apps.length === 0) {
    throw new Error('Firebase Admin SDK failed to initialize. Check FIREBASE_SERVICE_ACCOUNT env var.');
  }
  return admin.auth();
};

export const getAdminDb = () => {
  initializeFirebaseAdmin();
  if (!initialized && admin.apps.length === 0) {
    throw new Error('Firebase Admin SDK failed to initialize. Check FIREBASE_SERVICE_ACCOUNT env var.');
  }
  return admin.firestore();
};

export const getAdminStorage = () => {
  initializeFirebaseAdmin();
  if (!initialized && admin.apps.length === 0) {
    throw new Error('Firebase Admin SDK failed to initialize. Check FIREBASE_SERVICE_ACCOUNT env var.');
  }
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error('FIREBASE_STORAGE_BUCKET env var not set.');
  }
  return admin.storage().bucket();
};

// For backward compatibility - these now use getters
export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(target, prop) {
    return (getAdminAuth() as any)[prop];
  }
});

export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(target, prop) {
    return (getAdminDb() as any)[prop];
  }
});
