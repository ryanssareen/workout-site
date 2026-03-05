'use client';

import { useRef, useCallback } from 'react';
import { Workout } from '@/types';
import { TYPE_CONFIG } from './types';
import {
  format,
  eachDayOfInterval,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface MobileWeekStripProps {
  weekStart: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onWeekChange: (weekStart: Date) => void;
  workoutsByDate: Map<string, Workout[]>;
}

export function MobileWeekStrip({
  weekStart,
  selectedDate,
  onSelectDate,
  onWeekChange,
  workoutsByDate,
}: MobileWeekStripProps) {
  const weekEnd = addDays(weekStart, 6);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Swipe handling
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(delta) > 60) {
        if (delta > 0) {
          onWeekChange(subWeeks(weekStart, 1));
        } else {
          onWeekChange(addWeeks(weekStart, 1));
        }
      }
      touchStartX.current = null;
    },
    [weekStart, onWeekChange],
  );

  return (
    <div>
      {/* Day circles */}
      <div
        className="grid grid-cols-7 gap-1"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {weekDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayWorkouts = workoutsByDate.get(dateKey) || [];
          const selected = isSameDay(day, selectedDate);
          const today = isToday(day);

          // Collect unique workout type colors for dots
          const typeDots = Array.from(
            new Set(dayWorkouts.map((w) => w.type)),
          ).slice(0, 3);

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                'flex flex-col items-center py-2 rounded-xl transition-all',
                selected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : today
                    ? 'bg-red-500/10'
                    : 'hover:bg-muted',
              )}
            >
              {/* Day abbreviation */}
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider',
                  selected ? 'text-primary-foreground/70' : 'text-muted-foreground',
                )}
              >
                {format(day, 'EEE')}
              </span>

              {/* Date number */}
              <span
                className={cn(
                  'text-lg font-black mt-0.5',
                  selected && 'text-primary-foreground',
                  !selected && today && 'text-red-600',
                )}
              >
                {format(day, 'd')}
              </span>

              {/* Active label or workout dots */}
              {selected ? (
                <span className="text-[9px] font-bold uppercase tracking-wider text-primary-foreground/70 mt-0.5">
                  Active
                </span>
              ) : (
                <div className="flex items-center gap-0.5 mt-1 h-2">
                  {typeDots.map((type) => {
                    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.other;
                    // Map text color classes to actual dot colors
                    const dotColor =
                      type === 'run'
                        ? 'bg-red-500'
                        : type === 'bike'
                          ? 'bg-amber-500'
                          : type === 'swim'
                            ? 'bg-cyan-500'
                            : type === 'strength'
                              ? 'bg-purple-500'
                              : 'bg-gray-400';
                    return (
                      <div
                        key={type}
                        className={cn('w-1.5 h-1.5 rounded-full', dotColor)}
                      />
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
