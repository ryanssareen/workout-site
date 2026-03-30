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
    <div className="min-h-screen flex bg-background">
      {/* Left — branded panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-red-600 via-red-700 to-red-900 items-center justify-center p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-white/5 rounded-full blur-[80px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-black/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-orange-500/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <Dumbbell className="h-7 w-7 text-white" />
          </div>

          <h2 className="text-4xl font-black text-white leading-tight">
            Train smarter.<br />
            Track everything.
          </h2>

          <p className="text-lg text-white/70 leading-relaxed">
            Join athletes who plan, track, and improve across every sport — all in one place.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { icon: Activity, label: 'Run' },
              { icon: Waves, label: 'Swim' },
              { icon: Bike, label: 'Cycle' },
              { icon: Dumbbell, label: 'Lift' },
              { icon: Target, label: 'Tri' },
              { icon: Activity, label: '& more' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                <s.icon className="h-4 w-4 text-white/80" />
                <span className="text-sm font-medium text-white/80">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-white/20 border-2 border-red-700 flex items-center justify-center text-xs font-bold text-white/60">
                  {['R', 'S', 'M', 'A'][i]}
                </div>
              ))}
            </div>
            <p className="text-sm text-white/60">
              Athletes already training
            </p>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-100/70 dark:bg-red-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] bg-orange-50 dark:bg-red-900/10 rounded-full blur-[100px]" />
        </div>

        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
