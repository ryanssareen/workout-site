import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    strava: {
      clientId: process.env.STRAVA_CLIENT_ID ? 'SET' : 'NOT SET',
      clientSecret: process.env.STRAVA_CLIENT_SECRET ? 'SET' : 'NOT SET',
      redirectUri: process.env.STRAVA_REDIRECT_URI || 'NOT SET',
      webhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ? 'SET' : 'NOT SET',
    },
    app: {
      url: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
      webhookEndpoint: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/strava`
        : 'NOT SET',
    },
    timestamp: new Date().toISOString(),
  });
}
