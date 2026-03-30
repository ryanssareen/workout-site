'use client';

import { Workout } from '@/types';
import { CalendarWorkoutCard } from './CalendarWorkoutCard';
import { format, isPast, isToday } from 'date-fns';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { safeToDate } from '@/lib/dateUtils';

interface CalendarDayWorkoutsProps {
  date: Date;
  workouts: Workout[];
  onToggleComplete?: (e: React.MouseEvent, workout: Workout) => void;
}

export function CalendarDayWorkouts({
  date,
  workouts,
  onToggleComplete,
}: CalendarDayWorkoutsProps) {
  const today = isToday(date);
  const past = isPast(date) && !today;

  // Split workouts into planned (future/upcoming) and past/completed
  const planned = workouts.filter((w) => {
    const wDate = safeToDate(w);
    return !isPast(wDate) || isToday(wDate);
  });
  const pastWorkouts = workouts.filter((w) => {
    const wDate = safeToDate(w);
    return isPast(wDate) && !isToday(wDate);
  });

  // For a single selected day, show all workouts together
  // The planned/past split is more useful when showing multiple days
  const allWorkouts = workouts;

  const dateStr = format(date, 'yyyy-MM-dd');

  return (
    <div className="space-y-3">
      {/* Day header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {format(date, 'EEE')}
          </h3>
          <p className="text-2xl font-black">{format(date, 'd')}</p>
        </div>
        {allWorkouts.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {allWorkouts.length} workout{allWorkouts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Workout cards */}
      {allWorkouts.length > 0 ? (
        <div className="space-y-2">
          {allWorkouts.map((workout) => (
            <CalendarWorkoutCard
              key={workout.id}
              workout={workout}
              compact
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 opacity-40 gap-2">
          <div className="text-3xl">🌿</div>
          <span className="text-sm text-muted-foreground font-medium">
            Rest day
          </span>
        </div>
      )}

      {/* + Add Plan button */}
      <Link
        href={`/workouts/new?date=${dateStr}`}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border border-dashed border-muted-foreground/20 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-200"
      >
        <Plus className="h-4 w-4" />
        Add Plan
      </Link>
    </div>
  );
}
