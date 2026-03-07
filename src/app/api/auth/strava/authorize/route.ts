export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = process.env.STRAVA_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'Strava configuration missing' },
        { status: 500 }
      );
    }

    // Get user ID from request (should be passed as query param from frontend)
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Username passed directly from the frontend — avoids Firestore lookup in the callback
    const username = request.nextUrl.searchParams.get('username');
    // Where the user started (onboarding vs settings) — determines redirect after callback
    const from = request.nextUrl.searchParams.get('from') || 'settings';

    // Pack uid + username + from into the OAuth state param — Strava returns it in the callback.
    // Carrying the username here means the callback doesn't need any Firestore reads to resolve it.
    const state = JSON.stringify({ uid: userId, username, from });

    // Build Strava OAuth URL
    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'read,activity:read_all');
    authUrl.searchParams.append('approval_prompt', 'auto');
    authUrl.searchParams.append('state', state);

    console.log('🔐 Redirecting to Strava OAuth, uid:', userId, 'from:', from);

    // Redirect to Strava
    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('❌ Strava authorize error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
