'use client';

import { useMemo } from 'react';
import {
  startOfYear, endOfYear, format, isSameDay, getDay,
  eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth,
  isWithinInterval,
} from 'date-fns';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────

export const YEAR = 2025;
export const TYPE_EMOJI: Record<string, string> = { run: '🏃', bike: '🚴', swim: '🏊', strength: '💪', other: '🏋️' };
export const TYPE_LABEL: Record<string, string> = { run: 'Run', bike: 'Bike', swim: 'Swim', strength: 'Strength', other: 'Other' };
export const TYPE_COLOR: Record<string, string> = {
  run: '#ef4444', bike: '#f97316', swim: '#dc2626', strength: '#b91c1c', other: '#991b1b',
};
export const PIE_COLORS_RED = ['#ef4444', '#f97316', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'];

// ── Helpers ────────────────────────────────────────────────────────

export function toDate(w: any): Date {
  return (w.date as any)?.toDate?.() ?? new Date(w.date as any);
}

export function fmtDuration(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function fmtHours(totalMin: number): string {
  return `${Math.round(totalMin / 60)}`;
}

/** Extract distance in meters from any workout field */
function getDistanceM(w: any): number {
  if (w.actualStats?.distance) return w.actualStats.distance;
  if (w.swim?.distance) {
    return w.swim.distanceUnit === 'yards' ? w.swim.distance * 0.9144 : w.swim.distance;
  }
  if (w.bike?.distance) {
    return w.bike.distanceUnit === 'miles' ? w.bike.distance * 1609.34 : w.bike.distance * 1000;
  }
  if (w.run?.distance) {
    return w.run.distanceUnit === 'miles' ? w.run.distance * 1609.34 : w.run.distance * 1000;
  }
  return 0;
}

/** Extract duration in seconds from any workout field */
function getDurationSec(w: any): number {
  if (w.actualStats?.duration) return w.actualStats.duration;
  if (w.duration) return w.duration * 60;
  if (w.swim?.time) return w.swim.time * 60;
  if (w.bike?.time) return w.bike.time * 60;
  if (w.run?.time) return w.run.time * 60;
  if (w.strength?.totalTime) return w.strength.totalTime * 60;
  if (w.other?.duration) return w.other.duration * 60;
  return 0;
}

/** Extract elevation in meters from any workout field */
function getElevationM(w: any): number {
  return w.actualStats?.elevationGain || w.stravaData?.elevationGain || w.bike?.elevationGain || w.run?.elevationGain || 0;
}

// ── YearStats ──────────────────────────────────────────────────────

export interface YearStats {
  totalWorkouts: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  totalCalories: number;
  totalElevationM: number;
  activeDays: number;
  maxStreak: number;
  sportBreakdown: { type: string; count: number; pct: number; distanceKm: number; durationMin: number }[];
  longestByType: Record<string, { name: string; date: Date; durationMin: number; distanceKm: number }>;
  furthestByType: Record<string, { name: string; date: Date; distanceKm: number; durationMin: number }>;
  maxElevationByType: Record<string, { name: string; date: Date; elevationM: number }>;
  monthlyActivity: { month: string; count: number }[];
  heatmap: { date: Date; count: number }[];
  events: { name: string; date: Date; type: string }[];
  totalPRs: number;
}

export function computeYearStats(workouts: any[]): YearStats {
  const yearStart = startOfYear(new Date(YEAR, 0, 1));
  const yearEnd = endOfYear(new Date(YEAR, 0, 1));
  const yearWorkouts = workouts.filter(w => {
    const d = toDate(w);
    return isWithinInterval(d, { start: yearStart, end: yearEnd });
  });

  let totalDistanceM = 0, totalDurationSec = 0, totalCalories = 0, totalElevationM = 0, totalPRs = 0;
  const typeCounts: Record<string, number> = {};
  const typeDistM: Record<string, number> = {};
  const typeDurSec: Record<string, number> = {};
  const longestByType: Record<string, { name: string; date: Date; durationMin: number; distanceKm: number }> = {};
  const furthestByType: Record<string, { name: string; date: Date; distanceKm: number; durationMin: number }> = {};
  const maxElevationByType: Record<string, { name: string; date: Date; elevationM: number }> = {};

  for (const w of yearWorkouts) {
    const d = toDate(w);
    const dist = getDistanceM(w);
    const dur = getDurationSec(w);
    const elev = getElevationM(w);
    totalDistanceM += dist;
    totalDurationSec += dur;
    totalCalories += w.actualStats?.calories || 0;
    totalElevationM += elev;
    totalPRs += (w.prs?.length || 0);

    typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
    typeDistM[w.type] = (typeDistM[w.type] || 0) + dist;
    typeDurSec[w.type] = (typeDurSec[w.type] || 0) + dur;

    const durMin = dur / 60;
    const distKm = dist / 1000;

    if (!longestByType[w.type] || durMin > longestByType[w.type].durationMin) {
      longestByType[w.type] = { name: w.name, date: d, durationMin: durMin, distanceKm: distKm };
    }
    if (!furthestByType[w.type] || distKm > furthestByType[w.type].distanceKm) {
      furthestByType[w.type] = { name: w.name, date: d, distanceKm: distKm, durationMin: durMin };
    }
    if (elev > 0 && (!maxElevationByType[w.type] || elev > maxElevationByType[w.type].elevationM)) {
      maxElevationByType[w.type] = { name: w.name, date: d, elevationM: elev };
    }
  }

  // Sport breakdown
  const total = yearWorkouts.length || 1;
  const sportBreakdown = Object.entries(typeCounts)
    .map(([type, count]) => ({
      type, count,
      pct: Math.round((count / total) * 100),
      distanceKm: Math.round((typeDistM[type] || 0) / 100) / 10,
      durationMin: Math.round((typeDurSec[type] || 0) / 60),
    }))
    .sort((a, b) => b.count - a.count);

  // Active days & max streak
  const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });
  const activeDates = new Set<string>();
  for (const w of yearWorkouts) {
    activeDates.add(format(toDate(w), 'yyyy-MM-dd'));
  }
  const activeDays = activeDates.size;

  let maxStreak = 0, currentStreak = 0;
  for (const day of allDays) {
    if (activeDates.has(format(day, 'yyyy-MM-dd'))) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  // Monthly activity
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
  const monthlyActivity = months.map(m => {
    const ms = startOfMonth(m);
    const me = endOfMonth(m);
    const count = yearWorkouts.filter(w => isWithinInterval(toDate(w), { start: ms, end: me })).length;
    return { month: format(m, 'MMM'), count };
  });

  // Heatmap
  const heatmap = allDays.map(day => ({
    date: day,
    count: yearWorkouts.filter(w => isSameDay(toDate(w), day)).length,
  }));

  // Events (races tagged with 'race')
  const events = yearWorkouts
    .filter(w => w.tags?.includes('race'))
    .map(w => ({ name: w.name, date: toDate(w), type: w.type }));

  return {
    totalWorkouts: yearWorkouts.length,
    totalDistanceKm: Math.round(totalDistanceM / 100) / 10,
    totalDurationMin: Math.round(totalDurationSec / 60),
    totalCalories: Math.round(totalCalories),
    totalElevationM: Math.round(totalElevationM),
    activeDays,
    maxStreak,
    sportBreakdown,
    longestByType,
    furthestByType,
    maxElevationByType,
    monthlyActivity,
    heatmap,
    events,
    totalPRs,
  };
}

// ── Slide Type ─────────────────────────────────────────────────────

export type Slide = 'guess' | 'reveal' | 'stats' | 'breakdown' | 'records' | 'heatmap' | 'summary' | 'final';
export const SLIDES: Slide[] = ['guess', 'reveal', 'stats', 'breakdown', 'records', 'heatmap', 'summary', 'final'];
export const PUBLIC_SLIDES: Slide[] = ['stats', 'breakdown', 'records', 'heatmap', 'summary', 'final'];

// ══════════════════════════════════════════════════════════════════
// SLIDE: STATS
// ══════════════════════════════════════════════════════════════════

export function StatsSlide({ stats, animateIn }: { stats: YearStats; animateIn: boolean }) {
  const items = [
    { value: `${stats.totalDistanceKm}`, unit: 'km', label: 'Total Distance', icon: '🌍' },
    { value: fmtHours(stats.totalDurationMin), unit: 'hrs', label: 'Total Hours', icon: '⏱️' },
    { value: `${stats.activeDays}`, unit: 'days', label: 'Active Days', icon: '📅' },
    { value: `${stats.maxStreak}`, unit: 'day streak', label: 'Max Streak', icon: '🔥' },
    { value: `${Math.round(stats.totalElevationM).toLocaleString()}`, unit: 'm', label: 'Elevation Gain', icon: '⛰️' },
    { value: `${stats.totalCalories > 0 ? Math.round(stats.totalCalories / 1000) + 'k' : '-'}`, unit: 'cal', label: 'Calories Burned', icon: '🔥' },
  ];

  const gradients = [
    'from-red-500/20 to-red-900/10',
    'from-orange-500/15 to-orange-900/5',
    'from-red-600/15 to-red-900/5',
    'from-amber-500/15 to-amber-900/5',
    'from-red-700/15 to-red-900/5',
    'from-rose-500/15 to-rose-900/5',
  ];

  return (
    <div className="max-w-2xl mx-auto w-full">
      <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-6">Your {YEAR} in numbers</p>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {items.map((stat, i) => (
          <div
            key={stat.label}
            className={cn(
              'rounded-2xl border border-white/5 p-4 sm:p-5 bg-gradient-to-br transition-all duration-500',
              gradients[i],
              animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
            )}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <span className="text-2xl">{stat.icon}</span>
            <div className="mt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-white">{stat.value}</span>
                <span className="text-sm text-white/40">{stat.unit}</span>
              </div>
              <p className="text-white/30 text-xs mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
      {stats.totalElevationM > 0 && (
        <div className="mt-4 text-center">
          <p className="text-white/30 text-xs">
            That&apos;s <span className="text-red-400 font-bold">{(stats.totalElevationM / 8849).toFixed(1)}x</span> up Everest 🏔️
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SLIDE: BREAKDOWN
// ══════════════════════════════════════════════════════════════════

export function BreakdownSlide({ stats, animateIn }: { stats: YearStats; animateIn: boolean }) {
  const pieData = stats.sportBreakdown.map(s => ({
    name: TYPE_LABEL[s.type] || s.type, value: s.count, type: s.type, pct: s.pct,
  }));

  return (
    <div className="max-w-lg mx-auto w-full">
      <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-6">Workout Breakdown</p>
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
        <div className="w-48 h-48 sm:w-56 sm:h-56 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%"
                innerRadius="40%" outerRadius="80%"
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                animationBegin={0}
                animationDuration={1000}
              >
                {pieData.map((entry, i) => (
                  <Cell key={entry.type} fill={TYPE_COLOR[entry.type] || PIE_COLORS_RED[i % PIE_COLORS_RED.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-3 w-full">
          {stats.sportBreakdown.map((s, i) => (
            <div
              key={s.type}
              className={cn(
                'flex items-center gap-3 transition-all duration-500',
                animateIn ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4',
              )}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[s.type] }} />
              <div className="flex-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{TYPE_EMOJI[s.type]}</span>
                  <span className="text-white font-semibold text-sm">{TYPE_LABEL[s.type] || s.type}</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-bold">{s.count}</span>
                  <span className="text-white/30 text-xs ml-1">({s.pct}%)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.sportBreakdown.filter(s => s.distanceKm > 0 || s.durationMin > 0).map(s => (
          <div key={s.type} className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
            <span className="text-xl">{TYPE_EMOJI[s.type]}</span>
            <div className="mt-1">
              {s.distanceKm > 0 && (
                <p className="text-white font-bold text-lg">{s.distanceKm}<span className="text-white/40 text-xs ml-0.5">km</span></p>
              )}
              <p className="text-white/40 text-xs">{fmtDuration(s.durationMin)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SLIDE: RECORDS
// ══════════════════════════════════════════════════════════════════

export function RecordsSlide({ stats, animateIn }: { stats: YearStats; animateIn: boolean }) {
  return (
    <div className="max-w-lg mx-auto w-full">
      <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-6">Your Records</p>
      <div className="space-y-3">
        {Object.entries(stats.longestByType)
          .filter(([, v]) => v.durationMin > 30)
          .sort(([, a], [, b]) => b.durationMin - a.durationMin)
          .slice(0, 4)
          .map(([type, record], i) => (
            <div
              key={`longest-${type}`}
              className={cn(
                'rounded-2xl bg-gradient-to-r from-white/5 to-transparent border border-white/5 p-4 transition-all duration-500',
                animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
              )}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{TYPE_EMOJI[type]}</span>
                  <div>
                    <p className="text-white/40 text-xs">Longest {TYPE_LABEL[type] || type}</p>
                    <p className="text-white font-bold text-lg">{fmtDuration(record.durationMin)}</p>
                  </div>
                </div>
                <div className="text-right">
                  {record.distanceKm > 0 && (
                    <p className="text-red-400 font-bold">{record.distanceKm.toFixed(1)}<span className="text-xs text-red-400/60 ml-0.5">km</span></p>
                  )}
                  <p className="text-white/20 text-xs">{format(record.date, 'MMM d')}</p>
                </div>
              </div>
              <p className="text-white/30 text-xs mt-2 truncate">{record.name}</p>
            </div>
          ))}

        {Object.entries(stats.furthestByType)
          .filter(([type, v]) => v.distanceKm > 5 && v.distanceKm > (stats.longestByType[type]?.distanceKm || 0) * 0.9)
          .sort(([, a], [, b]) => b.distanceKm - a.distanceKm)
          .slice(0, 3)
          .map(([type, record], i) => {
            const longestForType = stats.longestByType[type];
            if (longestForType && longestForType.name === record.name) return null;
            return (
              <div
                key={`furthest-${type}`}
                className={cn(
                  'rounded-2xl bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/10 p-4 transition-all duration-500',
                  animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                )}
                style={{ transitionDelay: `${(i + 4) * 150}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{TYPE_EMOJI[type]}</span>
                    <div>
                      <p className="text-white/40 text-xs">Furthest {TYPE_LABEL[type] || type}</p>
                      <p className="text-red-400 font-bold text-lg">{record.distanceKm.toFixed(1)}<span className="text-xs text-red-400/60 ml-0.5">km</span></p>
                    </div>
                  </div>
                  <p className="text-white/20 text-xs">{format(record.date, 'MMM d')}</p>
                </div>
                <p className="text-white/30 text-xs mt-2 truncate">{record.name}</p>
              </div>
            );
          })}

        {stats.events.length > 0 && (
          <div className="mt-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/10 p-4">
            <p className="text-amber-400/60 text-xs font-medium tracking-widest uppercase mb-2">🏅 Events / Races</p>
            <p className="text-white font-bold text-2xl">{stats.events.length}</p>
            <div className="mt-2 space-y-1">
              {stats.events.slice(0, 5).map((e, i) => (
                <p key={i} className="text-white/50 text-xs">
                  {TYPE_EMOJI[e.type]} {e.name} · {format(e.date, 'MMM d')}
                </p>
              ))}
            </div>
          </div>
        )}

        {stats.totalPRs > 0 && (
          <div className="rounded-2xl bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/10 p-4 text-center">
            <p className="text-red-400/60 text-xs font-medium tracking-widest uppercase">Personal Records Set</p>
            <p className="text-red-400 font-black text-4xl mt-1">{stats.totalPRs}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SLIDE: HEATMAP
// ══════════════════════════════════════════════════════════════════

export function HeatmapSlide({ stats, animateIn }: { stats: YearStats; animateIn: boolean }) {
  return (
    <div className="max-w-3xl mx-auto w-full">
      <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-2">Activity Heatmap</p>
      <p className="text-white/20 text-xs mb-4">{stats.activeDays} active days out of 365</p>

      {/* Monthly bar chart */}
      <div className="mb-6">
        <div className="flex items-end gap-1 h-24">
          {stats.monthlyActivity.map((m, i) => {
            const maxCount = Math.max(...stats.monthlyActivity.map(x => x.count), 1);
            const height = (m.count / maxCount) * 100;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-white/50 text-[10px] font-bold">{m.count}</span>
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-all duration-700',
                    m.count > 0 ? 'bg-red-500' : 'bg-white/5',
                  )}
                  style={{
                    height: `${Math.max(height, 2)}%`,
                    opacity: m.count > 0 ? 0.4 + (height / 100) * 0.6 : 0.3,
                    transitionDelay: `${i * 60}ms`,
                  }}
                />
                <span className="text-white/30 text-[9px]">{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* GitHub-style heatmap */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-[2px] min-w-[680px]">
          {(() => {
            const weeks: { date: Date; count: number }[][] = [];
            let currentWeek: { date: Date; count: number }[] = [];
            const firstDay = stats.heatmap[0];
            if (firstDay) {
              const dayOfWeek = getDay(firstDay.date);
              for (let i = 0; i < dayOfWeek; i++) {
                currentWeek.push({ date: new Date(), count: -1 });
              }
            }
            for (const day of stats.heatmap) {
              currentWeek.push(day);
              if (getDay(day.date) === 6) {
                weeks.push(currentWeek);
                currentWeek = [];
              }
            }
            if (currentWeek.length > 0) weeks.push(currentWeek);
            return weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={cn(
                      'w-[11px] h-[11px] rounded-[2px] transition-all duration-300',
                      day.count < 0 ? 'bg-transparent' :
                      day.count === 0 ? 'bg-white/5' :
                      day.count === 1 ? 'bg-red-500/40' :
                      day.count === 2 ? 'bg-red-500/60' :
                      'bg-red-500',
                    )}
                    style={{ transitionDelay: `${wi * 5}ms` }}
                    title={day.count >= 0 ? `${format(day.date, 'MMM d')}: ${day.count} workout${day.count !== 1 ? 's' : ''}` : ''}
                  />
                ))}
              </div>
            ));
          })()}
        </div>
        <div className="flex items-center justify-end gap-1 mt-2">
          <span className="text-white/20 text-[9px] mr-1">Less</span>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-white/5" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-red-500/40" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-red-500/60" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-red-500" />
          <span className="text-white/20 text-[9px] ml-1">More</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SLIDE: SUMMARY (VeloViewer-style dense infographic)
// ══════════════════════════════════════════════════════════════════

function SummaryStatBox({ label, value, unit, className }: { label: string; value: string; unit?: string; className?: string }) {
  return (
    <div className={cn('text-center', className)}>
      <p className="text-white/40 text-[10px] sm:text-xs uppercase tracking-wider font-medium mb-0.5">{label}</p>
      <div className="flex items-baseline justify-center gap-0.5">
        <span className="text-white font-black text-xl sm:text-2xl leading-none">{value}</span>
        {unit && <span className="text-white/40 text-[10px] sm:text-xs">{unit}</span>}
      </div>
    </div>
  );
}

function SportRecordRow({ emoji, label, records }: {
  emoji: string;
  label: string;
  records: { label: string; value: string; unit: string }[];
}) {
  if (records.length === 0) return null;
  return (
    <div className="flex items-start gap-2 py-2 border-b border-white/5 last:border-0">
      <span className="text-lg mt-0.5">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white/50 text-[10px] uppercase tracking-wider font-medium mb-1">{label}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {records.map((r, i) => (
            <div key={i} className="flex items-baseline gap-1">
              <span className="text-white/30 text-[10px]">{r.label}</span>
              <span className="text-white font-bold text-sm">{r.value}</span>
              <span className="text-white/30 text-[10px]">{r.unit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SummarySlide({ stats, firstName, animateIn }: { stats: YearStats; firstName: string; animateIn: boolean }) {
  const everestMultiple = stats.totalElevationM > 0 ? (stats.totalElevationM / 8849).toFixed(1) : null;

  // Build per-sport records
  const bikeRecords: { label: string; value: string; unit: string }[] = [];
  if (stats.furthestByType['bike']?.distanceKm > 0) bikeRecords.push({ label: 'Max Distance', value: stats.furthestByType['bike'].distanceKm.toFixed(1), unit: 'km' });
  if (stats.maxElevationByType['bike']?.elevationM > 0) bikeRecords.push({ label: 'Max Elevation', value: `${Math.round(stats.maxElevationByType['bike'].elevationM)}`, unit: 'm' });
  if (stats.longestByType['bike']?.durationMin > 0) bikeRecords.push({ label: 'Max Time', value: fmtDuration(stats.longestByType['bike'].durationMin), unit: '' });

  const runRecords: { label: string; value: string; unit: string }[] = [];
  if (stats.furthestByType['run']?.distanceKm > 0) runRecords.push({ label: 'Max Distance', value: stats.furthestByType['run'].distanceKm.toFixed(1), unit: 'km' });
  if (stats.longestByType['run']?.durationMin > 0) runRecords.push({ label: 'Max Time', value: fmtDuration(stats.longestByType['run'].durationMin), unit: '' });
  if (stats.maxElevationByType['run']?.elevationM > 0) runRecords.push({ label: 'Max Elevation', value: `${Math.round(stats.maxElevationByType['run'].elevationM)}`, unit: 'm' });

  const swimRecords: { label: string; value: string; unit: string }[] = [];
  if (stats.furthestByType['swim']?.distanceKm > 0) swimRecords.push({ label: 'Max Distance', value: (stats.furthestByType['swim'].distanceKm * 1000).toFixed(0), unit: 'm' });
  if (stats.longestByType['swim']?.durationMin > 0) swimRecords.push({ label: 'Max Time', value: fmtDuration(stats.longestByType['swim'].durationMin), unit: '' });

  const strengthRecords: { label: string; value: string; unit: string }[] = [];
  if (stats.longestByType['strength']?.durationMin > 0) strengthRecords.push({ label: 'Max Session', value: fmtDuration(stats.longestByType['strength'].durationMin), unit: '' });

  const hasAnyRecords = bikeRecords.length > 0 || runRecords.length > 0 || swimRecords.length > 0 || strengthRecords.length > 0;

  return (
    <div className={cn(
      'max-w-3xl mx-auto w-full transition-all duration-500',
      animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
    )}>
      {/* Title banner */}
      <div className="rounded-t-2xl bg-gradient-to-r from-red-600 to-red-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-white/70 text-[10px] sm:text-xs font-medium tracking-widest uppercase">Year In Review</p>
          <p className="text-white font-black text-lg sm:text-xl">{firstName}&apos;s {YEAR}</p>
        </div>
        <div className="text-right">
          <p className="text-4xl sm:text-5xl font-black text-white/20 leading-none">{YEAR}</p>
        </div>
      </div>

      {/* Main body */}
      <div className="rounded-b-2xl border border-white/10 border-t-0 bg-gradient-to-b from-white/[0.04] to-transparent">
        {/* Top stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-0 divide-x divide-white/5 p-3 sm:p-4 border-b border-white/5">
          <SummaryStatBox label="Distance" value={`${stats.totalDistanceKm}`} unit="km" />
          <SummaryStatBox label="Active Days" value={`${stats.activeDays}`} />
          <SummaryStatBox label="Max Streak" value={`${stats.maxStreak}`} unit="days" />
          <SummaryStatBox label="Hours" value={fmtHours(stats.totalDurationMin)} className="hidden sm:block" />
          <SummaryStatBox label="Elevation" value={`${stats.totalElevationM.toLocaleString()}`} unit="m" className="hidden sm:block" />
        </div>

        {/* Mobile-only extra stats row */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-white/5 p-3 border-b border-white/5 sm:hidden">
          <SummaryStatBox label="Hours" value={fmtHours(stats.totalDurationMin)} />
          <SummaryStatBox label="Elevation" value={`${stats.totalElevationM.toLocaleString()}`} unit="m" />
        </div>

        {everestMultiple && (
          <div className="px-4 py-2 border-b border-white/5 text-center">
            <p className="text-white/30 text-[10px] sm:text-xs">
              ⛰️ <span className="text-red-400 font-bold">{everestMultiple}x</span> up Everest
            </p>
          </div>
        )}

        {/* Two-column: Sport records + Monthly chart */}
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/5">
          {/* Sport records */}
          {hasAnyRecords && (
            <div className="flex-1 p-3 sm:p-4">
              <p className="text-white/40 text-[10px] sm:text-xs uppercase tracking-wider font-medium mb-2">Sport Records</p>
              {bikeRecords.length > 0 && <SportRecordRow emoji="🚴" label="Cycling" records={bikeRecords} />}
              {runRecords.length > 0 && <SportRecordRow emoji="🏃" label="Running" records={runRecords} />}
              {swimRecords.length > 0 && <SportRecordRow emoji="🏊" label="Swimming" records={swimRecords} />}
              {strengthRecords.length > 0 && <SportRecordRow emoji="💪" label="Strength" records={strengthRecords} />}
            </div>
          )}

          {/* Monthly bar chart */}
          <div className={cn('p-3 sm:p-4', hasAnyRecords ? 'lg:w-64 xl:w-72' : 'w-full')}>
            <p className="text-white/40 text-[10px] sm:text-xs uppercase tracking-wider font-medium mb-2">Monthly Activity</p>
            <div className="flex items-end gap-[3px] h-16 sm:h-20">
              {stats.monthlyActivity.map((m, i) => {
                const maxCount = Math.max(...stats.monthlyActivity.map(x => x.count), 1);
                const height = (m.count / maxCount) * 100;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-white/40 text-[8px] font-bold">{m.count || ''}</span>
                    <div
                      className={cn(
                        'w-full rounded-t-sm transition-all duration-500',
                        m.count > 0 ? 'bg-red-500' : 'bg-white/5',
                      )}
                      style={{
                        height: `${Math.max(height, 3)}%`,
                        opacity: m.count > 0 ? 0.5 + (height / 100) * 0.5 : 0.3,
                        transitionDelay: `${i * 40}ms`,
                      }}
                    />
                    <span className="text-white/20 text-[7px] sm:text-[8px]">{m.month.charAt(0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom: workout count + breakdown chips */}
        <div className="border-t border-white/5 px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="text-white font-black text-lg">{stats.totalWorkouts}</span>
          <span className="text-white/30 text-xs">workouts</span>
          <span className="text-white/10 mx-1">|</span>
          {stats.sportBreakdown.slice(0, 4).map(s => (
            <span key={s.type} className="inline-flex items-center gap-1 text-white/40 text-[10px] sm:text-xs">
              {TYPE_EMOJI[s.type]} {s.count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SLIDE: FINAL
// ══════════════════════════════════════════════════════════════════

export function FinalSlide({ stats, firstName }: { stats: YearStats; firstName: string }) {
  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto">
      <div className="text-6xl mb-6">🏆</div>
      <h1 className="text-3xl sm:text-4xl font-bold mb-3">
        That&apos;s a wrap, <span className="text-red-500">{firstName}</span>!
      </h1>
      <p className="text-white/50 text-lg mb-3">
        {YEAR} was {stats.totalWorkouts > 200 ? 'legendary' :
          stats.totalWorkouts > 100 ? 'incredible' :
          stats.totalWorkouts > 50 ? 'impressive' : 'a great start'}.
      </p>
      <div className="flex items-center gap-4 text-white/30 text-sm mb-10">
        <span>{stats.totalWorkouts} workouts</span>
        <span>·</span>
        <span>{stats.totalDistanceKm}km</span>
        <span>·</span>
        <span>{Math.round(stats.totalDurationMin / 60)}hrs</span>
      </div>
      <p className="text-white/30 text-xs mb-6">Share your {YEAR} wrapped with friends</p>
    </div>
  );
}
