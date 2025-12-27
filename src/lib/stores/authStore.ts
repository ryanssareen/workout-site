import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  initialize: async () => {
    // Dynamic import to prevent Firebase loading during SSR/build
    const { onAuthChange, getUserProfile } = await import('@/lib/firebase/auth');
    
    onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await getUserProfile(firebaseUser.uid);
        set({ user: userProfile, loading: false });
      } else {
        set({ user: null, loading: false });
      }
    });
  },
}));
