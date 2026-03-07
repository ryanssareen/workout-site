export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { adminResolveUsername } from '@/lib/firebase/adminUserMapping';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://workout-site-hac0.onrender.com';

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const stateRaw = searchParams.get('state');

    // Check if user denied access
    if (error || !code) {
      console.log('❌ Strava authorization denied or no code. error:', error);
      return NextResponse.redirect(
        new URL('/settings?strava=error&reason=denied', baseUrl)
      );
    }

    // Parse state — contains { uid, from } packed by the authorize route
    let uid: string | null = null;
    let from = 'settings';

    if (stateRaw) {
      try {
        const parsed = JSON.parse(stateRaw);
        uid = parsed.uid || null;
        from = parsed.from || 'settings';
      } catch {
        console.error('❌ Failed to parse state param:', stateRaw);
      }
    }

    if (!uid) {
      console.error('❌ No userId found in state param');
      return NextResponse.redirect(
        new URL('/settings?strava=error&reason=no_state', baseUrl)
      );
    }

    // Resolve UID to username for the new schema
    let username: string;
    try {
      username = await adminResolveUsername(uid);
    } catch (e: any) {
      console.error('❌ Failed to resolve username for UID:', uid, e.message);
      const detail = encodeURIComponent(`UID lookup failed: ${e.message?.slice(0, 150) || 'unknown error'}`);
      return NextResponse.redirect(
        new URL(`/settings?strava=error&reason=no_user&detail=${detail}`, baseUrl)
      );
    }

    console.log('🔵 Strava callback: uid:', uid, 'username:', username);

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', tokenResponse.status, errorText);
      return NextResponse.redirect(
        new URL('/settings?strava=error&reason=token_failed', baseUrl)
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Received tokens, athlete ID:', tokenData.athlete?.id);

    // Store tokens in Firestore
    await adminDb.collection('users').doc(username).update({
      stravaConnected: true,
      stravaId: String(tokenData.athlete.id),
      stravaAccessToken: tokenData.access_token,
      stravaRefreshToken: tokenData.refresh_token,
      stravaTokenExpiresAt: tokenData.expires_at,
      stravaAthleteId: tokenData.athlete.id,
      stravaAthlete: {
        id: tokenData.athlete.id,
        username: tokenData.athlete.username,
        firstname: tokenData.athlete.firstname,
        lastname: tokenData.athlete.lastname,
        profile: tokenData.athlete.profile,
      },
      stravaConnectedAt: new Date(),
    });

    console.log('✅ Strava tokens saved for user:', username);

    // Determine redirect destination based on where the flow started
    const redirectPath = from === 'onboarding' ? '/dashboard?strava=connected' : '/settings?strava=connected';

    return NextResponse.redirect(
      new URL(redirectPath, baseUrl)
    );
  } catch (error: any) {
    console.error('❌ Strava callback error:', error.message);
    console.error('❌ Error stack:', error.stack);

    // Pass a sanitized hint to the frontend so the user sees something useful
    const hint = encodeURIComponent(error.message?.slice(0, 120) || 'Unknown error');
    return NextResponse.redirect(
      new URL(`/settings?strava=error&reason=exception&detail=${hint}`, baseUrl)
    );
  }
}
