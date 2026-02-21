'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { User } from '@/types';
import { toast } from 'sonner';

const SYNC_COOLDOWN_KEY = 'coachtrack_last_strava_sync';
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between auto-syncs

/**
 * Background Strava sync on login / page load.
 * Fires once per session (or after cooldown), silently syncs,
 * and calls onNewWorkouts() if anything came in so the page can refresh.
 */
export function useStravaAutoSync(
  user: User | null,
  onNewWorkouts?: () => void,
) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ newWorkouts: number; merged: number } | null>(null);
  const hasFired = useRef(false);

  const runSync = useCallback(async (userId: string) => {
    setSyncing(true);
    try {
      // Skip duplicate check for auto-sync — just import new stuff
      const res = await fetch(
        `/api/strava/sync?userId=${userId}`,
        { headers: { Accept: 'application/json' } },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Don't toast auth errors on auto-sync — user will see it when they manually sync
        if (err.needsReconnect) {
          console.warn('[auto-sync] Strava token expired, needs reconnect');
          return;
        }
        console.error('[auto-sync] sync failed:', err);
        return;
      }

      const data = await res.json();
      const total = (data.newWorkouts || 0) + (data.mergedWorkouts || 0);

      setSyncResult({ newWorkouts: data.newWorkouts || 0, merged: data.mergedWorkouts || 0 });

      if (total > 0) {
        // Show a subtle success toast
        const parts: string[] = [];
        if (data.newWorkouts > 0) parts.push(`${data.newWorkouts} new`);
        if (data.mergedWorkouts > 0) parts.push(`${data.mergedWorkouts} merged`);
        toast.success(`Strava synced: ${parts.join(', ')} workout${total > 1 ? 's' : ''}`, {
          icon: '🔄',
          duration: 4000,
        });

        // Tell the page to refresh its data
        onNewWorkouts?.();
      }

      // Update cooldown timestamp
      try {
        sessionStorage.setItem(SYNC_COOLDOWN_KEY, String(Date.now()));
      } catch { /* SSR or private browsing */ }
    } catch (err) {
      console.error('[auto-sync] unexpected error:', err);
    } finally {
      setSyncing(false);
    }
  }, [onNewWorkouts]);

  useEffect(() => {
    if (hasFired.current) return;
    if (!user?.stravaAccessToken) return;

    // Cooldown check — don't spam Strava
    try {
      const last = sessionStorage.getItem(SYNC_COOLDOWN_KEY);
      if (last && Date.now() - Number(last) < COOLDOWN_MS) {
        console.log('[auto-sync] skipped — cooldown active');
        return;
      }
    } catch { /* SSR or private browsing */ }

    hasFired.current = true;
    console.log('[auto-sync] firing background Strava sync');
    runSync(user.uid);
  }, [user, runSync]);

  return { syncing, syncResult };
}
