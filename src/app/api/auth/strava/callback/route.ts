import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is the userId
    const error = searchParams.get('error');

    // Handle user denying access
    if (error) {
      console.error('Strava auth error:', error);
      return NextResponse.redirect(new URL('/settings?strava=error', request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/settings?strava=error', request.url));
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Strava credentials not configured');
      return NextResponse.redirect(new URL('/settings?strava=error', request.url));
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Strava token exchange error:', errorData);
      return NextResponse.redirect(new URL('/settings?strava=error', request.url));
    }

    const tokenData = await tokenResponse.json();

    // Update user document with Strava credentials
    const userRef = adminDb.collection('users').doc(state);
    await userRef.update({
      stravaId: String(tokenData.athlete.id),
      stravaAccessToken: tokenData.access_token,
      stravaRefreshToken: tokenData.refresh_token,
      stravaTokenExpiresAt: tokenData.expires_at,
      stravaConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Redirect to connect-strava page with success
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.redirect(new URL('/connect-strava?strava=connected', baseUrl));
  } catch (error: any) {
    console.error('Strava callback error:', error);
    return NextResponse.redirect(new URL('/connect-strava?strava=error', request.url));
  }
}
