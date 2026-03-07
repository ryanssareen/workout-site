'use client';

import { forwardRef } from 'react';
import { Trophy, TrendingUp, Dumbbell } from 'lucide-react';
import { format } from 'date-fns';
import type { ConfirmedPR } from '@/types/achievements';

interface PRCardProps {
  pr: ConfirmedPR;
  date?: Date;
  userName?: string;
}

export const PRCard = forwardRef<HTMLDivElement, PRCardProps>(
  function PRCard({ pr, date, userName }, ref) {
    return (
      <div
        ref={ref}
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
        style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #2d1b00 100%)' }}
      >
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-orange-500/8 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
              <Dumbbell className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-400">The Daily Athlete</span>
          </div>
          {date && (
            <span className="text-xs text-gray-500">{format(date, 'MMM d, yyyy')}</span>
          )}
        </div>

        {/* Trophy + Label */}
        <div className="relative flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-400">
              New Personal Record
            </p>
            <p className="text-lg font-semibold text-white leading-tight">{pr.name}</p>
          </div>
        </div>

        {/* Value */}
        <div className="relative mb-4">
          <p className="text-4xl sm:text-5xl font-black text-amber-400 tracking-tight">
            {pr.value}
            <span className="text-lg sm:text-xl font-medium text-amber-400/60 ml-1">{pr.unit}</span>
          </p>
        </div>

        {/* Improvement */}
        {pr.previousValue !== undefined && (
          <div className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 w-fit">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-sm text-gray-300">
              {pr.improvement && (
                <span className="font-semibold text-green-400">{pr.improvement}</span>
              )}
              {' '}from {pr.previousValue} {pr.unit}
            </span>
          </div>
        )}

        {/* Footer */}
        {userName && (
          <div className="relative mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500">{userName}</p>
          </div>
        )}
      </div>
    );
  }
);
