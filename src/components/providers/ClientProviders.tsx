'use client';

import { ThemeProvider } from './ThemeProvider';
import { PostHogProvider } from './PostHogProvider';
import { ViewTransitions } from 'next-view-transitions';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/lib/stores/authStore';
import { useEffect } from 'react';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ViewTransitions>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
        themes={['light', 'dark']}
      >
        <PostHogProvider>
          {children}
          <Toaster />
        </PostHogProvider>
      </ThemeProvider>
    </ViewTransitions>
  );
}
