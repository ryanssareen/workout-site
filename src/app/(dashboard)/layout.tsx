'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Navbar } from '@/components/dashboard/Navbar';
import { MobileBottomNav } from '@/components/dashboard/MobileBottomNav';
import { StravaSyncTrigger } from '@/components/strava/StravaSyncTrigger';
import { PushNotificationManager } from '@/components/PushNotificationManager';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const needsUsername = useAuthStore((state) => state.needsUsername);


  useEffect(() => {
    if (loading) return;

    if (needsUsername) {
      router.replace('/choose-username');
      return;
    }

    if (!user) {
      router.replace('/login');
      return;
    }

    const isOnboardingPage = pathname === '/onboarding';
    if (user.onboardingCompleted === false && !isOnboardingPage) {
      router.replace('/onboarding');
      return;
    }

    // Onboarding page is always accessible — finish/skip handlers route out
  }, [user, loading, needsUsername, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isReports = pathname === '/reports';
  const isCalendar = pathname === '/calendar';
  const isWrap = pathname === '/wrap';
  const isReview = pathname === '/review';
  const isWrapped = pathname === '/wrapped';
  const isOnboardingPage = pathname === '/onboarding';
  const isWide = isReports || isCalendar;

  // Wrap, Review & Wrapped get their own immersive full-screen layout
  if (isWrap || isReview || isWrapped) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {children}
      </div>
    );
  }

  if (isOnboardingPage) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="absolute inset-0 bg-energy -z-10 pointer-events-none" aria-hidden />
        <main className="relative container mx-auto px-3 sm:px-4 py-6 sm:py-10 max-w-2xl">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-background text-foreground">
      <div className="absolute inset-0 bg-energy -z-10 pointer-events-none" aria-hidden />
      <Navbar />
      <Suspense fallback={null}><StravaSyncTrigger /></Suspense>
      <PushNotificationManager />
      <MobileBottomNav />
      <main className={`relative container mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 lg:pb-8 ${isWide ? 'max-w-[1920px]' : 'max-w-[1440px]'}`}>
        <div className={`panel-glow rounded-2xl sm:rounded-3xl ${isWide ? 'p-3 sm:p-4 md:p-6' : 'p-4 sm:p-6 md:p-8'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
