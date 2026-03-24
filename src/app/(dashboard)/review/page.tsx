'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { Workout, WorkoutType } from '@/types';
import {
  startOfMonth, endOfMonth, subMonths, isWithinInterval, format,
  eachDayOfInterval, isSameDay, getDay, isBefore, startOfWeek, endOfWeek, eachWeekOfInterval,
} from 'date-fns';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import { Share2, Loader2, ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

// ── Constants ──

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '🏋️',
};
const TYPE_NAME: Record<string, string> = {
  run: 'Running', bike: 'Cycling', swim: 'Swimming', walk: 'Walking', strength: 'Strength', other: 'Other',
};
const TYPE_COLOR: Record<string, string> = {
  run: '#22c55e', bike: '#f97316', swim: '#3b82f6', walk: '#10b981', strength: '#a855f7', other: '#6b7280',
};
const TYPE_BG: Record<string, string> = {
  run: 'from-green-500/20 to-green-500/5', bike: 'from-orange-500/20 to-orange-500/5',
  swim: 'from-blue-500/20 to-blue-500/5', walk: 'from-emerald-500/20 to-emerald-500/5',
  strength: 'from-purple-500/20 to-purple-500/5', other: 'from-gray-500/20 to-gray-500/5',
};
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ── Helpers ──

function toDate(w: Workout): Date {
  return w.date?.toDate?.() ?? new Date(w.date as any);
}

interface SportStat {
  type: WorkoutType; count: number; distanceKm: number; durationMin: number;
  calories: number; prevCount: number; prevDistanceKm: number; prevDurationMin: number;
}

function computeMonthlySportStats(thisMonth: Workout[], lastMonth: Workout[]): SportStat[] {
  const types = new Set<WorkoutType>();
  [...thisMonth, ...lastMonth].forEach(w => types.add(w.type));
  return Array.from(types).map(type => {
    const tm = thisMonth.filter(w => w.type === type);
    const lm = lastMonth.filter(w => w.type === type);
    const sumDist = (ws: Workout[]) => ws.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / 1000;
    const sumDur = (ws: Workout[]) => ws.reduce((s, w) => {
      if (w.actualStats?.duration) return s + w.actualStats.duration / 60;
      if (w.duration) return s + w.duration; return s;
    }, 0);
    const sumCal = (ws: Workout[]) => ws.reduce((s, w) => s + (w.actualStats?.calories || 0), 0);
    return {
      type, count: tm.length,
      distanceKm: Math.round(sumDist(tm) * 10) / 10, durationMin: Math.round(sumDur(tm)),
      calories: Math.round(sumCal(tm)), prevCount: lm.length,
      prevDistanceKm: Math.round(sumDist(lm) * 10) / 10, prevDurationMin: Math.round(sumDur(lm)),
    };
  }).sort((a, b) => b.count - a.count);
}

function getMonthRating(stats: SportStat[]): { word: string; emoji: string; color: string } {
  const c = stats.reduce((s, st) => s + st.count, 0);
  const p = stats.reduce((s, st) => s + st.prevCount, 0);
  if (c === 0) return { word: 'quiet', emoji: '😴', color: 'text-muted-foreground' };
  if (p === 0) return { word: 'a great start', emoji: '🚀', color: 'text-blue-400' };
  const r = c / p;
  if (r >= 1.3) return { word: 'incredible', emoji: '🔥', color: 'text-orange-400' };
  if (r >= 1.1) return { word: 'productive', emoji: '💪', color: 'text-emerald-400' };
  if (r >= 0.9) return { word: 'consistent', emoji: '✅', color: 'text-green-400' };
  return { word: 'a recovery month', emoji: '🧘', color: 'text-purple-400' };
}

function pctChange(curr: number, prev: number): { text: string; positive: boolean; pct: number } | null {
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return { text: 'new', positive: true, pct: 100 };
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return { text: `+${pct}%`, positive: true, pct };
  if (pct < 0) return { text: `${pct}%`, positive: false, pct };
  return { text: '=', positive: true, pct: 0 };
}

const fmtDur = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };

// ── Activity Calendar Component ──

function ActivityCalendar({ days, monthStart }: { days: { date: Date; count: number }[]; monthStart: Date }) {
  const rawDay = getDay(monthStart); // 0=Sun in JS
  const firstDayOfWeek = rawDay === 0 ? 6 : rawDay - 1; // Convert to Mon=0
  const blanks = Array.from({ length: firstDayOfWeek });
  const today = new Date();

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-[9px] text-muted-foreground/50 text-center font-semibold py-0.5">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-[3px]">
        {blanks.map((_, i) => <div key={`b-${i}`} className="h-9 sm:h-10" />)}
        {days.map((d) => {
          const isToday = isSameDay(d.date, today);
          const active = d.count > 0;
          return (
            <div
              key={format(d.date, 'd')}
              className={cn(
                'h-9 sm:h-10 flex items-center justify-center rounded-lg transition-colors',
                active
                  ? 'bg-emerald-500/20'
                  : 'bg-transparent',
                isToday && 'ring-1.5 ring-primary/50',
              )}
              title={`${format(d.date, 'MMM d')}: ${d.count} workout${d.count !== 1 ? 's' : ''}`}
            >
              <span className={cn(
                'text-xs font-bold leading-none',
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/40',
                isToday && 'text-primary',
              )}>
                {format(d.date, 'd')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──

export default function MonthlyReviewPage() {
  const user = useAuthStore((s) => s.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      if (workouts.length === 0) setLoading(true);
      const { getWorkouts } = useWorkoutStore.getState();
      const data = await getWorkouts(user.username, user.role);
      setWorkouts(data);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const now = new Date();
  const targetMonthStart = startOfMonth(subMonths(now, monthOffset));
  const targetMonthEnd = endOfMonth(targetMonthStart);
  const prevMonthStart = startOfMonth(subMonths(targetMonthStart, 1));
  const prevMonthEnd = endOfMonth(prevMonthStart);
  const monthLabel = format(targetMonthStart, 'MMMM yyyy');
  const isCurrentMonth = monthOffset === 0;

  // Month hasn't ended yet — gate
  const monthNotFinished = !isBefore(targetMonthEnd, now);

  const thisMonthWorkouts = useMemo(
    () => workouts.filter(w => isWithinInterval(toDate(w), { start: targetMonthStart, end: targetMonthEnd })),
    [workouts, targetMonthStart, targetMonthEnd],
  );
  const lastMonthWorkouts = useMemo(
    () => workouts.filter(w => isWithinInterval(toDate(w), { start: prevMonthStart, end: prevMonthEnd })),
    [workouts, prevMonthStart, prevMonthEnd],
  );

  const sportStats = useMemo(() => computeMonthlySportStats(thisMonthWorkouts, lastMonthWorkouts), [thisMonthWorkouts, lastMonthWorkouts]);
  const rating = useMemo(() => getMonthRating(sportStats), [sportStats]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: targetMonthStart, end: targetMonthEnd });
    return days.map(day => ({
      date: day,
      count: thisMonthWorkouts.filter(w => isSameDay(toDate(w), day)).length,
    }));
  }, [thisMonthWorkouts, targetMonthStart, targetMonthEnd]);

  // Daily activity bar chart data
  const dailyBarData = useMemo(() => {
    return calendarDays.map(d => {
      const dayWorkouts = thisMonthWorkouts.filter(w => isSameDay(toDate(w), d.date));
      const typeCounts: Record<string, number> = {};
      dayWorkouts.forEach(w => { typeCounts[w.type] = (typeCounts[w.type] || 0) + 1; });
      const primaryType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      return { date: d.date, count: d.count, primaryType };
    });
  }, [calendarDays, thisMonthWorkouts]);

  // Weekly volume data
  const weeklyVolume = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: targetMonthStart, end: targetMonthEnd }, { weekStartsOn: 1 });
    return weeks.map((weekStart, i) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const wkWorkouts = thisMonthWorkouts.filter(w => {
        const d = toDate(w);
        return d >= weekStart && d <= weekEnd;
      });
      const dist = Math.round(wkWorkouts.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / 100) / 10;
      const dur = Math.round(wkWorkouts.reduce((s, w) => {
        if (w.actualStats?.duration) return s + w.actualStats.duration / 60;
        if (w.duration) return s + w.duration; return s;
      }, 0));
      return { weekNum: i + 1, count: wkWorkouts.length, distKm: dist, durMin: dur };
    });
  }, [thisMonthWorkouts, targetMonthStart, targetMonthEnd]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    thisMonthWorkouts.forEach(w => { counts[w.type] = (counts[w.type] || 0) + 1; });
    return Object.entries(counts).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1), value: count, type,
      pct: Math.round((count / thisMonthWorkouts.length) * 100),
    })).sort((a, b) => b.value - a.value);
  }, [thisMonthWorkouts]);

  const totalWorkouts = thisMonthWorkouts.length;
  const totalDistanceKm = Math.round(sportStats.reduce((s, st) => s + st.distanceKm, 0) * 10) / 10;
  const totalDurationMin = sportStats.reduce((s, st) => s + st.durationMin, 0);
  const totalDurationHrs = Math.round(totalDurationMin / 6) / 10;
  const prevTotalWorkouts = lastMonthWorkouts.length;
  const activeDays = calendarDays.filter(d => d.count > 0).length;
  const totalDays = calendarDays.length;
  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/review` : '';
  const shareText = `${rating.emoji} My ${format(targetMonthStart, 'MMMM')} in review: ${totalWorkouts} workouts, ${totalDistanceKm}km, ${totalDurationHrs}hrs — The Daily Athlete`;

  const prevDistKm = Math.round(lastMonthWorkouts.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / 100) / 10;
  const prevDurMin = Math.round(lastMonthWorkouts.reduce((s, w) => { if (w.actualStats?.duration) return s + w.actualStats.duration / 60; if (w.duration) return s + w.duration; return s; }, 0));

  const maxDailyCount = Math.max(...dailyBarData.map(d => d.count), 1);
  const maxWeeklyCount = Math.max(...weeklyVolume.map(w => w.count), 1);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // ══ Nav bar (always visible) ══
  const navBar = (
    <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] bg-background/80 backdrop-blur-xl border-b border-border/20">
      <Link href="/dashboard" className="p-1.5 -ml-1 rounded-full hover:bg-muted transition-colors">
        <X className="h-4 w-4 text-muted-foreground" />
      </Link>
      <div className="flex items-center gap-1.5">
        <button onClick={() => setMonthOffset(o => o + 1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <span className="text-sm font-bold text-foreground min-w-[110px] text-center">{monthLabel}</span>
        <button disabled={isCurrentMonth} onClick={() => setMonthOffset(o => Math.max(0, o - 1))}
          className="p-1.5 rounded-full hover:bg-muted transition-colors disabled:opacity-20">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <ThemeToggle />
    </div>
  );

  // ══ "Not ready" gate for current / future month ══
  if (monthNotFinished) {
    return (
      <div className="fixed inset-0 bg-background overflow-y-auto">
        {navBar}
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted/40 flex items-center justify-center mb-6">
            <Calendar className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {format(targetMonthStart, 'MMMM')} isn&apos;t over yet!
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Your monthly review will be ready once {format(targetMonthStart, 'MMMM yyyy')} wraps up. Come back after {format(targetMonthEnd, 'MMMM d')} to see your full stats.
          </p>
          <button
            onClick={() => setMonthOffset(1)}
            className="mt-6 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            View {format(subMonths(now, 1), 'MMMM')} instead
          </button>
        </div>
      </div>
    );
  }

  // ══ Full review ══
  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      {navBar}

      <div ref={cardRef} className="w-full max-w-[calc(100vw-1rem)] sm:max-w-2xl lg:max-w-4xl mx-auto px-2 sm:px-6 py-5 space-y-4">

        {/* ═══ Hero — month, rating, big stats ═══ */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 border border-border/30 p-5 sm:p-6">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase mb-1">Month in Review</p>
          <h2 className="text-foreground text-2xl sm:text-3xl font-black tracking-tight leading-none mb-0.5" style={{ WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility' }}>
            {monthLabel}
          </h2>
          <h1 className="text-foreground text-base sm:text-lg font-medium leading-tight mb-5">
            Dear {firstName}, this was <span className={`font-bold ${rating.color}`}>{rating.word}</span> {rating.emoji}
          </h1>
          {/* Stat badges — 4 across */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              { value: String(totalWorkouts), label: 'workouts' },
              { value: `${totalDistanceKm}km`, label: 'distance' },
              { value: `${totalDurationHrs}h`, label: 'time' },
              { value: `${activeDays}/${totalDays}`, label: 'active days' },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-foreground/5 border border-border/20 py-3 text-center">
                <p className="text-2xl font-black text-foreground leading-none">{s.value}</p>
                <p className="text-[9px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ vs Last Month — card-style comparison ═══ */}
        {prevTotalWorkouts > 0 && (() => {
          const items = [
            { label: 'Workouts', curr: totalWorkouts, prev: prevTotalWorkouts, fmt: (v: number) => String(v) },
            { label: 'Distance', curr: totalDistanceKm, prev: prevDistKm, fmt: (v: number) => `${v}km` },
            { label: 'Time', curr: totalDurationMin, prev: prevDurMin, fmt: (v: number) => fmtDur(v) },
          ];
          return (
            <div className="rounded-2xl bg-muted/10 border border-border/20 p-4 sm:p-5">
              <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">vs {format(prevMonthStart, 'MMMM')}</h2>
              <div className="grid grid-cols-3 gap-3">
                {items.map(item => {
                  const change = pctChange(item.curr, item.prev);
                  const isUp = change && change.pct > 0;
                  const isDown = change && change.pct < 0;
                  return (
                    <div key={item.label} className="rounded-xl bg-foreground/[0.03] border border-border/10 p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1.5">
                        {isUp ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> : isDown ? <TrendingDown className="h-3.5 w-3.5 text-red-400" /> : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className={cn(
                          'text-sm font-black',
                          isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-muted-foreground',
                        )}>
                          {change?.text || '='}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{item.fmt(item.prev)} → {item.fmt(item.curr)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ═══ Two-column: Activity Calendar + Breakdown ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Activity Calendar */}
          <div className="rounded-2xl bg-muted/10 border border-border/20 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Activity</h2>
              <span className="text-[10px] text-emerald-500 font-medium">{activeDays} active days</span>
            </div>
            <ActivityCalendar days={calendarDays} monthStart={targetMonthStart} />
          </div>

          {/* Breakdown — horizontal stacked bar */}
          {pieData.length > 0 && (
            <div className="rounded-2xl bg-muted/10 border border-border/20 p-4 sm:p-5">
              <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Breakdown</h2>
              <div className="flex h-5 rounded-full overflow-hidden mb-3">
                {pieData.map(e => (
                  <div
                    key={e.type}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${e.pct}%`, backgroundColor: TYPE_COLOR[e.type] || '#6b7280' }}
                  />
                ))}
              </div>
              <div className="space-y-2 mt-4">
                {pieData.map(e => (
                  <div key={e.type} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[e.type] || '#6b7280' }} />
                    <span className="text-xs text-foreground font-medium flex-1">{TYPE_NAME[e.type] || e.name}</span>
                    <span className="text-xs text-muted-foreground">{e.value} workouts</span>
                    <span className="text-xs font-bold text-foreground w-10 text-right">{e.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Daily Activity Bar Chart ═══ */}
        <div className="rounded-2xl bg-muted/10 border border-border/20 p-4 sm:p-5">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Daily Activity</h2>
          <div className="flex items-end gap-px h-24 sm:h-32">
            {dailyBarData.map((d, i) => {
              const barH = d.count > 0 ? Math.max(8, (d.count / maxDailyCount) * 100) : 0;
              const color = d.primaryType ? (TYPE_COLOR[d.primaryType] || '#6b7280') : '#6b7280';
              const isFirstOfWeek = i > 0 && d.date.getDay() === 1;
              return (
                <div
                  key={i}
                  className={cn('flex-1 flex flex-col items-center justify-end', isFirstOfWeek && 'ml-1')}
                  title={`${format(d.date, 'MMM d')}: ${d.count} workout${d.count !== 1 ? 's' : ''}`}
                >
                  <div
                    className="w-full rounded-sm transition-all duration-300"
                    style={{
                      height: `${barH}%`,
                      backgroundColor: d.count > 0 ? color : 'transparent',
                      opacity: d.count > 0 ? 0.65 : 0,
                      minHeight: d.count > 0 ? 4 : 0,
                    }}
                  />
                  {d.count === 0 && <div className="w-full h-px bg-muted-foreground/10" />}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-muted-foreground/50">{format(targetMonthStart, 'MMM d')}</span>
            <span className="text-[9px] text-muted-foreground/50">{format(targetMonthEnd, 'MMM d')}</span>
          </div>
        </div>

        {/* ═══ Weekly Volume ═══ */}
        {weeklyVolume.length > 1 && (
          <div className="rounded-2xl bg-muted/10 border border-border/20 p-4 sm:p-5">
            <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Weekly Volume</h2>
            <div className="flex items-end gap-2 sm:gap-4 h-28 sm:h-32">
              {weeklyVolume.map((w, i) => {
                const barH = w.count > 0 ? Math.max(16, (w.count / maxWeeklyCount) * 100) : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full flex flex-col items-center justify-end flex-1">
                      {w.count > 0 && (
                        <span className="text-[10px] font-bold text-foreground mb-1">{w.count}</span>
                      )}
                      <div
                        className="w-full rounded-lg bg-primary/60 transition-all duration-500"
                        style={{ height: `${barH}%`, minHeight: w.count > 0 ? 16 : 0, opacity: w.count > 0 ? 1 : 0 }}
                      />
                      {w.count === 0 && <div className="w-full h-1 rounded-full bg-muted-foreground/10" />}
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-muted-foreground font-medium block">Wk {w.weekNum}</span>
                      {w.distKm > 0 && <span className="text-[9px] text-muted-foreground/60">{w.distKm}km</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ By Sport — grid on wider screens ═══ */}
        <div className="space-y-2">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">By Sport</h2>
          {sportStats.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 text-center py-6">No workouts this month</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sportStats.map(stat => {
                const metric = stat.distanceKm > 0 ? `${stat.distanceKm}km` : stat.durationMin > 0 ? fmtDur(stat.durationMin) : `${stat.count}x`;
                const detail = stat.distanceKm > 0
                  ? `${stat.count} sessions · ${fmtDur(stat.durationMin)}`
                  : `${stat.count} sessions`;
                const comp = stat.distanceKm > 0 ? pctChange(stat.distanceKm, stat.prevDistanceKm) : stat.durationMin > 0 ? pctChange(stat.durationMin, stat.prevDurationMin) : pctChange(stat.count, stat.prevCount);
                return (
                  <div key={stat.type} className={`flex items-center gap-3 rounded-xl bg-gradient-to-r ${TYPE_BG[stat.type] || TYPE_BG.other} border border-border/20 px-4 py-3`}>
                    <span className="text-2xl">{TYPE_EMOJI[stat.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground leading-tight" style={{ color: TYPE_COLOR[stat.type] }}>
                        {TYPE_NAME[stat.type] || stat.type}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {metric} · {detail}
                      </p>
                    </div>
                    {comp && <span className={`text-xs font-black ${comp.positive ? 'text-emerald-400' : 'text-red-400'}`}>{comp.text}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ Footer branding ═══ */}
        <div className="pt-2 pb-3 text-center">
          <p className="text-[10px] text-muted-foreground/50 font-medium tracking-wider uppercase">The Daily Athlete</p>
        </div>
      </div>

      {/* ═══ Share ═══ */}
      <div className="sticky bottom-0 z-20 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-xl border-t border-border/30">
        <div className="max-w-[calc(100vw-1rem)] sm:max-w-2xl lg:max-w-4xl mx-auto">
          {showShare ? (
            <ShareButtons
              title={`${format(targetMonthStart, 'MMMM yyyy')} Review`}
              shareText={shareText}
              shareUrl={shareUrl}
              fileName={`monthly-review-${format(targetMonthStart, 'yyyy-MM')}`}
              cardRef={cardRef}
              onClose={() => setShowShare(false)}
            />
          ) : (
            <button
              onClick={() => setShowShare(true)}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold bg-foreground text-background hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
