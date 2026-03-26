'use client';

import { useMemo } from 'react';
import { Workout } from '@/types';
import {
  eachDayOfInterval,
  subDays,
  format,
  getDay,
  isSameDay,
  startOfWeek,
} from 'date-fns';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface ActivityHeatmapProps {
  workouts: Workout[];
  days?: number; // how many days to show, default 365
}

function toDate(w: Workout): Date {
  try {
    const d = w.date?.toDate?.() ?? new Date(w.date as any);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch {
    return new Date(0);
  }
}

export function ActivityHeatmap({ workouts, days = 365 }: ActivityHeatmapProps) {
  const { grid, months, maxCount, totalActive } = useMemo(() => {
    const today = new Date();
    const start = subDays(today, days - 1);
    const allDays = eachDayOfInterval({ start, end: today });

    // Count workouts per day
    const dayCounts = new Map<string, number>();
    workouts.forEach(w => {
      if (!w.completed) return;
      const d = toDate(w);
      const key = format(d, 'yyyy-MM-dd');
      dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
    });

    let max = 0;
    let active = 0;
    const grid: { date: Date; count: number; key: string }[] = allDays.map(day => {
      const key = format(day, 'yyyy-MM-dd');
      const count = dayCounts.get(key) || 0;
      if (count > max) max = count;
      if (count > 0) active++;
      return { date: day, count, key };
    });

    // Build month labels with column positions
    const firstSunday = startOfWeek(start, { weekStartsOn: 0 });
    const startDow = getDay(start); // 0=Sun
    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;
    grid.forEach((d, i) => {
      const m = d.date.getMonth();
      if (m !== lastMonth) {
        const dayIndex = startDow + i;
        const col = Math.floor(dayIndex / 7);
        months.push({ label: MONTH_LABELS[m], col });
        lastMonth = m;
      }
    });

    return { grid, months, maxCount: max, totalActive: active };
  }, [workouts, days]);

  // Build weeks (columns) — each column is 7 days (Sun-Sat)
  const weeks: (typeof grid[number] | null)[][] = useMemo(() => {
    const result: (typeof grid[number] | null)[][] = [];
    const startDow = getDay(grid[0]?.date ?? new Date()); // 0=Sun

    // First week might start mid-week — pad leading nulls
    let currentWeek: (typeof grid[number] | null)[] = Array(startDow).fill(null);

    grid.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      result.push(currentWeek);
    }

    return result;
  }, [grid]);

  function getColor(count: number): string {
    if (count === 0) return 'var(--muted)';
    if (maxCount <= 1) return '#22c55e';
    const intensity = count / maxCount;
    if (intensity <= 0.25) return '#86efac'; // green-300
    if (intensity <= 0.5) return '#4ade80'; // green-400
    if (intensity <= 0.75) return '#22c55e'; // green-500
    return '#16a34a'; // green-600
  }

  const cellSize = 11;
  const gap = 2;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity</h2>
        <span className="text-xs text-muted-foreground">{totalActive} active days</span>
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <div style={{ minWidth: weeks.length * (cellSize + gap) + 30 }}>
          {/* Month labels */}
          <div className="relative mb-1 h-4" style={{ marginLeft: 18 }}>
            {months.map((m, i) => (
              <span
                key={i}
                className="text-[9px] text-muted-foreground/60 font-medium absolute top-0"
                style={{ left: m.col * (cellSize + gap) }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-[2px] relative">
            {/* Day labels */}
            <div className="flex flex-col gap-[2px] mr-1" style={{ width: 14 }}>
              {['', 'M', '', 'W', '', 'F', ''].map((d, i) => (
                <div key={i} className="text-[8px] text-muted-foreground/50 font-medium flex items-center justify-end" style={{ height: cellSize }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="rounded-sm transition-colors"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: day ? getColor(day.count) : 'transparent',
                      opacity: day ? (day.count > 0 ? 1 : 0.3) : 0,
                    }}
                    title={day ? `${format(day.date, 'MMM d, yyyy')}: ${day.count} workout${day.count !== 1 ? 's' : ''}` : ''}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[9px] text-muted-foreground/50">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
          <div
            key={i}
            className="rounded-sm"
            style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: getColor(Math.ceil(intensity * (maxCount || 1))),
              opacity: intensity === 0 ? 0.3 : 1,
            }}
          />
        ))}
        <span className="text-[9px] text-muted-foreground/50">More</span>
      </div>
    </div>
  );
}
