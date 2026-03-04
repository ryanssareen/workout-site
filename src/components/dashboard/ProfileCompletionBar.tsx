'use client';

import { useState } from 'react';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowRight, X, UserCircle, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ProfileCompletionBarProps {
  user: User;
}

// Fields tracked for profile completion
const COMPLETION_FIELDS = [
  { key: 'displayName', label: 'Display name' },
  { key: 'ageRange', label: 'Age range' },
  { key: 'sportPreferences', label: 'Sports' },
  { key: 'trainingFor', label: 'Training goals' },
  { key: 'experienceLevel', label: 'Experience level' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
] as const;

export function getProfileCompletionInfo(user: User) {
  const completed: string[] = [];
  const missing: string[] = [];

  for (const field of COMPLETION_FIELDS) {
    const value = user[field.key as keyof User];
    const isComplete = Array.isArray(value) ? value.length > 0 : !!value;
    if (isComplete) {
      completed.push(field.label);
    } else {
      missing.push(field.label);
    }
  }

  return {
    completed: completed.length,
    total: COMPLETION_FIELDS.length,
    percentage: Math.round((completed.length / COMPLETION_FIELDS.length) * 100),
    missing,
    isComplete: completed.length === COMPLETION_FIELDS.length,
  };
}

export function ProfileCompletionBar({ user }: ProfileCompletionBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const info = getProfileCompletionInfo(user);

  if (info.isComplete || dismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-transparent">
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Icon */}
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <UserCircle className="h-6 w-6 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold">Complete your profile for better AI coaching</h3>
            </div>

            {/* Progress bar + count */}
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-xs h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                  style={{ width: `${info.percentage}%` }}
                />
              </div>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
                {info.completed}/{info.total}
              </span>
            </div>

            {/* Missing fields pills */}
            <div className="flex flex-wrap gap-1.5">
              {info.missing.map((field) => (
                <span
                  key={field}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-muted-foreground"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50">
            <Link href="/profile?edit=1">
              Complete <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
