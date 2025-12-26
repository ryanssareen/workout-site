export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// GET: View existing webhook subscriptions
export async function GET() {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Strava not configured' }, { status: 500 });
    }

    const response = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to get subscriptions:', error);
      return NextResponse.json({ error: 'Failed to get subscriptions', details: error }, { status: 500 });
    }

    const subscriptions = await response.json();
    return NextResponse.json({ subscriptions });
  } catch (error: any) {
    console.error('Error getting subscriptions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new webhook subscription
export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Strava credentials not configured' }, { status: 500 });
    }

    if (!verifyToken) {
      return NextResponse.json({ error: 'STRAVA_WEBHOOK_VERIFY_TOKEN not configured' }, { status: 500 });
    }

    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not configured' }, { status: 500 });
    }

    const callbackUrl = `${appUrl}/api/webhooks/strava`;

    console.log('Creating webhook subscription:', { callbackUrl, clientId });

    const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        callback_url: callbackUrl,
        verify_token: verifyToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to create subscription:', data);
      return NextResponse.json({
        error: 'Failed to create subscription',
        details: data,
        hint: data.errors?.[0]?.field === 'callback_url'
          ? 'Make sure your callback URL is publicly accessible and returns the hub.challenge'
          : undefined
      }, { status: 500 });
    }

    console.log('Webhook subscription created:', data);
    return NextResponse.json({
      success: true,
      subscription: data,
      callbackUrl
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a webhook subscription
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('id');

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 });
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Strava not configured' }, { status: 500 });
    }

    const response = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions/${subscriptionId}?client_id=${clientId}&client_secret=${clientSecret}`,
      { method: 'DELETE' }
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.text();
      console.error('Failed to delete subscription:', error);
      return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Subscription deleted' });
  } catch (error: any) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
