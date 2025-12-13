import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Check if user denied access
    if (error || !code) {
      console.log('❌ Strava authorization denied or failed');
      return NextResponse.redirect(
        new URL('/settings?strava=error', request.url)
      );
    }

    // Get userId from cookie
    const cookieStore = await cookies();
    const userId = cookieStore.get('strava_oauth_userId')?.value;
    
    if (!userId) {
      console.error('❌ No userId found in cookie');
      return NextResponse.redirect(
        new URL('/settings?strava=error', request.url)
      );
    }

    console.log('🔐 Exchanging code for tokens...');

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
      console.error('❌ Failed to exchange code for token');
      return NextResponse.redirect(
        new URL('/settings?strava=error', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    
    console.log('✅ Received Strava tokens');

    // Store tokens in Firestore
    await adminDb.collection('users').doc(userId).update({
      stravaConnected: true,
      stravaAccessToken: tokenData.access_token,
      stravaRefreshToken: tokenData.refresh_token,
      stravaTokenExpiresAt: new Date(tokenData.expires_at * 1000),
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

    console.log('✅ Strava tokens saved for user:', userId);

    // Clear the cookie
    cookieStore.delete('strava_oauth_userId');

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/settings?strava=success', request.url)
    );
  } catch (error: any) {
    console.error('❌ Strava callback error:', error);
    return NextResponse.redirect(
      new URL('/settings?strava=error', request.url)
    );
  }
}
