export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/auth/check-username?username=foo
 * Public endpoint — checks if a username is available (no auth required).
 */
export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username')?.toLowerCase().trim();

  if (!username || username.length < 3 || username.length > 20 || !/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json({ available: false, error: 'Invalid username' }, { status: 400 });
  }

  try {
    const doc = await adminDb.collection('users').doc(username).get();
    return NextResponse.json({ available: !doc.exists });
  } catch (error: any) {
    console.error('Error checking username:', error?.message || error);
    // Return serverError flag so client can distinguish "taken" from "broken"
    const isInitError = error?.message?.includes('failed to initialize');
    return NextResponse.json(
      { available: null, serverError: true, error: isInitError ? 'Server configuration error' : 'Server error checking username' },
      { status: 500 }
    );
  }
}
