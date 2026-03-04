'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { User } from '@/types';
import { toast } from 'sonner';

const SYNC_COOLDOWN_KEY = 'coachtrack_last_strava_sync';
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between auto-syncs

// Progressive sync phases: most recent first, then expand
const SYNC_PHASES = ['2days', 'week', 'month', '2months', '6months', 'year'] as const;

const PHASE_LABELS: Record<string, string> = {
  '2days': 'last 2 days',
  'week': 'last week',
  'month': 'last 30 days',
  '2months': 'last 60 days',
  '6months': 'last 6 months',
  'year': 'last year',
};

/**
 * Background Strava sync on login / page load.
 * Syncs progressively: 2 days → 1 week → 1 month → 2 months → 6 months → 1 year.
 * After each phase that imports workouts, refreshes the page data
 * so the calendar populates quickly instead of waiting for the full year.
 */
export function useStravaAutoSync(
  user: User | null,
  onNewWorkouts?: () => void,
  /** Skip cooldown check (e.g. fresh onboarding) */
  skipCooldown?: boolean,
) {
  const [syncing, setSyncing] = useState(false);
  const [syncPhaseLabel, setSyncPhaseLabel] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ newWorkouts: number; merged: number } | null>(null);
  const hasFired = useRef(false);

  const fetchPhase = useCallback(async (userId: string, period: string): Promise<{ newWorkouts: number; merged: number; needsReconnect?: boolean }> => {
    const res = await fetch(
      `/api/strava/sync?userId=${userId}&period=${period}`,
      { headers: { Accept: 'application/json' } },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.needsReconnect) {
        return { newWorkouts: 0, merged: 0, needsReconnect: true };
      }
      throw new Error(err.error || 'sync failed');
    }

    const data = await res.json();
    return {
      newWorkouts: data.newWorkouts || 0,
      merged: data.mergedWorkouts || 0,
    };
  }, []);

  const runSync = useCallback(async (userId: string) => {
    setSyncing(true);
    let totalNew = 0;
    let totalMerged = 0;

    try {
      for (const phase of SYNC_PHASES) {
        console.log(`[auto-sync] phase: ${phase}`);
        setSyncPhaseLabel(PHASE_LABELS[phase] || phase);

        const result = await fetchPhase(userId, phase);

        if (result.needsReconnect) {
          console.warn('[auto-sync] Strava token expired, needs reconnect');
          return;
        }

        totalNew += result.newWorkouts;
        totalMerged += result.merged;
        const phaseTotal = result.newWorkouts + result.merged;

        // Refresh the page after each phase that brought in new data
        if (phaseTotal > 0) {
          console.log(`[auto-sync] ${phase}: ${result.newWorkouts} new, ${result.merged} merged — refreshing`);
          onNewWorkouts?.();
        } else {
          console.log(`[auto-sync] ${phase}: no new activities`);
        }
      }

      setSyncResult({ newWorkouts: totalNew, merged: totalMerged });

      // Show one summary toast after all phases complete
      const grandTotal = totalNew + totalMerged;
      if (grandTotal > 0) {
        const parts: string[] = [];
        if (totalNew > 0) parts.push(`${totalNew} new`);
        if (totalMerged > 0) parts.push(`${totalMerged} merged`);
        toast.success(`Strava synced: ${parts.join(', ')} workout${grandTotal > 1 ? 's' : ''}`, {
          icon: '🔄',
          duration: 4000,
        });
      }

      // Auto-dedup: run once after all phases
      try {
        console.log('[auto-sync] running auto-dedup...');
        const dedupRes = await fetch('/api/workouts/auto-dedup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        if (dedupRes.ok) {
          const dedupData = await dedupRes.json();
          if (dedupData.deleted > 0) {
            toast.success(`Cleaned up ${dedupData.deleted} duplicate workout${dedupData.deleted > 1 ? 's' : ''}`, {
              icon: '🧹',
              duration: 4000,
            });
            onNewWorkouts?.();
          }
        }
      } catch (dedupErr) {
        console.error('[auto-sync] dedup error:', dedupErr);
      }

      // Update cooldown timestamp
      try {
        sessionStorage.setItem(SYNC_COOLDOWN_KEY, String(Date.now()));
      } catch { /* SSR or private browsing */ }
    } catch (err) {
      console.error('[auto-sync] unexpected error:', err);
    } finally {
      setSyncing(false);
      setSyncPhaseLabel(null);
    }
  }, [onNewWorkouts, fetchPhase]);

  useEffect(() => {
    if (hasFired.current) return;
    if (!user?.stravaAccessToken) return;

    // Cooldown check — don't spam Strava (skip for fresh onboarding)
    if (!skipCooldown) {
      try {
        const last = sessionStorage.getItem(SYNC_COOLDOWN_KEY);
        if (last && Date.now() - Number(last) < COOLDOWN_MS) {
          console.log('[auto-sync] skipped — cooldown active');
          return;
        }
      } catch { /* SSR or private browsing */ }
    }

    hasFired.current = true;
    console.log('[auto-sync] firing progressive Strava sync');
    runSync(user.username);
  }, [user, runSync, skipCooldown]);

  return { syncing, syncPhaseLabel, syncResult };
}
