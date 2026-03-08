'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function PushNotificationManager() {
  const user = useAuthStore((s) => s.user);
  const didSubscribe = useRef(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-subscribe if already granted, or show prompt if default
  useEffect(() => {
    if (!user?.username || !VAPID_PUBLIC_KEY || didSubscribe.current) return;

    // Only prompt in standalone (installed) PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    if (!isStandalone) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const checkPermission = async () => {
      const permission = Notification.permission;

      if (permission === 'granted') {
        // Already granted — subscribe silently
        await subscribeToPush(user.username);
        didSubscribe.current = true;
      } else if (permission === 'default') {
        // Not yet asked — show our custom prompt
        const wasDismissed = sessionStorage.getItem('push-prompt-dismissed');
        if (!wasDismissed) {
          setShowPrompt(true);
        }
      }
      // If 'denied', do nothing
    };

    checkPermission();
  }, [user?.username]);

  const handleEnable = async () => {
    if (!user?.username) return;

    const permission = await Notification.requestPermission();
    setShowPrompt(false);

    if (permission === 'granted') {
      await subscribeToPush(user.username);
      didSubscribe.current = true;
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    sessionStorage.setItem('push-prompt-dismissed', '1');
  };

  if (!showPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/60 shadow-lg backdrop-blur-lg">
        <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Stay in the loop</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get notified when Strava syncs new workouts and when your weekly wrap is ready.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={handleEnable} className="h-8 text-xs px-3">
              Enable
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8 text-xs px-3 text-muted-foreground">
              Not now
            </Button>
          </div>
        </div>
        <button onClick={handleDismiss} className="flex-shrink-0 p-1 rounded-full hover:bg-muted transition-colors -mt-1 -mr-1">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

async function subscribeToPush(username: string) {
  try {
    if (!VAPID_PUBLIC_KEY) return;

    const registration = await navigator.serviceWorker.ready;
    const existingSub = await registration.pushManager.getSubscription();

    // Use existing subscription or create new one
    const subscription =
      existingSub ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys) return;

    // Send to our API
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        subscription: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        },
      }),
    });

    console.log('✅ Push notification subscription registered');
  } catch (err) {
    console.error('⚠️ Push subscription failed:', err);
  }
}
