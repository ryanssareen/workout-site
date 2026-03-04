export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

    // Store userId in cookie to retrieve after OAuth callback
    const cookieStore = await cookies();
    cookieStore.set('strava_oauth_userId', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Store redirect origin so callback knows where to send the user
    const from = request.nextUrl.searchParams.get('from');
    if (from) {
      cookieStore.set('strava_oauth_from', from, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600,
        path: '/',
      });
    }

    // Build Strava OAuth URL
    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'read,activity:read_all');
    authUrl.searchParams.append('approval_prompt', 'auto');

    console.log('🔐 Redirecting to Strava OAuth:', authUrl.toString());

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
