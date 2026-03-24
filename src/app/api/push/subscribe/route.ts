export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyApiRequest, isVerifiedUser } from '@/lib/api-auth';
import admin from 'firebase-admin';

interface PushSubscriptionPayload {
  username: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

// POST: Save a push subscription for a user
export async function POST(request: NextRequest) {
  try {
    // Verify the caller's identity
    const caller = await verifyApiRequest(request);
    if (!isVerifiedUser(caller)) return caller;

    const body: PushSubscriptionPayload = await request.json();
    const { username, subscription } = body;

    if (!username || !subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json(
        { error: 'Missing username or subscription data' },
        { status: 400 }
      );
    }

    // Verify the caller is subscribing for themselves
    if (caller.username !== username) {
      return NextResponse.json(
        { error: 'Cannot modify push subscriptions for another user' },
        { status: 403 }
      );
    }

    const userRef = adminDb.collection('users').doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const existing: any[] = userData?.pushSubscriptions || [];

    // Deduplicate by endpoint — replace if same endpoint already exists
    const filtered = existing.filter(
      (s: any) => s.endpoint !== subscription.endpoint
    );

    filtered.push({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      createdAt: new Date().toISOString(),
    });

    await userRef.update({ pushSubscriptions: filtered });

    return NextResponse.json({ success: true, count: filtered.length });
  } catch (error: any) {
    console.error('Push subscribe error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a push subscription
export async function DELETE(request: NextRequest) {
  try {
    // Verify the caller's identity
    const caller = await verifyApiRequest(request);
    if (!isVerifiedUser(caller)) return caller;

    const body = await request.json();
    const { username, endpoint } = body;

    if (!username || !endpoint) {
      return NextResponse.json(
        { error: 'Missing username or endpoint' },
        { status: 400 }
      );
    }

    // Verify the caller is unsubscribing for themselves
    if (caller.username !== username) {
      return NextResponse.json(
        { error: 'Cannot modify push subscriptions for another user' },
        { status: 403 }
      );
    }

    const userRef = adminDb.collection('users').doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const existing: any[] = userData?.pushSubscriptions || [];
    const filtered = existing.filter((s: any) => s.endpoint !== endpoint);

    await userRef.update({ pushSubscriptions: filtered });

    return NextResponse.json({ success: true, remaining: filtered.length });
  } catch (error: any) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
