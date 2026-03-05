'use client';

import { useMemo } from 'react';
import { Workout } from '@/types';
import { CalendarWorkoutCard } from './CalendarWorkoutCard';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarAddDropdown } from './CalendarAddDropdown';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarWeekViewProps {
  currentMonth: Date;
  workoutsByDate: Map<string, Workout[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onSelectWorkout: (workoutId: string) => void;
  activeTypes: Set<string>;
  maxPillsPerCell?: number;
}

export function CalendarWeekView({
  currentMonth,
  workoutsByDate,
  selectedDate,
  onSelectDate,
  onSelectWorkout,
  activeTypes,
  maxPillsPerCell = 8,
}: CalendarWeekViewProps) {
  const days = useMemo(() => {
    const ws = startOfWeek(currentMonth, { weekStartsOn: 0 });
    const we = endOfWeek(currentMonth, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: ws, end: we });
  }, [currentMonth]);

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

      {/* Single week row */}
      <div className="flex-1 grid grid-cols-7 min-h-0">
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayWorkouts = (workoutsByDate.get(dateKey) || []).filter((w) =>
            activeTypes.has(w.type),
          );
          const today = isToday(day);
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const visibleWorkouts = dayWorkouts.slice(0, maxPillsPerCell);
          const overflow = dayWorkouts.length - maxPillsPerCell;

          return (
            <div
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                'group/cell border-r last:border-r-0 px-2 py-2 cursor-pointer transition-colors overflow-hidden flex flex-col',
                selected && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
                today && !selected && 'bg-red-500/[0.03]',
                'hover:bg-muted/30',
              )}
            >
              {/* Date number + month + add button */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className={cn(
                    'text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full shrink-0',
                    today && 'bg-red-600 text-white',
                    !today && 'text-foreground',
                  )}
                >
                  {format(day, 'd')}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase truncate flex-1">
                  {format(day, 'MMM')}
                </span>
                <CalendarAddDropdown date={day} className="opacity-0 group-hover/cell:opacity-100 transition-opacity" />
              </div>

              {/* Workout pills */}
              <div className="flex-1 space-y-1 min-h-0 overflow-y-auto">
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
                {dayWorkouts.length === 0 && (
                  <div className="text-[10px] text-muted-foreground/40 italic pl-1 pt-1">
                    Rest day
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
