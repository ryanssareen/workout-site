import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

type FirebaseAdminEnvName =
  | 'FIREBASE_PROJECT_ID'
  | 'FIREBASE_CLIENT_EMAIL'
  | 'FIREBASE_PRIVATE_KEY';

let cachedApp: App | null = null;

function getRequiredEnv(name: FirebaseAdminEnvName): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createFirebaseAdminApp(): App {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const projectId = getRequiredEnv('FIREBASE_PROJECT_ID');
  const clientEmail = getRequiredEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = getRequiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });
}

function getFirebaseAdminAppInternal(): App {
  if (!cachedApp) {
    cachedApp = createFirebaseAdminApp();
  }
  return cachedApp;
}

export function getFirebaseAdminApp(): App {
  return getFirebaseAdminAppInternal();
}

export function getFirebaseAdminDb(): Firestore {
  return getFirestore(getFirebaseAdminAppInternal());
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminAppInternal());
}
