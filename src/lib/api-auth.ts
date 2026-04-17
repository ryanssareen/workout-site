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

export interface VerifiedPlanUser extends VerifiedUser {
  planBetaEnabled: boolean;
  activePlanId: string | null;
  lastFailedPlanId: string | null;
}

/**
 * Verify the request AND confirm the user is a beta-enabled athlete eligible
 * to interact with the training plan feature. Returns a rich user object
 * (with activePlanId + lastFailedPlanId) or a 401/403 response.
 *
 * Every `/api/plans/*` route MUST go through this helper — enforcing the
 * beta gate in one place prevents drift between endpoints.
 */
export async function verifyPlanAccess(
  request: NextRequest,
): Promise<VerifiedPlanUser | NextResponse> {
  const result = await verifyApiRequest(request);
  if (!isVerifiedUser(result)) return result;
  if (result.role !== 'athlete') {
    return NextResponse.json(
      { error: 'Training plans are only available to athletes.' },
      { status: 403 },
    );
  }
  // Fetch the user doc a second time to read plan-specific fields. Small
  // cost; happens once per plan API call.
  const userDoc = await getAdminDb().collection('users').doc(result.username).get();
  const data = userDoc.data() ?? {};
  if (data.planBetaEnabled !== true) {
    return NextResponse.json(
      { error: 'Training plans are in private beta. Ask an admin for access.' },
      { status: 403 },
    );
  }
  return {
    ...result,
    planBetaEnabled: true,
    activePlanId: data.activePlanId ?? null,
    lastFailedPlanId: data.lastFailedPlanId?.id ?? null,
  };
}
