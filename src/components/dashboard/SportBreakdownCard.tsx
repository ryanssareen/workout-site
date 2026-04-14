'use client';

import { useState, useMemo } from 'react';
import { subWeeks, subMonths, subYears } from 'date-fns';
import { ChevronDown, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Workout } from '@/types';

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '📋',
};

export const TIME_RANGES = [
  { label: 'Last Week', value: 'week' },
  { label: 'Last Month', value: 'month' },
  { label: 'Last 3 Months', value: '3months' },
  { label: 'Last Year', value: 'year' },
  { label: 'All Time', value: 'all' },
] as const;

export type TimeRange = (typeof TIME_RANGES)[number]['value'];

export function getTimeRangeCutoff(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case 'week': return subWeeks(now, 1);
    case 'month': return subMonths(now, 1);
    case '3months': return subMonths(now, 3);
    case 'year': return subYears(now, 1);
    case 'all': return null;
  }
}

function getWorkoutDate(w: Workout): Date {
  try {
    const d = w.date?.toDate?.() ?? new Date(w.date as any);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch { return new Date(0); }
}

export function SportBreakdownCard({ workouts }: { workouts: Workout[] }) {
  const [range, setRange] = useState<TimeRange>('month');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const cutoff = getTimeRangeCutoff(range);
    return workouts.filter(w => {
      if (!w.completed) return false;
      if (!cutoff) return true;
      const d = getWorkoutDate(w);
      return d >= cutoff;
    });
  }, [workouts, range]);

  const breakdown = useMemo(() => {
    const types: Record<string, number> = {};
    filtered.forEach(w => { types[w.type] = (types[w.type] || 0) + 1; });
    return Object.entries(types).sort(([, a], [, b]) => b - a);
  }, [filtered]);

  const total = filtered.length;
  const currentLabel = TIME_RANGES.find(r => r.value === range)!.label;

  const TYPE_COLORS: Record<string, string> = {
    run: 'bg-red-500', bike: 'bg-amber-500', swim: 'bg-cyan-500',
    walk: 'bg-emerald-500', strength: 'bg-purple-500', other: 'bg-gray-500',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-red-500" />Sport Breakdown
          </CardTitle>
          <div className="relative">
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
            >
              {currentLabel}
              <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                  {TIME_RANGES.map(r => (
                    <button
                      key={r.value}
                      onClick={() => { setRange(r.value); setOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors',
                        r.value === range ? 'text-foreground font-medium' : 'text-muted-foreground'
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No completed workouts in this period</p>
        ) : (
          <div className="space-y-2.5">
            {breakdown.slice(0, 5).map(([type, count]) => {
              const pct = Math.round((count / total) * 100);
              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>{TYPE_EMOJI[type] || '📋'}</span>
                      <span className="capitalize font-medium">{type}</span>
                    </span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', TYPE_COLORS[type] || 'bg-gray-500')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
