'use client';

import { useMemo } from 'react';
import { Workout } from '@/types';
import { CalendarViewMode } from './types';
import {
  startOfYear,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  isToday,
  isSameDay,
} from 'date-fns';
import { cn } from '@/lib/utils';

const DAY_HEADERS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface CalendarYearViewProps {
  currentMonth: Date;
  workoutsByDate: Map<string, Workout[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
}

function getWorkoutCountColor(count: number): string {
  if (count === 0) return 'bg-muted/40';
  if (count === 1) return 'bg-green-500/30';
  if (count === 2) return 'bg-green-500/60';
  return 'bg-green-500';
}

export function CalendarYearView({
  currentMonth,
  workoutsByDate,
  selectedDate,
  onSelectDate,
  onViewModeChange,
}: CalendarYearViewProps) {
  const year = currentMonth.getFullYear();

  const months = useMemo(() => {
    const yearStart = startOfYear(currentMonth);
    const yearEnd = new Date(year, 11, 31);
    return eachMonthOfInterval({ start: yearStart, end: yearEnd });
  }, [year, currentMonth]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
        {months.map((month) => (
          <MiniMonth
            key={format(month, 'yyyy-MM')}
            month={month}
            workoutsByDate={workoutsByDate}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              onSelectDate(date);
              onViewModeChange('day');
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-0.5">
          <div className="w-3 h-3 rounded-sm bg-muted/40" />
          <div className="w-3 h-3 rounded-sm bg-green-500/30" />
          <div className="w-3 h-3 rounded-sm bg-green-500/60" />
          <div className="w-3 h-3 rounded-sm bg-green-500" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

function MiniMonth({
  month,
  workoutsByDate,
  selectedDate,
  onSelectDate,
}: {
  month: Date;
  workoutsByDate: Map<string, Workout[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}) {
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const result: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      result.push(allDays.slice(i, i + 7));
    }
    return result;
  }, [month]);

  const monthNum = month.getMonth();

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {format(month, 'MMMM')}
      </h3>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-0.5">
        {DAY_HEADERS_SHORT.map((d, i) => (
          <div key={i} className="text-[8px] text-muted-foreground/60 text-center font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="grid grid-cols-7 gap-0.5">
          {week.map((day) => {
            const inMonth = day.getMonth() === monthNum;
            if (!inMonth) {
              return <div key={day.toISOString()} className="w-full aspect-square" />;
            }

            const dateKey = format(day, 'yyyy-MM-dd');
            const count = (workoutsByDate.get(dateKey) || []).length;
            const today = isToday(day);
            const selected = selectedDate ? isSameDay(day, selectedDate) : false;

            return (
              <button
                key={dateKey}
                onClick={() => onSelectDate(day)}
                title={`${format(day, 'MMM d')}: ${count} workout${count !== 1 ? 's' : ''}`}
                className={cn(
                  'w-full aspect-square rounded-sm transition-all',
                  getWorkoutCountColor(count),
                  today && 'ring-1 ring-red-500',
                  selected && 'ring-1 ring-primary',
                  'hover:ring-1 hover:ring-foreground/30',
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
