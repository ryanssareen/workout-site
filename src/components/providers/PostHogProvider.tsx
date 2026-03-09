'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initPostHog, track, identifyUser, resetUser } from '@/lib/posthog';
import { useAuthStore } from '@/lib/stores/authStore';

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    track('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (user) {
      identifyUser(user.uid, {
        email: user.email,
        role: user.role,
        username: user.username,
      });
    } else {
      resetUser();
    }
  }, [user?.uid]);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}
