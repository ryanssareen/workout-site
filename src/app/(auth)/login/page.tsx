'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { LoginForm } from '@/components/auth/LoginForm';
import { Loader2, Dumbbell } from 'lucide-react';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import Link from 'next/link';

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
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-red-500/15 dark:bg-red-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] bg-orange-400/10 dark:bg-red-900/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute -bottom-20 right-1/4 w-[400px] h-[400px] bg-red-400/10 dark:bg-red-600/5 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center">
            <Dumbbell className="h-4 w-4 text-background" />
          </div>
          <span className="font-bold text-lg">The Daily Athlete</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Centered form */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <LoginForm />

        {/* Social proof */}
        <div className="mt-10 flex flex-col items-center gap-4 max-w-md">
          <div className="flex -space-x-2">
            {['bg-red-400', 'bg-blue-400', 'bg-emerald-400', 'bg-purple-400', 'bg-orange-400'].map((color, i) => (
              <div key={i} className={`w-8 h-8 rounded-full ${color} border-2 border-background flex items-center justify-center text-[10px] font-bold text-white`}>
                {['R', 'K', 'M', 'J', 'S'][i]}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Trusted by <span className="font-semibold text-foreground">500+</span> athletes tracking their training
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground/60">
            <span>🏊 Swimming</span>
            <span>🏃 Running</span>
            <span>🚴 Cycling</span>
            <span>🏋️ Lifting</span>
          </div>
        </div>
      </div>
    </div>
  );
}
