import * as admin from 'firebase-admin';

let initialized = false;

function initializeFirebaseAdmin() {
  if (initialized || admin.apps.length > 0) {
    return;
  }

  try {
    console.log('🔵 Initializing Firebase Admin SDK...');
    console.log('🔵 FIREBASE_SERVICE_ACCOUNT exists?', !!process.env.FIREBASE_SERVICE_ACCOUNT);
    
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable is not set!');
      console.error('❌ Firebase Admin SDK will NOT work!');
      return;
    }

    console.log('🔵 Decoding base64 service account...');
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')
    );
    
    console.log('🔵 Service account decoded successfully!');
    console.log('🔵 Project ID:', serviceAccount.project_id);
    console.log('🔵 Client email:', serviceAccount.client_email);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    console.log('✅ Firebase Admin initialized successfully!');
    initialized = true;
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
    console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Lazy getters that initialize on first access
export const getAdminAuth = () => {
  initializeFirebaseAdmin();
  return admin.auth();
};

export const getAdminDb = () => {
  initializeFirebaseAdmin();
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
