import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({
        active: false,
        reason: 'Strava credentials not configured',
      });
    }

    const res = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`
    );

    if (!res.ok) {
      return NextResponse.json({
        active: false,
        reason: 'Failed to check Strava subscription',
      });
    }

    const subscriptions = await res.json();
    const hasActive = Array.isArray(subscriptions) && subscriptions.length > 0;

    return NextResponse.json({
      active: hasActive,
      subscriptions: hasActive ? subscriptions : [],
    });
  } catch (error) {
    console.error('Webhook status check error:', error);
    return NextResponse.json({
      active: false,
      reason: 'Error checking subscription status',
    });
  }
}
