import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    strava: {
      clientId: process.env.STRAVA_CLIENT_ID ? 'SET' : 'NOT SET',
      clientSecret: process.env.STRAVA_CLIENT_SECRET ? 'SET' : 'NOT SET',
      redirectUri: process.env.STRAVA_REDIRECT_URI || 'NOT SET',
    },
    timestamp: new Date().toISOString(),
  });
}
