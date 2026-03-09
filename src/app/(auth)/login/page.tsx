'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { LoginForm } from '@/components/auth/LoginForm';
import { Loader2, Sun, Moon } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const needsUsername = useAuthStore((state) => state.needsUsername);
  const [isDark, setIsDark] = useState(false);

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

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {isDark ? (
          <>
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
            <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[100px]" />
            <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-red-600/5 rounded-full blur-[80px]" />
            <div className="absolute top-1/4 right-1/4 w-[350px] h-[350px] bg-red-800/8 rounded-full blur-[110px]" />
          </>
        ) : (
          <>
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-100/70 rounded-full blur-[120px]" />
            <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] bg-orange-50 rounded-full blur-[100px]" />
            <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-red-50 rounded-full blur-[80px]" />
          </>
        )}
      </div>

      <button
        onClick={() => setIsDark(!isDark)}
        aria-label="Toggle theme"
        className={`absolute top-4 right-4 z-10 p-2.5 rounded-full transition-all duration-200 ${
          isDark
            ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
        }`}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <LoginForm dark={isDark} />
    </div>
  );
}
