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

/** Save user profile to localStorage for instant hydration on next visit */
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

/** Read cached user profile from localStorage */
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

// Track the last loaded UID to avoid redundant Firestore reads on repeat auth events
let lastLoadedUid: string | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  needsUsername: false,
  pendingGoogleUser: null,
  setUser: (user) => {
    cacheUser(user);
    // Mark as eagerly loaded so onAuthStateChanged skips redundant Firestore reads
    if (user?.uid) lastLoadedUid = user.uid;
    set({ user });
  },
  setLoading: (loading) => set({ loading }),
  setNeedsUsername: (needs, pending = null) => set({ needsUsername: needs, pendingGoogleUser: pending }),
  initialize: async () => {
    // Hydrate from localStorage cache instantly — show UI without waiting for Firestore
    const cached = getCachedUser();
    if (cached) {
      set({ user: cached, loading: false });
      lastLoadedUid = '__cached__';
    }

    // Dynamic import to prevent Firebase loading during SSR/build
    const { onAuthChange, getUserProfileByUsername } = await import('@/lib/firebase/auth');
    const { getUsernameFromUid } = await import('@/lib/firebase/userMapping');

    onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Skip re-fetch if we already have the fresh profile for this UID
        const currentUser = get().user;
        if (currentUser && lastLoadedUid === firebaseUser.uid) {
          set({ loading: false });
          return;
        }

        // Resolve UID → username (1 read)
        const username = await getUsernameFromUid(firebaseUser.uid);
        if (!username) {
          // Firebase auth exists but no user doc yet (Google sign-in, needs username)
          lastLoadedUid = null;
          cacheUser(null);
          set({
            user: null,
            loading: false,
            needsUsername: true,
            pendingGoogleUser: {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || undefined,
            },
          });
          return;
        }

        // Fetch profile by username directly (1 read)
        const userProfile = await getUserProfileByUsername(username);
        lastLoadedUid = firebaseUser.uid;
        cacheUser(userProfile);
        set({ user: userProfile, loading: false, needsUsername: false, pendingGoogleUser: null });
      } else {
        lastLoadedUid = null;
        cacheUser(null);
        set({ user: null, loading: false, needsUsername: false, pendingGoogleUser: null });
      }
    });
  },
}));
