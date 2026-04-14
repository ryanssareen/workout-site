'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { User, Workout } from '@/types';
import { toast } from 'sonner';
import { safeToDate } from '@/lib/dateUtils';

const SYNC_COOLDOWN_KEY = 'coachtrack_last_strava_sync';
export const SYNC_COOLDOWN_UNTIL_KEY = 'coachtrack_strava_cooldown_until';
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between auto-syncs
const PAGE_DELAY_MS = 2_000; // 2s pause between backfill pages to respect Strava rate limits

// Module-level in-flight guard — survives route remounts in same tab
let activeAutoSyncPromise: Promise<void> | null = null;

function setCooldownFor(ms: number): void {
  const now = Date.now();
  const nextUntil = now + Math.max(0, ms);
  try {
    const existingRaw = sessionStorage.getItem(SYNC_COOLDOWN_UNTIL_KEY);
    const existingUntil = existingRaw ? Number(existingRaw) : 0;
    const finalUntil = Number.isFinite(existingUntil) ? Math.max(existingUntil, nextUntil) : nextUntil;
    sessionStorage.setItem(SYNC_COOLDOWN_KEY, String(now));
    sessionStorage.setItem(SYNC_COOLDOWN_UNTIL_KEY, String(finalUntil));
  } catch {
    // Ignore storage failures (private mode / blocked storage)
  }
}

/**
 * Run achievement checks for the most recently synced Strava workout.
 * Only checks the single most recent to conserve Firestore reads.
 */
async function runPostSyncAchievements(username: string, user: User) {
  try {
    const { checkAchievements } = await import('@/lib/achievements');
    const { useWorkoutStore } = await import('@/lib/stores/workoutStore');
    const allWorkouts = await useWorkoutStore.getState().getWorkouts(username, user.role);

    // Get the single most recently completed Strava workout
    const recentStrava = allWorkouts
      .filter((w: Workout) => w.completed && (w.source === 'strava' || w.completedBy === 'strava'))
      .sort((a: Workout, b: Workout) => {
        const da = safeToDate({ date: a.completedAt });
        const db = safeToDate({ date: b.completedAt });
        return db.getTime() - da.getTime();
      })
      .slice(0, 1);

    for (const workout of recentStrava) {
      const result = await checkAchievements(username, user.uid, workout, allWorkouts);
      if (result.newPRs.length > 0 || result.newMilestones.length > 0) {
        const prNames = result.newPRs.map(p => p.name).join(', ');
        const mNames = result.newMilestones.map(m => m.name).join(', ');
        const parts: string[] = [];
        if (prNames) parts.push(`PR: ${prNames}`);
        if (mNames) parts.push(mNames);
        toast.success(parts.join(' | '), { icon: '🏆', duration: 6000 });
      }
    }
  } catch (err) {
    console.error('[post-sync-achievements] failed (non-fatal):', err);
  }
}

/**
 * 2-stage Strava auto-sync on login / page load.
 *
 * Stage 1 — Quick Fill: Fetch last 30 days (or since lastStravaSync) in a
 *           single API call. Immediately populates the calendar.
 *
 * Stage 2 — Backfill: Only runs if the user has never completed a full
 *           historical backfill (lastStravaFullBackfill is null). Fetches
 *           activities older than 30 days, one page (200 activities) at a
 *           time, with 2s delay between pages. Resumes from the last saved
 *           page if interrupted by a rate limit.
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

  // ── Generic fetch helper ──────────────────────────────────────────────
  type SyncParams = {
    mode: 'recent' | 'backfill';
    period?: string;
    backfillPage?: number;
  };
  type SyncResult = {
    newWorkouts: number;
    merged: number;
    needsReconnect?: boolean;
    rateLimited?: boolean;
    rateLimitMessage?: string;
    isCooldown?: boolean;
    retryAfterSeconds?: number;
    rateLimitScope?: 'daily' | 'window15' | 'cooldown';
    backfillComplete?: boolean;
  };

  const fetchSync = useCallback(async (
    userId: string,
    params: SyncParams,
    tokens?: { stravaAccessToken: string; stravaRefreshToken?: string; stravaTokenExpiresAt?: number; userTimezone?: string },
  ): Promise<SyncResult> => {
    let res: Response;

    if (tokens?.stravaAccessToken) {
      // POST mode — send tokens in body, zero Firestore reads on server (quota-safe)
      res = await fetch('/api/strava/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          userId,
          mode: params.mode,
          period: params.period,
          backfillPage: params.backfillPage,
          stravaAccessToken: tokens.stravaAccessToken,
          stravaRefreshToken: tokens.stravaRefreshToken,
          stravaTokenExpiresAt: tokens.stravaTokenExpiresAt,
          userTimezone: tokens.userTimezone,
        }),
      });
    } else {
      // GET fallback — server reads tokens from Firestore
      const qs = new URLSearchParams({ userId, mode: params.mode });
      if (params.period) qs.set('period', params.period);
      if (params.backfillPage) qs.set('backfillPage', String(params.backfillPage));
      res = await fetch(`/api/strava/sync?${qs}`, { headers: { Accept: 'application/json' } });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.needsReconnect) {
        return { newWorkouts: 0, merged: 0, needsReconnect: true };
      }
      if (err.isQuota || err.rateLimited || res.status === 429) {
        console.log(`[auto-sync] Strava rate limit — ${err.error || 'quota exhausted'}${err.isCooldown ? ' (cooldown)' : ''}`);
        return {
          newWorkouts: 0,
          merged: 0,
          rateLimited: true,
          rateLimitMessage: err.error,
          isCooldown: !!err.isCooldown,
          retryAfterSeconds: typeof err.retryAfterSeconds === 'number' ? err.retryAfterSeconds : undefined,
          rateLimitScope: err.rateLimitScope,
        };
      }
      throw new Error(err.error || 'sync failed');
    }

    const data = await res.json();
    return {
      newWorkouts: data.newWorkouts || 0,
      merged: data.mergedWorkouts || 0,
      backfillComplete: data.backfillComplete,
    };
  }, []);

  // ── Main sync orchestrator ────────────────────────────────────────────
  const runSync = useCallback(async (
    userId: string,
    currentUser: User,
    tokens?: { stravaAccessToken: string; stravaRefreshToken?: string; stravaTokenExpiresAt?: number; userTimezone?: string },
  ) => {
    setSyncing(true);
    let totalNew = 0;
    let totalMerged = 0;

    try {
      // ── Stage 1: Quick calendar fill ──────────────────────────────
      // Determine how far back to sync based on lastStravaSync
      const now = Math.floor(Date.now() / 1000);
      const lastSync = currentUser.lastStravaSync;
      let recentPeriod = 'month'; // default: last 30 days for new users

      if (lastSync) {
        const ageSeconds = now - lastSync;
        if (ageSeconds < 300) {
          // Synced less than 5 minutes ago — skip
          console.log('[auto-sync] synced very recently, skipping Stage 1');
          setSyncing(false);
          return;
        } else if (ageSeconds < 3600) {
          recentPeriod = '2days';
        } else if (ageSeconds < 86400) {
          recentPeriod = 'week';
        }
        // else: > 1 day ago → use 'month' (default)
      }

      console.log(`[auto-sync] Stage 1: fetching ${recentPeriod}${tokens ? ' (POST/quota-safe)' : ' (GET)'}`);
      setSyncPhaseLabel(`syncing ${recentPeriod === '2days' ? 'last 2 days' : recentPeriod === 'week' ? 'last week' : 'last 30 days'}`);

      const recentResult = await fetchSync(userId, { mode: 'recent', period: recentPeriod }, tokens);

      if (recentResult.needsReconnect) {
        console.warn('[auto-sync] Strava token expired, needs reconnect');
        return;
      }
      if (recentResult.rateLimited) {
        const retryMs = ((recentResult.retryAfterSeconds ?? 60) * 1000) + 5_000;
        setCooldownFor(retryMs);
        // Don't retry — retries waste API calls and extend cooldowns.
        // Sync will try again on next page load (5-min session cooldown).
        if (!recentResult.isCooldown) {
          // Real rate limit (daily/15-min exceeded) — tell the user
          toast.info(recentResult.rateLimitMessage || 'Strava rate limit reached. Sync will resume later.', { icon: '⏳', duration: 6000 });
        } else {
          console.log('[auto-sync] Strava cooldown — skipping silently, will try next page load');
        }
        return;
      }

      totalNew += recentResult.newWorkouts;
      totalMerged += recentResult.merged;

      if (recentResult.newWorkouts + recentResult.merged > 0) {
        console.log(`[auto-sync] Stage 1: ${recentResult.newWorkouts} new, ${recentResult.merged} merged — refreshing`);
        onNewWorkouts?.();
      } else {
        console.log('[auto-sync] Stage 1: no new activities');
      }

      // ── Stage 2: Historical backfill (only if never completed) ────
      if (!currentUser.lastStravaFullBackfill) {
        const startPage = (currentUser.stravaBackfillPage || 0) + 1; // resume from next page
        console.log(`[auto-sync] Stage 2: starting backfill from page ${startPage}`);

        let page = startPage;
        while (true) {
          // Delay between pages to respect Strava rate limits
          await new Promise(r => setTimeout(r, PAGE_DELAY_MS));

          setSyncPhaseLabel(`backfilling history (page ${page})`);
          console.log(`[auto-sync] Stage 2: backfill page ${page}${tokens ? ' (POST)' : ' (GET)'}`);

          const backfillResult = await fetchSync(userId, { mode: 'backfill', backfillPage: page }, tokens);

          if (backfillResult.needsReconnect) {
            console.warn('[auto-sync] Strava token expired during backfill');
            return;
          }
          if (backfillResult.rateLimited) {
            const retryMs = ((backfillResult.retryAfterSeconds ?? 60) * 1000) + 5_000;
            setCooldownFor(retryMs);
            // Don't retry — just stop backfill and resume next time
            if (!backfillResult.isCooldown) {
              toast.info(backfillResult.rateLimitMessage || 'Strava rate limit reached. History sync will resume next time.', { icon: '⏳', duration: 6000 });
            }
            console.log(`[auto-sync] Rate limited during backfill at page ${page} — will resume next time`);
            break;
          }

          totalNew += backfillResult.newWorkouts;
          totalMerged += backfillResult.merged;

          if (backfillResult.newWorkouts + backfillResult.merged > 0) {
            console.log(`[auto-sync] Stage 2 page ${page}: ${backfillResult.newWorkouts} new, ${backfillResult.merged} merged`);
            // Don't call onNewWorkouts per page — we'll call once after backfill completes
          }

          // Server tells us when backfill is done (fewer than 200 activities returned)
          if (backfillResult.backfillComplete) {
            console.log('[auto-sync] Stage 2: backfill complete — all history fetched');
            break;
          }

          page++;
        }
      } else {
        console.log('[auto-sync] Stage 2: skipped (full backfill already completed)');
      }

      // Single refresh callback after all stages complete (instead of per-page during backfill)
      const grandTotal = totalNew + totalMerged;
      if (grandTotal > 0) {
        onNewWorkouts?.();
      }

      setSyncResult({ newWorkouts: totalNew, merged: totalMerged });

      // Show summary toast
      if (grandTotal > 0) {
        const parts: string[] = [];
        if (totalNew > 0) parts.push(`${totalNew} new`);
        if (totalMerged > 0) parts.push(`${totalMerged} merged`);
        toast.success(`Strava synced: ${parts.join(', ')} workout${grandTotal > 1 ? 's' : ''}`, {
          icon: '🔄',
          duration: 4000,
        });

        // Check achievements for newly synced workouts (non-blocking)
        runPostSyncAchievements(userId, currentUser).catch(() => {});
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
  }, [onNewWorkouts, fetchSync]);

  // ── Auto-trigger on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (hasFired.current) return;
    if (!user?.stravaAccessToken) return;
    if (activeAutoSyncPromise) {
      console.log('[auto-sync] skipped — sync already in-flight');
      return;
    }

    // Cooldown check — don't spam Strava (skip for fresh onboarding)
    if (!skipCooldown) {
      try {
        const cooldownUntilRaw = sessionStorage.getItem(SYNC_COOLDOWN_UNTIL_KEY);
        const cooldownUntil = cooldownUntilRaw ? Number(cooldownUntilRaw) : 0;
        if (Number.isFinite(cooldownUntil) && cooldownUntil > Date.now()) {
          console.log('[auto-sync] skipped — extended cooldown active');
          return;
        }
        const last = sessionStorage.getItem(SYNC_COOLDOWN_KEY);
        if (last && Date.now() - Number(last) < COOLDOWN_MS) {
          console.log('[auto-sync] skipped — cooldown active');
          return;
        }
      } catch { /* SSR or private browsing */ }
    }

    hasFired.current = true;
    const tokens = user.stravaAccessToken ? {
      stravaAccessToken: user.stravaAccessToken,
      stravaRefreshToken: user.stravaRefreshToken,
      stravaTokenExpiresAt: user.stravaTokenExpiresAt,
      userTimezone: user.timezone,
    } : undefined;
    console.log(`[auto-sync] firing 2-stage Strava sync${tokens ? ' (quota-safe POST mode)' : ' (GET mode)'}`);
    activeAutoSyncPromise = runSync(user.username, user, tokens)
      .finally(() => {
        activeAutoSyncPromise = null;
      });
  }, [user, runSync, skipCooldown]);

  return { syncing, syncPhaseLabel, syncResult };
}
