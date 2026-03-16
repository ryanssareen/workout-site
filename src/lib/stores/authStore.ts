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

// Track the last loaded UID to avoid redundant Firestore reads on repeat auth events
let lastLoadedUid: string | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  needsUsername: false,
  pendingGoogleUser: null,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setNeedsUsername: (needs, pending = null) => set({ needsUsername: needs, pendingGoogleUser: pending }),
  initialize: async () => {
    // Dynamic import to prevent Firebase loading during SSR/build
    const { onAuthChange, getUserProfileByUsername } = await import('@/lib/firebase/auth');
    const { getUsernameFromUid } = await import('@/lib/firebase/userMapping');

    onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Skip re-fetch if we already have the profile for this UID
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

        // Fetch profile by username directly — avoids redundant getUsernameFromUid call (1 read instead of 2)
        const userProfile = await getUserProfileByUsername(username);
        lastLoadedUid = firebaseUser.uid;
        set({ user: userProfile, loading: false, needsUsername: false, pendingGoogleUser: null });
      } else {
        lastLoadedUid = null;
        set({ user: null, loading: false, needsUsername: false, pendingGoogleUser: null });
      }
    });
  },
}));
