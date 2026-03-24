import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { NextRequest, NextResponse } from 'next/server';

interface VerifiedUser {
  uid: string;
  username: string;
  role: 'coach' | 'athlete' | 'student';
  coachUsername?: string;
}

/**
 * Verify Firebase ID token from Authorization header and resolve user profile.
 * Returns the verified user or a 401 NextResponse.
 */
export async function verifyApiRequest(
  request: NextRequest
): Promise<VerifiedUser | NextResponse> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
  }

  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // Look up username from userMappings
    const mappingDoc = await getAdminDb().collection('userMappings').doc(uid).get();
    if (!mappingDoc.exists) {
      return NextResponse.json({ error: 'User mapping not found' }, { status: 401 });
    }
    const username = mappingDoc.data()?.username;
    if (!username) {
      return NextResponse.json({ error: 'Username not found' }, { status: 401 });
    }

    // Look up user profile for role
    const userDoc = await getAdminDb().collection('users').doc(username).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    const userData = userDoc.data()!;

    return {
      uid,
      username,
      role: userData.role || 'athlete',
      coachUsername: userData.coachUsername,
    };
  } catch (error: any) {
    const code = error?.code || error?.errorInfo?.code || '';
    const message = error?.message || '';
    // Firestore quota/unavailable errors should return 503, not 401
    if (code === 'resource-exhausted' || code === 'unavailable' || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({ error: 'Service temporarily unavailable — quota may be exceeded' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}

/** Type guard: returns true if the result is a verified user (not an error response) */
export function isVerifiedUser(result: VerifiedUser | NextResponse): result is VerifiedUser {
  return 'uid' in result && 'username' in result;
}
