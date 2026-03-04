'use client';

import { useMemo } from 'react';
import { Workout } from '@/types';
import { CalendarWorkoutCard } from './CalendarWorkoutCard';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { cn } from '@/lib/utils';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarMonthViewProps {
  currentMonth: Date;
  workoutsByDate: Map<string, Workout[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onSelectWorkout: (workoutId: string) => void;
  activeTypes: Set<string>;
  /** Max pills to show per cell before "+N more" */
  maxPillsPerCell?: number;
}

export function CalendarMonthView({
  currentMonth,
  workoutsByDate,
  selectedDate,
  onSelectDate,
  onSelectWorkout,
  activeTypes,
  maxPillsPerCell = 3,
}: CalendarMonthViewProps) {
  // Build the 6-week grid (always show 6 rows for consistent height)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  // Group days into weeks (rows of 7)
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  return (
    <div
      className="border rounded-2xl overflow-hidden flex flex-col"
      style={{ height: 'calc(100vh - 230px)' }}
    >
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 flex flex-col">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex-1 grid grid-cols-7 border-b last:border-b-0 min-h-0">
            {week.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayWorkouts = (workoutsByDate.get(dateKey) || []).filter((w) =>
                activeTypes.has(w.type),
              );
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              const selected = selectedDate ? isSameDay(day, selectedDate) : false;
              const visibleWorkouts = dayWorkouts.slice(0, maxPillsPerCell);
              const overflow = dayWorkouts.length - maxPillsPerCell;

              return (
                <div
                  key={dateKey}
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    'border-r last:border-r-0 px-1.5 py-1.5 cursor-pointer transition-colors overflow-hidden flex flex-col',
                    !inMonth && 'bg-muted/10',
                    selected && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
                    today && !selected && 'bg-red-500/[0.03]',
                    'hover:bg-muted/30',
                  )}
                >
                  {/* Date number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full',
                        !inMonth && 'text-muted-foreground/40',
                        today && 'bg-red-600 text-white',
                        !today && inMonth && 'text-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Workout mini-pills */}
                  <div className="flex-1 space-y-0.5 min-h-0 overflow-y-auto">
                    {visibleWorkouts.map((workout) => (
                      <CalendarWorkoutCard
                        key={workout.id}
                        workout={workout}
                        compact={false}
                        onSelect={onSelectWorkout}
                      />
                    ))}
                    {overflow > 0 && (
                      <div className="text-[10px] text-muted-foreground font-medium pl-1">
                        +{overflow} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
