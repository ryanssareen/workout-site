'use client';

import { useMemo, useState, useEffect } from 'react';
import { Workout } from '@/types';
import { CalendarWorkoutCard } from './CalendarWorkoutCard';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  eachDayOfInterval,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarAddDropdown } from './CalendarAddDropdown';
import { DraggableWorkoutCard } from './DraggableWorkoutCard';
import { DroppableDayCell } from './DroppableDayCell';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalendarWeekViewProps {
  currentMonth: Date;
  workoutsByDate: Map<string, Workout[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onSelectWorkout: (workoutId: string) => void;
  activeTypes: Set<string>;
  maxPillsPerCell?: number;
  onNoteAdded?: () => void;
}

export function CalendarWeekView({
  currentMonth,
  workoutsByDate,
  selectedDate,
  onSelectDate,
  onSelectWorkout,
  activeTypes,
  maxPillsPerCell = 8,
  onNoteAdded,
}: CalendarWeekViewProps) {
  // Detect desktop (md breakpoint = 768px)
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const days = useMemo(() => {
    const ws = startOfWeek(currentMonth, { weekStartsOn: 1 });
    const we = isDesktop
      ? endOfWeek(addWeeks(ws, 1), { weekStartsOn: 1 }) // 2 weeks
      : endOfWeek(ws, { weekStartsOn: 1 }); // 1 week
    return eachDayOfInterval({ start: ws, end: we });
  }, [currentMonth, isDesktop]);

  // Split days into week rows
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

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

      {/* Week rows — 1 on mobile, 2 on desktop */}
      <div className={cn('flex-1 grid min-h-0', weeks.length > 1 ? 'grid-rows-2' : 'grid-rows-1')}>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className={cn('grid grid-cols-7 min-h-0', weekIndex > 0 && 'border-t')}>
            {week.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayWorkouts = (workoutsByDate.get(dateKey) || []).filter((w) =>
                activeTypes.has(w.type),
              );
              const today = isToday(day);
              const selected = selectedDate ? isSameDay(day, selectedDate) : false;
              const maxPills = isDesktop && weeks.length > 1 ? Math.min(maxPillsPerCell, 4) : maxPillsPerCell;
              const visibleWorkouts = dayWorkouts.slice(0, maxPills);
              const overflow = dayWorkouts.length - maxPills;

              return (
                <DroppableDayCell
                  key={dateKey}
                  dateKey={dateKey}
                  className={cn(
                    'group/cell border-r last:border-r-0 px-2 py-2 cursor-pointer transition-colors overflow-hidden flex flex-col',
                    selected && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
                    today && !selected && 'bg-red-500/[0.03]',
                    'hover:bg-muted/30',
                  )}
                >
                <div onClick={() => onSelectDate(day)} className="contents">
                  {/* Date number + month */}
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
                  </div>

                  {/* Workout pills + centered add button */}
                  <div className="flex-1 relative min-h-0 overflow-y-auto">
                    <div className="space-y-1">
                      {visibleWorkouts.map((workout) => (
                        <DraggableWorkoutCard
                          key={workout.id}
                          workout={workout}
                          dateKey={dateKey}
                        >
                          <CalendarWorkoutCard
                            workout={workout}
                            compact={false}
                            onSelect={onSelectWorkout}
                          />
                        </DraggableWorkoutCard>
                      ))}
                      {overflow > 0 && (
                        <div className="text-[10px] text-muted-foreground font-medium pl-1">
                          +{overflow} more
                        </div>
                      )}
                    </div>
                    {/* Add button — absolutely centered in the cell */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover/cell:opacity-100 transition-opacity">
                      <div className="pointer-events-auto">
                        <CalendarAddDropdown date={day} onNoteAdded={onNoteAdded} />
                      </div>
                    </div>
                    {dayWorkouts.length === 0 && (
                      <div className="text-[10px] text-muted-foreground/40 italic pl-1 pt-1">
                        Rest day
                      </div>
                    )}
                  </div>
                </div>
                </DroppableDayCell>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
