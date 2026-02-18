'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';
import { Loader2, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [name, setName] = useState(user?.displayName || '');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'intro' | 'name'>('intro');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    if (user.onboardingCompleted !== false) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    setName(user?.displayName || '');
  }, [user?.displayName]);

  useEffect(() => {
    if (step === 'name') {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [step]);

  const handleSubmit = async () => {
    if (!user) return;
    setError('');

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    setChecking(true);
    try {
      const res = await fetch('/api/ai/profanity-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!data.isClean) {
        setError(data.reason || 'That name contains inappropriate language. Profanity is not allowed — please choose a different name.');
        setChecking(false);
        return;
      }
    } catch {
      // Allow through if the checker is temporarily unavailable.
    }
    setChecking(false);

    setSaving(true);
    try {
      await updateDoc(doc(getDbInstance(), 'users', user.uid), {
        displayName: trimmed,
        onboardingCompleted: true,
        updatedAt: serverTimestamp(),
      });

      setUser({
        ...user,
        displayName: trimmed,
        onboardingCompleted: true,
      });

      toast.success(`Welcome, ${trimmed}!`);
      router.replace('/profile?edit=1');
    } catch {
      toast.error('Failed to save name');
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.onboardingCompleted !== false) {
    return null;
  }

  const isLoading = checking || saving;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Animated gradient orb behind */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10 overflow-hidden">
          <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/20 via-orange-400/10 to-rose-500/15 blur-3xl animate-pulse" />
        </div>

        {step === 'intro' && (
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Logo / icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-2xl shadow-primary/30">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary to-orange-500 opacity-20 blur-lg" />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                Welcome to{' '}
                <span className="bg-gradient-to-r from-primary via-orange-500 to-rose-500 bg-clip-text text-transparent">
                  CoachTrack
                </span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Your personal training companion. Let&apos;s get you set up in seconds.
              </p>
            </div>

            <button
              onClick={() => setStep('name')}
              className={cn(
                'group inline-flex items-center gap-3 px-8 py-4 rounded-2xl',
                'bg-gradient-to-r from-primary to-orange-500',
                'text-white font-semibold text-lg',
                'shadow-xl shadow-primary/25',
                'hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.02]',
                'transition-all duration-300 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background'
              )}
            >
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {step === 'name' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Step indicator */}
            <div className="flex items-center gap-2 justify-center">
              <div className="w-8 h-1 rounded-full bg-primary" />
              <div className="w-8 h-1 rounded-full bg-muted" />
              <div className="w-8 h-1 rounded-full bg-muted" />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                What is your name?
              </h2>
              <p className="text-muted-foreground">
                This is how your coach and teammates will see you.
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  maxLength={50}
                  placeholder="Type your name..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoading) {
                      handleSubmit();
                    }
                  }}
                  className={cn(
                    'w-full px-6 py-5 text-xl sm:text-2xl font-medium rounded-2xl',
                    'bg-card border-2 transition-all duration-200',
                    'placeholder:text-muted-foreground/40',
                    'focus:outline-none focus:ring-0',
                    error
                      ? 'border-destructive focus:border-destructive'
                      : 'border-border focus:border-primary'
                  )}
                />
                {name.length > 0 && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums">
                    {name.length}/50
                  </span>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isLoading || name.trim().length < 2}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-8 py-4 rounded-2xl',
                  'font-semibold text-lg transition-all duration-300',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
                  name.trim().length >= 2 && !isLoading
                    ? 'bg-gradient-to-r from-primary to-orange-500 text-white shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.01]'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {checking ? 'Checking name...' : 'Setting up...'}
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              You can always change your name later in your profile settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
