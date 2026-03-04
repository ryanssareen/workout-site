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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  needsUsername: false,
  pendingGoogleUser: null,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setNeedsUsername: (needs, pending = null) => set({ needsUsername: needs, pendingGoogleUser: pending }),
  initialize: async () => {
    // Dynamic import to prevent Firebase loading during SSR/build
    const { onAuthChange, getUserProfile } = await import('@/lib/firebase/auth');
    const { getUsernameFromUid } = await import('@/lib/firebase/userMapping');

    onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Check if user has a username mapping
        const username = await getUsernameFromUid(firebaseUser.uid);
        if (!username) {
          // Firebase auth exists but no user doc yet (Google sign-in, needs username)
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

        const userProfile = await getUserProfile(firebaseUser.uid);
        set({ user: userProfile, loading: false, needsUsername: false, pendingGoogleUser: null });
      } else {
        set({ user: null, loading: false, needsUsername: false, pendingGoogleUser: null });
      }
    });
  },
}));
