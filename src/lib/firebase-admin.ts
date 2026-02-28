import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

interface FirebaseServiceAccount {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
}

let cachedApp: App | null = null;

function getServiceAccountCredential(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawServiceAccount) {
    throw new Error(
      'Missing required environment variable: FIREBASE_SERVICE_ACCOUNT. Set it to your Firebase service account JSON string.'
    );
  }

  let parsedServiceAccount: FirebaseServiceAccount;
  try {
    // Support both raw JSON and base64-encoded JSON
    let jsonString = rawServiceAccount;
    if (!rawServiceAccount.trim().startsWith('{')) {
      jsonString = Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
    }
    const parsed = JSON.parse(jsonString) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT must be a JSON object.');
    }
    parsedServiceAccount = parsed as FirebaseServiceAccount;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT: ${reason}`);
  }

  const projectId =
    parsedServiceAccount.project_id ??
    parsedServiceAccount.projectId ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = parsedServiceAccount.client_email ?? parsedServiceAccount.clientEmail;
  const privateKeyRaw = parsedServiceAccount.private_key ?? parsedServiceAccount.privateKey;

  if (!projectId) {
    throw new Error(
      'Firebase Admin initialization failed: FIREBASE_SERVICE_ACCOUNT is missing project_id/projectId and NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set.'
    );
  }

  if (!clientEmail) {
    throw new Error(
      'Firebase Admin initialization failed: FIREBASE_SERVICE_ACCOUNT is missing client_email/clientEmail.'
    );
  }

  if (!privateKeyRaw) {
    throw new Error(
      'Firebase Admin initialization failed: FIREBASE_SERVICE_ACCOUNT is missing private_key/privateKey.'
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
  };
}

function createFirebaseAdminApp(): App {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const { projectId, clientEmail, privateKey } = getServiceAccountCredential();

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
