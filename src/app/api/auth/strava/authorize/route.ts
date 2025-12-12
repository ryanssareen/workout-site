import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = process.env.STRAVA_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/strava/callback`;

    if (!clientId) {
      return NextResponse.json({ error: 'Strava is not configured' }, { status: 500 });
    }

    // Build Strava OAuth URL
    const scope = 'read,activity:read_all';
    const stravaAuthUrl = new URL('https://www.strava.com/oauth/authorize');
    stravaAuthUrl.searchParams.set('client_id', clientId);
    stravaAuthUrl.searchParams.set('redirect_uri', redirectUri);
    stravaAuthUrl.searchParams.set('response_type', 'code');
    stravaAuthUrl.searchParams.set('scope', scope);
    stravaAuthUrl.searchParams.set('state', userId); // Pass userId in state for callback

    return NextResponse.redirect(stravaAuthUrl.toString());
  } catch (error: any) {
    console.error('Strava authorize error:', error);
    return NextResponse.json({ error: 'Failed to initiate Strava authorization' }, { status: 500 });
  }
}
