import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Test endpoint works!',
    env_vars: {
      CLIENT_ID: process.env.STRAVA_CLIENT_ID ? 'EXISTS' : 'MISSING',
      CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET ? 'EXISTS' : 'MISSING',
      REDIRECT_URI: process.env.STRAVA_REDIRECT_URI ? 'EXISTS' : 'MISSING',
    },
    values: {
      CLIENT_ID: process.env.STRAVA_CLIENT_ID,
      REDIRECT_URI: process.env.STRAVA_REDIRECT_URI,
    }
  });
}
