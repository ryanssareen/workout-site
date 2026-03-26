import { create } from 'zustand';
import { Workout } from '@/types';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes (cache invalidated on create/update/delete)
const STORAGE_KEY = 'tda_workout_cache';
const STORAGE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes — localStorage stale threshold

interface CacheEntry {
  workouts: Workout[];
  fetchedAt: number;
}

/** Save cache to localStorage for instant load after deployment/refresh */
function persistToStorage(username: string, entry: CacheEntry) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored: Record<string, CacheEntry> = raw ? JSON.parse(raw) : {};
    stored[username] = entry;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* quota exceeded or private browsing */ }
}

/** Load cache from localStorage — returns entry if not too old */
function loadFromStorage(username: string): CacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored: Record<string, CacheEntry> = JSON.parse(raw);
    const entry = stored[username];
    if (!entry) return null;
    // Accept if less than 30 minutes old
    if (Date.now() - entry.fetchedAt > STORAGE_MAX_AGE_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

interface WorkoutStoreState {
  /** Cached workouts keyed by username */
  cache: Map<string, CacheEntry>;
  /** Currently in-flight fetch promise (deduplicates concurrent calls) */
  pendingFetch: Map<string, Promise<Workout[]>>;

  /**
   * Get workouts for a user. Returns cached data if fresh, otherwise fetches.
   * Falls back to localStorage if in-memory cache is empty (e.g. after deploy).
   * Deduplicates concurrent calls for the same user.
   */
  getWorkouts: (username: string, role: 'coach' | 'athlete' | 'student') => Promise<Workout[]>;

  /**
   * Force-refresh workouts from Firestore (bypasses cache).
   * Call after mutations (create/update/delete/sync).
   */
  invalidate: (username: string, role: 'coach' | 'athlete' | 'student') => Promise<Workout[]>;

  /**
   * Clear cache for a user without re-fetching.
   * Next getWorkouts call will fetch fresh.
   */
  clearCache: (username?: string) => void;
}

export const useWorkoutStore = create<WorkoutStoreState>((set, get) => ({
  cache: new Map(),
  pendingFetch: new Map(),

  getWorkouts: async (username, role) => {
    const state = get();

    // Check in-memory cache freshness
    const cached = state.cache.get(username);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.workouts;
    }

    // Deduplicate in-flight fetches
    const pending = state.pendingFetch.get(username);
    if (pending) {
      return pending;
    }

    // Check localStorage for instant data while Firestore loads
    const stored = loadFromStorage(username);
    if (stored && !cached) {
      // Hydrate in-memory cache from localStorage immediately
      set((s) => {
        const newCache = new Map(s.cache);
        newCache.set(username, stored);
        return { cache: newCache };
      });
    }

    // Fetch fresh data from Firestore
    const fetchPromise = (async () => {
      try {
        const { getUserWorkouts } = await import('@/lib/firebase/firestore');
        const workouts = await getUserWorkouts(username, role);

        const entry: CacheEntry = { workouts, fetchedAt: Date.now() };

        // Update in-memory cache
        set((s) => {
          const newCache = new Map(s.cache);
          newCache.set(username, entry);
          const newPending = new Map(s.pendingFetch);
          newPending.delete(username);
          return { cache: newCache, pendingFetch: newPending };
        });

        // Persist to localStorage for next deploy/refresh
        persistToStorage(username, entry);

        return workouts;
      } catch (error) {
        // Clear pending on error
        set((s) => {
          const newPending = new Map(s.pendingFetch);
          newPending.delete(username);
          return { pendingFetch: newPending };
        });
        throw error;
      }
    })();

    // Register pending fetch
    set((s) => {
      const newPending = new Map(s.pendingFetch);
      newPending.set(username, fetchPromise);
      return { pendingFetch: newPending };
    });

    // If we have localStorage data, return it immediately while fetch continues
    if (stored) {
      // Fire-and-forget: the fetch will update the cache when done
      fetchPromise.catch(() => {});
      return stored.workouts;
    }

    return fetchPromise;
  },

  invalidate: async (username, role) => {
    // Clear the cache entry so next call fetches fresh
    set((s) => {
      const newCache = new Map(s.cache);
      newCache.delete(username);
      return { cache: newCache };
    });

    // Fetch fresh immediately
    return get().getWorkouts(username, role);
  },

  clearCache: (username) => {
    set((s) => {
      if (username) {
        const newCache = new Map(s.cache);
        newCache.delete(username);
        return { cache: newCache };
      }
      return { cache: new Map() };
    });
    // Also clear localStorage
    if (typeof window !== 'undefined') {
      try {
        if (username) {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const stored = JSON.parse(raw);
            delete stored[username];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
          }
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch { /* ignore */ }
    }
  },
}));
