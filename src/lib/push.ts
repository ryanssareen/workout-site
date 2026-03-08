import webpush from 'web-push';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

// Configure VAPID details
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:ryansareen6@gmail.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
}

/**
 * Send a push notification to all subscribed devices for a user.
 * Non-blocking — errors are logged but don't throw.
 */
export async function sendPushNotification(
  username: string,
  payload: PushPayload
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('⚠️ VAPID keys not configured — skipping push notification');
    return;
  }

  try {
    const userDoc = await adminDb.collection('users').doc(username).get();
    if (!userDoc.exists) {
      console.warn(`⚠️ Push: user ${username} not found`);
      return;
    }

    const userData = userDoc.data();
    const subscriptions: StoredSubscription[] = userData?.pushSubscriptions || [];

    if (subscriptions.length === 0) return;

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/dashboard',
      icon: payload.icon || '/icons/icon-192.png',
    });

    const expiredEndpoints: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            notificationPayload
          );
        } catch (err: any) {
          // 410 Gone or 404 Not Found = subscription expired
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`🗑️ Push subscription expired, marking for removal: ${sub.endpoint.slice(-20)}`);
            expiredEndpoints.push(sub.endpoint);
          } else {
            console.error(`⚠️ Push send failed (status ${err.statusCode}):`, err.message);
          }
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      const remaining = subscriptions.filter(
        (s) => !expiredEndpoints.includes(s.endpoint)
      );
      await adminDb.collection('users').doc(username).update({
        pushSubscriptions: remaining,
      });
      console.log(`🧹 Removed ${expiredEndpoints.length} expired push subscription(s)`);
    }
  } catch (err: any) {
    console.error('⚠️ Push notification error (non-fatal):', err.message);
  }
}

/**
 * Send push notification to multiple users.
 * Useful for batch operations like weekly wrap cron.
 */
export async function sendPushToUsers(
  usernames: string[],
  payload: PushPayload
): Promise<void> {
  await Promise.allSettled(
    usernames.map((username) => sendPushNotification(username, payload))
  );
}
