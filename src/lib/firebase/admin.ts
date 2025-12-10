import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    console.log('🔵 Initializing Firebase Admin SDK...');
    console.log('🔵 FIREBASE_SERVICE_ACCOUNT exists?', !!process.env.FIREBASE_SERVICE_ACCOUNT);
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('🔵 Decoding base64 service account...');
      // Production: Use base64 encoded service account from environment variable
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
    } else {
      console.log('⚠️ No FIREBASE_SERVICE_ACCOUNT found, trying file...');
      // Development: Try to use service account file if it exists
      try {
        const serviceAccount = require('../../firebase-service-account.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase Admin initialized with file!');
      } catch (fileError) {
        console.error('❌ Firebase service account file not found');
        console.error('❌ Firebase Admin SDK will NOT work!');
      }
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
    console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
  }
} else {
  console.log('ℹ️ Firebase Admin already initialized');
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
