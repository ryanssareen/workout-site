import { create } from 'zustand';
import { toast } from 'sonner';

export type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

interface SyncResult {
  newWorkouts: number;
  mergedWorkouts: number;
  message: string;
}

interface StravaTokens {
  stravaAccessToken: string;
  stravaRefreshToken?: string;
  stravaTokenExpiresAt?: number;
}

interface StravaSyncState {
  status: SyncStatus;
  result: SyncResult | null;
  error: string | null;
  needsReconnect: boolean;

  startSync: (
    username: string,
    decisions?: Record<string, { action: 'merge' | 'new'; workoutId?: string }>,
    tokens?: StravaTokens
  ) => void;
  checkDuplicates: (username: string) => Promise<{
    hasDuplicates: boolean;
    duplicates: any[];
    totalNewActivities?: number;
  }>;
  clearResult: () => void;
}

// Module-level promise tracking — survives component unmounts
let activeSyncPromise: Promise<void> | null = null;

// Shared response handler (used by both GET and POST paths)
function handleSyncResponse(
  response: Response,
  set: (state: Partial<StravaSyncState>) => void
): Promise<{ isQuota: boolean } | void> {
  return response.json().then((data) => {
    if (!response.ok) {
      if (data.needsReconnect) {
        set({ status: 'error', error: data.error, needsReconnect: true });
        toast.error('Strava authorization expired', {
          description: 'Disconnect and reconnect your Strava account.',
        });
      } else if (data.isQuota) {
        // Signal caller to retry with POST
        return { isQuota: true };
      } else {
        set({ status: 'error', error: data.error || 'Sync failed' });
        toast.error(data.error || 'Failed to sync with Strava');
      }
      return;
    }

    let message = '';
    if (data.mergedWorkouts > 0 && data.newWorkouts > 0) {
      message = `Merged ${data.mergedWorkouts} and created ${data.newWorkouts} workout${data.newWorkouts > 1 ? 's' : ''}!`;
    } else if (data.mergedWorkouts > 0) {
      message = `Merged ${data.mergedWorkouts} workout${data.mergedWorkouts > 1 ? 's' : ''}!`;
    } else if (data.newWorkouts > 0) {
      message = `Synced ${data.newWorkouts} workout${data.newWorkouts > 1 ? 's' : ''}!`;
    } else {
      message = 'All caught up!';
    }

    set({
      status: 'done',
      result: {
        newWorkouts: data.newWorkouts || 0,
        mergedWorkouts: data.mergedWorkouts || 0,
        message,
      },
    });
    toast.success(message);
  });
}

export const useStravaSyncStore = create<StravaSyncState>((set, get) => ({
  status: 'idle',
  result: null,
  error: null,
  needsReconnect: false,

  startSync: (username, decisions, tokens) => {
    // Already syncing — don't fire another
    if (activeSyncPromise || get().status === 'syncing') return;

    set({ status: 'syncing', result: null, error: null, needsReconnect: false });

    // If we have tokens, go straight to POST (quota-safe) mode.
    // Otherwise, try GET first and fall back to POST if quota hit.
    const doSync = async () => {
      if (tokens?.stravaAccessToken) {
        // POST mode — send tokens in body, zero Firestore reads on server
        console.log('🔄 Strava sync via POST (quota-safe mode)');
        const response = await fetch('/api/strava/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            userId: username,
            stravaAccessToken: tokens.stravaAccessToken,
            stravaRefreshToken: tokens.stravaRefreshToken,
            stravaTokenExpiresAt: tokens.stravaTokenExpiresAt,
            decisions: decisions || undefined,
          }),
        });
        await handleSyncResponse(response, set);
      } else {
        // GET mode — server reads tokens from Firestore
        const decisionsParam = decisions
          ? `&decisions=${encodeURIComponent(JSON.stringify(decisions))}`
          : '';

        const response = await fetch(
          `/api/strava/sync?userId=${username}${decisionsParam}`,
          { headers: { Accept: 'application/json' } }
        );

        const result = await handleSyncResponse(response, set);

        // If quota hit and we don't have tokens, show quota error
        if (result?.isQuota) {
          set({ status: 'error', error: 'Firebase daily quota reached.' });
          toast.error('Daily quota reached', {
            description: 'Try syncing again tomorrow — your data is safe.',
          });
        }
      }
    };

    activeSyncPromise = doSync()
      .catch((err) => {
        const errorMsg = err.message || 'Network error';
        set({ status: 'error', error: errorMsg });
        if (errorMsg.includes('reconnect')) {
          toast.error('Strava authorization expired', {
            description: 'Disconnect and reconnect your Strava account.',
          });
        } else {
          toast.error(errorMsg);
        }
      })
      .finally(() => {
        activeSyncPromise = null;
      });
  },

  checkDuplicates: async (username) => {
    const response = await fetch(
      `/api/strava/sync?userId=${username}&checkDuplicates=true`,
      { headers: { Accept: 'application/json' } }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (errorData.needsReconnect) {
        throw new Error(errorData.error || 'Please reconnect your Strava account');
      }
      if (errorData.hint) {
        throw new Error(`${errorData.error}: ${errorData.hint}`);
      } else if (errorData.details) {
        throw new Error(`${errorData.error}: ${errorData.details}`);
      }
      throw new Error(errorData.error || 'Failed to check for duplicates');
    }

    const data = await response.json();
    return {
      hasDuplicates: data.hasDuplicates || false,
      duplicates: data.duplicates || [],
      totalNewActivities: data.totalNewActivities,
    };
  },

  clearResult: () => set({ status: 'idle', result: null, error: null, needsReconnect: false }),
}));
