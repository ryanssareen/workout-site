'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { LoginForm } from '@/components/auth/LoginForm';
import { Loader2, Dumbbell, Activity, TrendingUp, Sparkles } from 'lucide-react';
import { Calendar } from 'lucide-react';
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center">
            <Dumbbell className="h-4 w-4 text-background" />
          </div>
          <span className="font-bold text-lg">The Daily Athlete</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Main content — fills remaining space */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20 px-6 pb-8">
        {/* Left — headline + features (visible on lg+) */}
        <div className="hidden lg:flex flex-col max-w-sm space-y-6">
          <h2 className="text-4xl font-black leading-tight">
            Train smarter.{' '}
            <span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">
              Track everything.
            </span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Join athletes who plan, track, and improve across every sport — all in one place.
          </p>
          <div className="space-y-3 pt-2">
            {[
              { icon: Activity, text: 'Auto-sync from Strava & wearables', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/15' },
              { icon: Calendar, text: 'Visual calendar to plan your week', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/15' },
              { icon: TrendingUp, text: 'Track PRs, trends, and streaks', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/15' },
              { icon: Sparkles, text: 'AI-powered workout suggestions', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/15' },
            ].map((f, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${f.bg}`}>
                <f.icon className={`h-5 w-5 ${f.color} shrink-0`} />
                <span className="text-sm font-medium text-foreground/80">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <LoginForm />
      </div>
    </div>
  );
}
