import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Production: Use base64 encoded service account from environment variable
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')
      );
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Development: Try to use service account file if it exists
      try {
        const serviceAccount = require('../../firebase-service-account.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (fileError) {
        console.warn('Firebase service account file not found. Admin features will not work.');
      }
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
