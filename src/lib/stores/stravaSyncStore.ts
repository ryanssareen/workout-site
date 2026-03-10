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
  userTimezone?: string;
}

interface StravaSyncState {
  status: SyncStatus;
  result: SyncResult | null;
  error: string | null;
  needsReconnect: boolean;

  startSync: (username: string, tokens?: StravaTokens) => void;
  clearResult: () => void;
}

// Module-level promise tracking — survives component unmounts
let activeSyncPromise: Promise<void> | null = null;

// Safely extract a string error message from any value
function toErrorString(val: unknown, fallback: string): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'message' in val && typeof (val as any).message === 'string') return (val as any).message;
  return fallback;
}

// Shared response handler (used by both GET and POST paths)
function handleSyncResponse(
  response: Response,
  set: (state: Partial<StravaSyncState>) => void
): Promise<{ isQuota: boolean } | void> {
  return response.json().then((data) => {
    if (!response.ok) {
      if (data.needsReconnect) {
        set({ status: 'error', error: toErrorString(data.error, 'Strava authorization expired'), needsReconnect: true });
        toast.error('Strava authorization expired', {
          description: 'Disconnect and reconnect your Strava account.',
        });
      } else if (data.isQuota) {
        // Signal caller to retry with POST
        return { isQuota: true };
      } else {
        const msg = toErrorString(data.error, 'Sync failed');
        set({ status: 'error', error: msg });
        if (response.status === 429 && typeof data.retryAfterSeconds === 'number') {
          const mins = Math.max(1, Math.ceil(data.retryAfterSeconds / 60));
          toast.error(msg, {
            description: `Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`,
          });
        } else {
          toast.error(msg);
        }
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

  startSync: (username, tokens) => {
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
            userTimezone: tokens.userTimezone,
          }),
        });
        await handleSyncResponse(response, set);
      } else {
        // GET mode — server reads tokens from Firestore
        const response = await fetch(
          `/api/strava/sync?userId=${username}`,
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
        const errorMsg = toErrorString(err, 'Network error');
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

  clearResult: () => set({ status: 'idle', result: null, error: null, needsReconnect: false }),
}));
