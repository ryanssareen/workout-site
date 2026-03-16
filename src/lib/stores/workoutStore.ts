import { create } from 'zustand';
import { Workout } from '@/types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  workouts: Workout[];
  fetchedAt: number;
}

interface WorkoutStoreState {
  /** Cached workouts keyed by username */
  cache: Map<string, CacheEntry>;
  /** Currently in-flight fetch promise (deduplicates concurrent calls) */
  pendingFetch: Map<string, Promise<Workout[]>>;

  /**
   * Get workouts for a user. Returns cached data if fresh, otherwise fetches.
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

    // Check cache freshness
    const cached = state.cache.get(username);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.workouts;
    }

    // Deduplicate in-flight fetches
    const pending = state.pendingFetch.get(username);
    if (pending) {
      return pending;
    }

    // Fetch fresh data
    const fetchPromise = (async () => {
      try {
        const { getUserWorkouts } = await import('@/lib/firebase/firestore');
        const workouts = await getUserWorkouts(username, role);

        // Update cache
        set((s) => {
          const newCache = new Map(s.cache);
          newCache.set(username, { workouts, fetchedAt: Date.now() });
          const newPending = new Map(s.pendingFetch);
          newPending.delete(username);
          return { cache: newCache, pendingFetch: newPending };
        });

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
  },
}));
