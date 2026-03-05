'use client';

import { TYPE_CONFIG, formatDurLong } from './types';
import { Timer, Route } from 'lucide-react';

interface CalendarSummaryProps {
  completed: number;
  total: number;
  totalDuration: number;
  totalDistance: number;
  byType: Record<string, { count: number; duration: number; distance: number }>;
  periodLabel?: string;
}

export function CalendarSummary({
  completed,
  total,
  totalDuration,
  totalDistance,
  byType,
  periodLabel,
}: CalendarSummaryProps) {
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-4 md:gap-6 px-4 md:px-5 py-2.5 md:py-3 rounded-xl border bg-muted/20 overflow-x-auto">
      {/* Period label */}
      {periodLabel && (
        <>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            {periodLabel}
          </span>
          <div className="h-8 w-px bg-border shrink-0" />
        </>
      )}

      {/* Completion ring */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative w-9 h-9 md:w-10 md:h-10">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
            <circle
              cx="20" cy="20" r="16" fill="none" stroke="currentColor"
              strokeWidth="3" className="text-muted/40"
            />
            <circle
              cx="20" cy="20" r="16" fill="none" stroke="currentColor"
              strokeWidth="3" className="text-green-500"
              strokeDasharray={`${completionPct * 1.005} 100.5`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
            {completionPct}%
          </span>
        </div>
        <div>
          <div className="text-xs font-bold">{completed}/{total}</div>
          <div className="text-[10px] text-muted-foreground">completed</div>
        </div>
      </div>

      <div className="h-8 w-px bg-border shrink-0" />

      {/* Total time */}
      <div className="shrink-0">
        <div className="text-xs font-bold flex items-center gap-1">
          <Timer className="h-3 w-3 opacity-50" />
          {formatDurLong(totalDuration)}
        </div>
        <div className="text-[10px] text-muted-foreground">total time</div>
      </div>

      {/* Distance */}
      {totalDistance > 0 && (
        <>
          <div className="h-8 w-px bg-border shrink-0" />
          <div className="shrink-0">
            <div className="text-xs font-bold flex items-center gap-1">
              <Route className="h-3 w-3 opacity-50" />
              {totalDistance.toFixed(1)} km
            </div>
            <div className="text-[10px] text-muted-foreground">distance</div>
          </div>
        </>
      )}

      <div className="h-8 w-px bg-border shrink-0" />

      {/* Type breakdown */}
      <div className="flex items-center gap-3 shrink-0">
        {Object.entries(byType)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([type, data]) => {
            const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.other;
            return (
              <div key={type} className="flex items-center gap-1">
                <span className="text-sm">{cfg.emoji}</span>
                <span className="text-xs font-bold">{data.count}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{type}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
