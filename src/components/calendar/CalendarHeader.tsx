'use client';

import { TYPE_CONFIG } from './types';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Send,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CalendarHeaderProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onToday: () => void;
  activeTypes: Set<string>;
  onToggleType: (type: string) => void;
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

export function CalendarHeader({
  currentMonth,
  onMonthChange,
  onToday,
  activeTypes,
  onToggleType,
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
        {/* Left: Today + navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToday}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => onMonthChange(subWeeks(currentMonth, 2))}
            className="p-2 rounded-xl border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMonthChange(addWeeks(currentMonth, 2))}
            className="p-2 rounded-xl border hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Center: 2-week date range */}
        <h1 className="text-lg md:text-xl font-bold tracking-tight uppercase">
          <span className="hidden md:inline">
            {format(startOfWeek(currentMonth, { weekStartsOn: 0 }), 'MMM d')}
            {' – '}
            {format(endOfWeek(addWeeks(startOfWeek(currentMonth, { weekStartsOn: 0 }), 1), { weekStartsOn: 0 }), 'MMM d, yyyy')}
          </span>
          <span className="md:hidden">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
        </h1>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Type filters — desktop only */}
          <div className="hidden lg:flex items-center gap-1.5 mr-2">
            {(['run', 'bike', 'swim', 'strength', 'other'] as const).map((type) => {
              const active = activeTypes.has(type);
              const cfg = TYPE_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => onToggleType(type)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                    active
                      ? `${cfg.bg} ${cfg.color} border-current/20`
                      : 'border-border text-muted-foreground/40',
                  )}
                >
                  {cfg.emoji} {type}
                </button>
              );
            })}
          </div>

          {/* Coach athlete picker */}
          {isCoach && athletes.length > 0 && (
            <select
              value={selectedAthlete}
              onChange={(e) => onSelectAthlete?.(e.target.value)}
              className="hidden md:block px-3 py-1.5 rounded-lg text-xs font-semibold border bg-background cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/30"
            >
              <option value="all">All Athletes</option>
              {athletes.map((a) => (
                <option key={a.uid} value={a.uid}>
                  {a.displayName}
                </option>
              ))}
            </select>
          )}

          {/* Add Workout button */}
          <Link
            href="/workouts/new"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Workout
          </Link>

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

      {/* Mobile filter pills — horizontally scrollable */}
      <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {(['run', 'bike', 'swim', 'strength', 'other'] as const).map((type) => {
          const active = activeTypes.has(type);
          const cfg = TYPE_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                active
                  ? `${cfg.bg} ${cfg.color} border-current/20`
                  : 'border-border text-muted-foreground/40',
              )}
            >
              {cfg.emoji} {type}
            </button>
          );
        })}
        {/* Mobile athlete picker inline */}
        {isCoach && athletes.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
