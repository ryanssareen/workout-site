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
  isSameDay,
  isSameMonth,
  isToday,
  format,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarAddDropdown } from './CalendarAddDropdown';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalendarFullMonthViewProps {
  currentMonth: Date;
  workoutsByDate: Map<string, Workout[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onSelectWorkout: (workoutId: string) => void;
  activeTypes: Set<string>;
  maxPillsPerCell?: number;
  onNoteAdded?: () => void;
}

export function CalendarFullMonthView({
  currentMonth,
  workoutsByDate,
  selectedDate,
  onSelectDate,
  onSelectWorkout,
  activeTypes,
  maxPillsPerCell = 3,
  onNoteAdded,
}: CalendarFullMonthViewProps) {
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const result: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      result.push(allDays.slice(i, i + 7));
    }
    return result;
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
            className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
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
              const today = isToday(day);
              const selected = selectedDate ? isSameDay(day, selectedDate) : false;
              const inMonth = isSameMonth(day, currentMonth);
              const visibleWorkouts = dayWorkouts.slice(0, maxPillsPerCell);
              const overflow = dayWorkouts.length - maxPillsPerCell;

              return (
                <div
                  key={dateKey}
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    'group/cell border-r last:border-r-0 px-1 py-1 cursor-pointer transition-colors overflow-hidden flex flex-col',
                    selected && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
                    today && !selected && 'bg-red-500/[0.03]',
                    !inMonth && 'opacity-35',
                    'hover:bg-muted/30',
                  )}
                >
                  {/* Date number */}
                  <div className="flex items-center gap-1 mb-0.5">
                    <span
                      className={cn(
                        'text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0',
                        today && 'bg-red-600 text-white text-[10px]',
                        !today && 'text-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Workout micro-pills */}
                  <div className="flex-1 space-y-0.5 min-h-0 overflow-hidden">
                    {visibleWorkouts.map((workout) => (
                      <CalendarWorkoutCard
                        key={workout.id}
                        workout={workout}
                        compact={false}
                        micro
                        onSelect={onSelectWorkout}
                      />
                    ))}
                    {overflow > 0 && (
                      <div className="text-[9px] text-muted-foreground font-medium pl-0.5">
                        +{overflow} more
                      </div>
                    )}
                    {/* Add button — centered in cell */}
                    <div className="flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                      <CalendarAddDropdown date={day} onNoteAdded={onNoteAdded} />
                    </div>
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
