'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { LoginForm } from '@/components/auth/LoginForm';
import { Loader2, Activity, Bike, Dumbbell, Waves, Target } from 'lucide-react';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const needsUsername = useAuthStore((state) => state.needsUsername);

  useEffect(() => {
    if (!loading && needsUsername) {
      router.replace('/choose-username');
      return;
    }
    if (!loading && user) {
      if (user.onboardingCompleted === false) {
        router.replace('/onboarding');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, needsUsername, router]);

  if (!loading && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-red-500/15 dark:bg-red-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] bg-orange-400/10 dark:bg-red-900/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute -bottom-20 right-1/4 w-[400px] h-[400px] bg-red-400/10 dark:bg-red-600/5 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      {/* Floating sport icons — decorative */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
        <div className="absolute top-[15%] left-[10%] w-12 h-12 rounded-2xl bg-orange-500/10 dark:bg-orange-500/5 border border-orange-500/10 flex items-center justify-center rotate-[-12deg]">
          <Activity className="h-5 w-5 text-orange-400/50" />
        </div>
        <div className="absolute top-[25%] right-[8%] w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/10 flex items-center justify-center rotate-[8deg]">
          <Waves className="h-5 w-5 text-blue-400/50" />
        </div>
        <div className="absolute bottom-[20%] left-[8%] w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center rotate-[15deg]">
          <Bike className="h-5 w-5 text-emerald-400/50" />
        </div>
        <div className="absolute bottom-[30%] right-[12%] w-12 h-12 rounded-2xl bg-purple-500/10 dark:bg-purple-500/5 border border-purple-500/10 flex items-center justify-center rotate-[-8deg]">
          <Dumbbell className="h-5 w-5 text-purple-400/50" />
        </div>
        <div className="absolute top-[60%] left-[18%] w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/10 flex items-center justify-center rotate-[5deg]">
          <Target className="h-5 w-5 text-amber-400/50" />
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <LoginForm />
    </div>
  );
}
