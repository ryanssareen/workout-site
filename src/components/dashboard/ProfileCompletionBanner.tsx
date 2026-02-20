'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { X, UserCircle } from 'lucide-react';
import Link from 'next/link';

function calculateCompletion(user: { displayName?: string; photoURL?: string; bio?: string; timezone?: string; sportPreferences?: string[]; fitnessGoals?: string[]; notificationPreferences?: { emailSummary: boolean; workoutReminders: boolean; coachMessages: boolean; } | undefined }) {
  let score = 0;
  if (user.displayName) score += 20;
  if (user.photoURL) score += 10;
  if (user.bio) score += 15;
  if (user.timezone) score += 15;
  if (user.sportPreferences && user.sportPreferences.length > 0) score += 15;
  if (user.fitnessGoals && user.fitnessGoals.length > 0) score += 15;
  if (user.notificationPreferences) score += 10;
  return score;
}

export function ProfileCompletionBanner() {
  const user = useAuthStore((state) => state.user);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(sessionStorage.getItem('profile-banner-dismissed') === 'true');
    }
  }, []);

  const completion = useMemo(() => {
    if (!user) return 100;
    return calculateCompletion(user);
  }, [user]);

  if (!user || completion >= 100 || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('profile-banner-dismissed', 'true');
  };

  const getMessage = () => {
    if (completion < 40) return 'Complete your profile to get personalized workouts';
    if (completion < 70) return "You're making progress! A few more details to unlock full personalization";
    return 'Almost there! Finish your profile for the best experience';
  };

  return (
    <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-2 duration-500">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-4 pr-6">
        <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <UserCircle className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{getMessage()}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {completion}%
            </span>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/profile">Complete Profile</Link>
        </Button>
      </div>
    </div>
  );
}
