'use client';

import { cn } from '@/lib/utils';
import { CalendarViewMode } from './types';

const VIEW_OPTIONS: { value: CalendarViewMode; label: string; shortLabel: string }[] = [
  { value: 'day', label: 'Day', shortLabel: 'D' },
  { value: 'week', label: 'Week', shortLabel: 'W' },
  { value: 'month', label: 'Month', shortLabel: 'M' },
  { value: 'year', label: 'Year', shortLabel: 'Y' },
];

interface CalendarViewSelectorProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
}

export function CalendarViewSelector({ viewMode, onViewModeChange }: CalendarViewSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
      {VIEW_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onViewModeChange(opt.value)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
            viewMode === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          )}
        >
          <span className="hidden sm:inline">{opt.label}</span>
          <span className="sm:hidden">{opt.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
