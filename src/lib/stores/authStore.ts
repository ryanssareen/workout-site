import { create } from 'zustand';
import { User } from '@/types';

interface PendingGoogleUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  needsUsername: boolean;
  pendingGoogleUser: PendingGoogleUser | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setNeedsUsername: (needs: boolean, pending?: PendingGoogleUser | null) => void;
  initialize: () => void;
}

const CACHE_KEY = 'tda_auth_cache';

function cacheUser(user: User | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch { /* quota exceeded or private browsing */ }
}

function getCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

let lastLoadedUid: string | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  needsUsername: false,
  pendingGoogleUser: null,
  setUser: (user) => {
    cacheUser(user);
    if (user?.uid) lastLoadedUid = user.uid;
    set({ user });
  },
  setLoading: (loading) => set({ loading }),
  setNeedsUsername: (needs, pending = null) => set({ needsUsername: needs, pendingGoogleUser: pending }),
  initialize: async () => {
    const t0 = performance.now();
    console.log('[auth] initialize() start');

    const cached = getCachedUser();
    if (cached) {
      console.log(`[auth] cache hit in ${(performance.now() - t0).toFixed(0)}ms, setting user immediately`);
      set({ user: cached, loading: false });
      lastLoadedUid = '__cached__';
    }

    const t1 = performance.now();
    const { onAuthChange, getUserProfileByUsername } = await import('@/lib/firebase/auth');
    const { getUsernameFromUid } = await import('@/lib/firebase/userMapping');
    console.log(`[auth] dynamic imports done in ${(performance.now() - t1).toFixed(0)}ms`);

    onAuthChange(async (firebaseUser) => {
      const t2 = performance.now();
      console.log(`[auth] onAuthStateChanged fired at +${(t2 - t0).toFixed(0)}ms, user=${!!firebaseUser}`);

      if (firebaseUser) {
        const currentUser = get().user;
        if (currentUser && lastLoadedUid === firebaseUser.uid) {
          console.log(`[auth] skipping re-fetch, lastLoadedUid matches at +${(performance.now() - t0).toFixed(0)}ms`);
          set({ loading: false });
          return;
        }

        const t3 = performance.now();
        const username = await getUsernameFromUid(firebaseUser.uid);
        console.log(`[auth] getUsernameFromUid took ${(performance.now() - t3).toFixed(0)}ms, username=${username}`);

        if (!username) {
          lastLoadedUid = null;
          cacheUser(null);
          set({
            user: null, loading: false, needsUsername: true,
            pendingGoogleUser: {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || undefined,
            },
          });
          return;
        }

        const t4 = performance.now();
        const userProfile = await getUserProfileByUsername(username);
        console.log(`[auth] getUserProfileByUsername took ${(performance.now() - t4).toFixed(0)}ms`);

        lastLoadedUid = firebaseUser.uid;
        cacheUser(userProfile);
        set({ user: userProfile, loading: false, needsUsername: false, pendingGoogleUser: null });
        console.log(`[auth] DONE, total: ${(performance.now() - t0).toFixed(0)}ms`);
      } else {
        lastLoadedUid = null;
        cacheUser(null);
        set({ user: null, loading: false, needsUsername: false, pendingGoogleUser: null });
        console.log(`[auth] no user, loading=false at +${(performance.now() - t0).toFixed(0)}ms`);
      }
    });
  },
}));
