'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useStravaSyncStore } from '@/lib/stores/stravaSyncStore';
import { toast } from 'sonner';
import { track } from '@/lib/posthog';

/**
 * Invisible component rendered in the dashboard layout.
 * Detects `?strava=connected` URL param (after OAuth callback)
 * and auto-triggers a Strava workout sync via the global store.
 */
export function StravaSyncTrigger() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const startSync = useStravaSyncStore((s) => s.startSync);
  const status = useStravaSyncStore((s) => s.status);
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    if (!user?.username) return;

    const stravaParam = searchParams.get('strava');
    if (stravaParam === 'connected') {
      hasFired.current = true;

      // Clean the URL param
      const url = new URL(window.location.href);
      url.searchParams.delete('strava');
      url.searchParams.delete('reason');
      router.replace(url.pathname + (url.search || ''));

      // Show connected toast
      track('strava_connected');
      toast.success('Strava account connected successfully');

      // Auto-trigger sync if not already running — pass tokens for quota-safe mode
      if (status === 'idle') {
        const tokens = user.stravaAccessToken
          ? { stravaAccessToken: user.stravaAccessToken, stravaRefreshToken: user.stravaRefreshToken, stravaTokenExpiresAt: user.stravaTokenExpiresAt }
          : undefined;
        startSync(user.username, tokens);
      }
    }
  }, [searchParams, user, startSync, status, router, pathname]);

  return null;
}
