export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminDb } from '@/lib/firebase/admin';
import { adminResolveUsername } from '@/lib/firebase/adminUserMapping';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://workout-site-hac0.onrender.com';
  
  try {
    console.log('🔵 Callback started');
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    console.log('🔵 Code exists?', !!code);
    console.log('🔵 Error param?', error);

    // Check if user denied access
    if (error || !code) {
      console.log('❌ Strava authorization denied or no code');
      return NextResponse.redirect(
        new URL('/settings?strava=error&reason=denied', baseUrl)
      );
    }

    // Get userId (UID) from cookie and resolve to username
    const cookieStore = await cookies();
    const uid = cookieStore.get('strava_oauth_userId')?.value;

    console.log('🔵 UID from cookie:', uid);

    if (!uid) {
      console.error('❌ No userId found in cookie');
      return NextResponse.redirect(
        new URL('/settings?strava=error&reason=no_cookie', baseUrl)
      );
    }

    // Resolve UID to username for the new schema
    const username = await adminResolveUsername(uid);
    console.log('🔵 Resolved username:', username);

    console.log('🔐 Exchanging code for tokens...');
    console.log('🔵 Client ID:', process.env.STRAVA_CLIENT_ID);
    console.log('🔵 Client Secret exists?', !!process.env.STRAVA_CLIENT_SECRET);

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

    console.log('🔵 Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorText);
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
    const from = cookieStore.get('strava_oauth_from')?.value;
    const redirectPath = from === 'onboarding' ? '/dashboard?strava=connected' : '/settings?strava=connected';

    // Clear cookies
    cookieStore.delete('strava_oauth_userId');
    cookieStore.delete('strava_oauth_from');

    // Redirect to appropriate page
    return NextResponse.redirect(
      new URL(redirectPath, baseUrl)
    );
  } catch (error: any) {
    console.error('❌ Strava callback error:', error);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.redirect(
      new URL('/settings?strava=error&reason=exception', baseUrl)
    );
  }
}
