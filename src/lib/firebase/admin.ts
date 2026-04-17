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

function applyFirestoreSettings() {
  // Drop `undefined` values silently instead of throwing on write. The
  // training-plan feature writes optional fields (targetDistance, pace, HR
  // metrics) that are legitimately undefined for fresh plan workouts and
  // strength sessions. `.settings()` must be called before the first
  // Firestore operation on the instance — once any `.collection()` /
  // `.doc()` has happened, this throws "Firestore has already been started".
  // In that case we swallow the error and rely on defensive undefined
  // stripping in callers.
  try {
    admin.firestore().settings({ ignoreUndefinedProperties: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('already been started') && !msg.includes('already been initialized')) {
      console.warn('[admin] Firestore settings warning:', msg);
    }
    // Swallow — callers strip undefined defensively as a fallback.
  }
}

function initializeFirebaseAdmin() {
  if (initialized) return;
  if (admin.apps.length > 0) {
    // App already initialized by another module (or warm lambda). Apply
    // settings anyway — best effort.
    applyFirestoreSettings();
    initialized = true;
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
    });

    applyFirestoreSettings();

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
