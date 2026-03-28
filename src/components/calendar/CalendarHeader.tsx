'use client';

import { CalendarViewMode } from './types';
import { CalendarViewSelector } from './CalendarViewSelector';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Send,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CalendarHeaderProps {
  currentMonth: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  // Coach features
  isCoach?: boolean;
  athletes?: { uid: string; displayName: string }[];
  selectedAthlete?: string;
  onSelectAthlete?: (uid: string) => void;
  // Actions
  onExport?: () => void;
  onSendReport?: () => void;
  sendingReport?: boolean;
}

function getDateLabel(viewMode: CalendarViewMode, currentMonth: Date): string {
  switch (viewMode) {
    case 'day':
      return format(currentMonth, 'EEE, MMM d, yyyy');
    case 'week': {
      const ws = startOfWeek(currentMonth, { weekStartsOn: 1 });
      const we = endOfWeek(currentMonth, { weekStartsOn: 1 });
      const we2 = endOfWeek(addWeeks(ws, 1), { weekStartsOn: 1 });
      // Desktop shows 2-week range, mobile shows 1-week
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
        return `${format(ws, 'MMM d')} – ${format(we2, 'MMM d, yyyy')}`;
      }
      return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
    }
    case 'month':
      return format(currentMonth, 'MMMM yyyy');
    case 'year':
      return format(currentMonth, 'yyyy');
  }
}

export function CalendarHeader({
  currentMonth,
  onPrev,
  onNext,
  onToday,
  viewMode,
  onViewModeChange,
  isCoach,
  athletes = [],
  selectedAthlete = 'all',
  onSelectAthlete,
  onExport,
  onSendReport,
  sendingReport,
}: CalendarHeaderProps) {
  return (
    <div className="space-y-2">
      {/* Main header row */}
      <div className="flex items-center justify-between">
        {/* Left: Today + navigation + view selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToday}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={onPrev}
            className="p-2 rounded-xl border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={onNext}
            className="p-2 rounded-xl border hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {/* View selector — desktop */}
          <div className="hidden md:block ml-1">
            <CalendarViewSelector viewMode={viewMode} onViewModeChange={onViewModeChange} />
          </div>
        </div>

        {/* Center: Date label + Add Workout */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg md:text-xl font-bold tracking-tight uppercase">
            <span className="hidden md:inline">
              {getDateLabel(viewMode, currentMonth)}
            </span>
            <span className="md:hidden text-base">
              {getDateLabel(viewMode, currentMonth)}
            </span>
          </h1>
          <Link
            href="/workouts/new"
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Workout
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Coach athlete picker */}
          {isCoach && athletes.length > 0 && (
            <select
              value={selectedAthlete}
              onChange={(e) => onSelectAthlete?.(e.target.value)}
              className="hidden md:block px-3 py-1.5 rounded-lg text-xs font-semibold border bg-background cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/30"
            >
              {athletes.map((a) => (
                <option key={a.uid} value={a.uid}>
                  {a.displayName}
                </option>
              ))}
            </select>
          )}

          {/* Desktop action buttons */}
          <button
            onClick={onExport}
            className="hidden md:flex p-2 rounded-xl border hover:bg-muted transition-colors"
            title="Export calendar"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={onSendReport}
            disabled={sendingReport}
            className="hidden md:flex p-2 rounded-xl border hover:bg-muted transition-colors"
            title="Email report"
          >
            <Send className="h-4 w-4" />
          </button>

          {/* Mobile overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="md:hidden p-2 rounded-xl border hover:bg-muted transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/workouts/new" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Workout
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Calendar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSendReport} disabled={sendingReport}>
                <Send className="h-4 w-4 mr-2" />
                Email Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile: View selector + filter pills */}
      <div className="md:hidden">
        <CalendarViewSelector viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>

      {/* Mobile athlete picker */}
      {isCoach && athletes.length > 0 && (
        <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <select
            value={selectedAthlete}
            onChange={(e) => onSelectAthlete?.(e.target.value)}
            className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-background cursor-pointer"
          >
            <option value="all">All Athletes</option>
            {athletes.map((a) => (
              <option key={a.uid} value={a.uid}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
