'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { Workout, WorkoutType } from '@/types';
import {
  startOfMonth, endOfMonth, subMonths, isWithinInterval, format,
  eachDayOfInterval, isSameDay, getDay, isBefore, startOfWeek, endOfWeek, eachWeekOfInterval,
} from 'date-fns';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import { Share2, Loader2, ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { useSwipe } from '@/hooks/useSwipe';

// ── Animated counter hook ──
function useCountUp(target: number, duration = 1200, enabled = true) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, enabled]);
  return value;
}

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
  try {
    const d = w.date?.toDate?.() ?? new Date(w.date as any);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch { return new Date(0); }
}

interface SportStat {
  type: WorkoutType; count: number; distanceKm: number; durationMin: number;
  calories: number; prevCount: number; prevDistanceKm: number; prevDurationMin: number;
}

function computeMonthlySportStats(thisMonth: Workout[], prevMonths: Workout[], numPrevMonths: number): SportStat[] {
  const types = new Set<WorkoutType>();
  [...thisMonth, ...prevMonths].forEach(w => types.add(w.type));
  const divisor = Math.max(numPrevMonths, 1);
  return Array.from(types).map(type => {
    const tm = thisMonth.filter(w => w.type === type);
    const pm = prevMonths.filter(w => w.type === type);
    const sumDist = (ws: Workout[]) => ws.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / 1000;
    const sumDur = (ws: Workout[]) => ws.reduce((s, w) => {
      if (w.actualStats?.duration) return s + w.actualStats.duration / 60;
      if (w.duration) return s + w.duration; return s;
    }, 0);
    const sumCal = (ws: Workout[]) => ws.reduce((s, w) => s + (w.actualStats?.calories || 0), 0);
    return {
      type, count: tm.length,
      distanceKm: Math.round(sumDist(tm) * 10) / 10, durationMin: Math.round(sumDur(tm)),
      calories: Math.round(sumCal(tm)),
      prevCount: Math.round(pm.length / divisor),
      prevDistanceKm: Math.round(sumDist(pm) / divisor * 10) / 10,
      prevDurationMin: Math.round(sumDur(pm) / divisor),
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
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [slide, setSlide] = useState(0);
  const [animateIn, setAnimateIn] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [showShare, setShowShare] = useState(false);
  const TOTAL_SLIDES = 5;

  useEffect(() => { setAnimateIn(false); const t = setTimeout(() => setAnimateIn(true), 50); return () => clearTimeout(t); }, [slide]);
  useEffect(() => { setSlide(0); }, [monthOffset]);
  const goNext = useCallback(() => setSlide(s => Math.min(s + 1, TOTAL_SLIDES - 1)), []);
  const goPrev = useCallback(() => setSlide(s => Math.max(s - 1, 0)), []);
  const swipeHandlers = useSwipe(goNext, goPrev);

  useEffect(() => {
    async function load() {
      if (!user) return;
      if (workouts.length === 0) setLoading(true);
      setError(null);
      try {
        const { getWorkouts } = useWorkoutStore.getState();
        const data = await getWorkouts(user.username, user.role);
        setWorkouts(data);
      } catch (err) {
        console.error('Failed to load review data:', err);
        if (workouts.length === 0) {
          setError('Could not load workout data. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const now = new Date();
  const targetMonthStart = startOfMonth(subMonths(now, monthOffset));
  const targetMonthEnd = endOfMonth(targetMonthStart);
  // Compare against average of previous 6 months instead of just 1
  const PREV_MONTHS_COUNT = 6;
  const prevWindowStart = startOfMonth(subMonths(targetMonthStart, PREV_MONTHS_COUNT));
  const prevWindowEnd = endOfMonth(subMonths(targetMonthStart, 1));
  const monthLabel = format(targetMonthStart, 'MMMM yyyy');
  const isCurrentMonth = monthOffset === 0;

  // Month hasn't ended yet — gate
  const monthNotFinished = !isBefore(targetMonthEnd, now);

  const thisMonthWorkouts = useMemo(
    () => workouts.filter(w => isWithinInterval(toDate(w), { start: targetMonthStart, end: targetMonthEnd })),
    [workouts, targetMonthStart, targetMonthEnd],
  );
  const prevMonthsWorkouts = useMemo(
    () => workouts.filter(w => {
      const d = toDate(w);
      return d >= prevWindowStart && d <= prevWindowEnd;
    }),
    [workouts, prevWindowStart, prevWindowEnd],
  );

  const sportStats = useMemo(() => computeMonthlySportStats(thisMonthWorkouts, prevMonthsWorkouts, PREV_MONTHS_COUNT), [thisMonthWorkouts, prevMonthsWorkouts]);
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
  const prevTotalWorkouts = Math.round(prevMonthsWorkouts.length / PREV_MONTHS_COUNT);
  const activeDays = calendarDays.filter(d => d.count > 0).length;
  const totalDays = calendarDays.length;
  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/review` : '';
  const shareText = `${rating.emoji} My ${format(targetMonthStart, 'MMMM')} in review: ${totalWorkouts} workouts, ${totalDistanceKm}km, ${totalDurationHrs}hrs — The Daily Athlete`;

  const prevDistKm = Math.round(prevMonthsWorkouts.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / PREV_MONTHS_COUNT / 100) / 10;
  const prevDurMin = Math.round(prevMonthsWorkouts.reduce((s, w) => { if (w.actualStats?.duration) return s + w.actualStats.duration / 60; if (w.duration) return s + w.duration; return s; }, 0) / PREV_MONTHS_COUNT);

  const maxDailyCount = Math.max(...dailyBarData.map(d => d.count), 1);
  const maxWeeklyCount = Math.max(...weeklyVolume.map(w => w.count), 1);

  // Animated counters — MUST be called before any early returns (React hooks rule)
  const countWorkouts = useCountUp(totalWorkouts, 1000, slide === 1 && animateIn && !loading);
  const countDist = useCountUp(Math.round(totalDistanceKm), 1200, slide === 1 && animateIn && !loading);
  const countDur = useCountUp(totalDurationMin, 1400, slide === 1 && animateIn && !loading);
  const countDays = useCountUp(activeDays, 1600, slide === 1 && animateIn && !loading);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading review...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">😴</div>
          <h2 className="text-lg font-semibold">Data unavailable</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link href="/dashboard" className="inline-block text-sm text-primary hover:underline">
            Back to Dashboard
          </Link>
        </div>
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

  const progressPct = ((slide + 1) / TOTAL_SLIDES) * 100;

  // ══ Full review — slide-based ══
  return (
    <div className="fixed inset-0 bg-background overflow-hidden flex flex-col">
      {navBar}

      {/* Slide content — swipeable */}
      <div
        ref={cardRef}
        {...swipeHandlers}
        className={cn(
          'flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-20 transition-all duration-500 select-none',
          animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        )}
      >
        {/* ═══ SLIDE 0 — The Verdict ═══ */}
        {slide === 0 && (
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <div className="text-8xl sm:text-9xl mb-6" style={{ animation: animateIn ? 'popIn 0.6s ease-out' : undefined }}>
              {rating.emoji}
            </div>
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-2">Month in Review</p>
            <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight leading-tight mb-3">
              {format(targetMonthStart, 'MMMM')} was<br />
              <span className={rating.color}>{rating.word}</span>
            </h1>
            <p className="text-muted-foreground text-sm">{format(targetMonthStart, 'MMMM yyyy')}</p>
            <button onClick={goNext} className="mt-10 group flex items-center gap-2 text-primary text-sm font-semibold hover:opacity-80 transition-opacity">
              See the numbers <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* ═══ SLIDE 1 — The Numbers ═══ */}
        {slide === 1 && (
          <div className="w-full max-w-4xl mx-auto">
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-8 text-center">By The Numbers</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {[
                { value: countWorkouts, unit: '', label: 'workouts', emoji: '💪', delay: '0ms' },
                { value: countDays, unit: `/${totalDays}`, label: 'active days', emoji: '📅', delay: '150ms' },
                ...(totalDistanceKm > 0 ? [{ value: countDist, unit: 'km', label: 'distance', emoji: '🌍', delay: '300ms' }] : []),
                ...(totalDurationMin > 0 ? [{ value: countDur > 60 ? Math.floor(countDur / 60) : countDur, unit: countDur > 60 ? 'hrs' : 'min', label: 'training', emoji: '⏱️', delay: '450ms' }] : []),
              ].map(stat => (
                <div
                  key={stat.label}
                  className="text-center rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-border/30 p-6 sm:p-8 transition-all duration-700"
                  style={{ opacity: animateIn ? 1 : 0, transform: animateIn ? 'scale(1)' : 'scale(0.9)', transitionDelay: stat.delay }}
                >
                  <div className="text-3xl mb-2">{stat.emoji}</div>
                  <div className="text-4xl sm:text-5xl font-black text-foreground tracking-tighter leading-none">
                    {stat.value}<span className="text-primary">{stat.unit}</span>
                  </div>
                  <p className="text-muted-foreground text-sm mt-2 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SLIDE 2 — vs 6-Month Average ═══ */}
        {slide === 2 && (
          <div className="flex flex-col items-center max-w-4xl mx-auto w-full">
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-8 text-center">vs 6-Month Average</p>
            {prevTotalWorkouts > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                {[
                  { label: 'Workouts', curr: totalWorkouts, prev: prevTotalWorkouts, fmtFn: (v: number) => String(v) },
                  { label: 'Distance', curr: totalDistanceKm, prev: prevDistKm, fmtFn: (v: number) => `${v}km` },
                  { label: 'Time', curr: totalDurationMin, prev: prevDurMin, fmtFn: (v: number) => fmtDur(v) },
                ].map((item, i) => {
                  const change = pctChange(item.curr, item.prev);
                  const isUp = change && change.pct > 0;
                  const isDown = change && change.pct < 0;
                  return (
                    <div
                      key={item.label}
                      className="flex flex-col items-center text-center rounded-3xl bg-foreground/[0.03] border border-border/20 p-6 sm:p-8 transition-all duration-500"
                      style={{ opacity: animateIn ? 1 : 0, transform: animateIn ? 'scale(1)' : 'scale(0.9)', transitionDelay: `${i * 150}ms` }}
                    >
                      <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-3', isUp ? 'bg-emerald-500/15' : isDown ? 'bg-red-500/15' : 'bg-muted')}>
                        {isUp ? <TrendingUp className="h-7 w-7 text-emerald-500" /> : isDown ? <TrendingDown className="h-7 w-7 text-red-500" /> : <Minus className="h-7 w-7 text-muted-foreground" />}
                      </div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">{item.label}</p>
                      <span className={cn('text-3xl sm:text-4xl font-black', isUp ? 'text-emerald-500' : isDown ? 'text-red-500' : 'text-muted-foreground')}>
                        {change?.text || '='}
                      </span>
                      <p className="text-xs text-muted-foreground/60 mt-2">{item.fmtFn(item.prev)} → {item.fmtFn(item.curr)}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">🚀</div>
                <p className="text-foreground font-bold text-lg">First month tracked!</p>
                <p className="text-muted-foreground text-sm mt-1">Comparison will show up next month</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ SLIDE 3 — Calendar + Daily Chart ═══ */}
        {slide === 3 && (
          <div className="max-w-4xl mx-auto w-full overflow-y-auto max-h-[calc(100vh-200px)]">
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-6 text-center">Your Calendar</p>

            {/* Activity Calendar */}
            <div className="rounded-2xl bg-muted/10 border border-border/20 p-4 sm:p-5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-foreground">{format(targetMonthStart, 'MMMM yyyy')}</span>
                <span className="text-xs text-emerald-500 font-bold">{activeDays} active days</span>
              </div>
              <ActivityCalendar days={calendarDays} monthStart={targetMonthStart} />
            </div>

            {/* Daily bar chart */}
            <div className="rounded-2xl bg-muted/10 border border-border/20 p-4 sm:p-5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Daily Activity</p>
              <div className="flex items-end gap-px h-32 sm:h-44">
                {dailyBarData.map((d, i) => {
                  const barH = d.count > 0 ? Math.max(8, (d.count / maxDailyCount) * 100) : 0;
                  const color = d.primaryType ? (TYPE_COLOR[d.primaryType] || '#6b7280') : '#6b7280';
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end">
                      <div
                        className="w-full rounded-sm transition-all"
                        style={{
                          height: animateIn ? `${barH}%` : '0%',
                          backgroundColor: d.count > 0 ? color : 'transparent',
                          opacity: d.count > 0 ? 0.7 : 0,
                          minHeight: d.count > 0 ? 4 : 0,
                          transitionDuration: '600ms',
                          transitionDelay: `${i * 15}ms`,
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
          </div>
        )}

        {/* ═══ SLIDE 4 — Sport Breakdown + Share ═══ */}
        {slide === 4 && (
          <div className="max-w-4xl mx-auto w-full overflow-y-auto max-h-[calc(100vh-200px)]">
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-6 text-center">Sport Breakdown</p>

            {/* Breakdown bar */}
            {pieData.length > 0 && (
              <div className="mb-6">
                <div className="flex h-6 rounded-full overflow-hidden mb-3">
                  {pieData.map((e, i) => (
                    <div
                      key={e.type}
                      className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                      style={{ width: animateIn ? `${e.pct}%` : '0%', backgroundColor: TYPE_COLOR[e.type] || '#6b7280', transitionDuration: '800ms', transitionDelay: `${i * 100}ms` }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
                  {pieData.map(e => (
                    <div key={e.type} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLOR[e.type] || '#6b7280' }} />
                      <span className="text-xs text-muted-foreground font-semibold">{TYPE_NAME[e.type]} {e.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sport cards */}
            {sportStats.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">😴</div>
                <p className="text-muted-foreground">No workouts this month</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {sportStats.filter(s => s.count > 0).map((stat, i) => {
                  const metric = stat.distanceKm > 0 ? `${stat.distanceKm}km` : stat.durationMin > 0 ? fmtDur(stat.durationMin) : `${stat.count}x`;
                  const detail = stat.distanceKm > 0 ? `${stat.count} sessions · ${fmtDur(stat.durationMin)}` : `${stat.count} sessions`;
                  const comp = stat.distanceKm > 0 ? pctChange(stat.distanceKm, stat.prevDistanceKm) : stat.durationMin > 0 ? pctChange(stat.durationMin, stat.prevDurationMin) : pctChange(stat.count, stat.prevCount);
                  return (
                    <div
                      key={stat.type}
                      className={`flex items-center gap-4 rounded-2xl bg-gradient-to-r ${TYPE_BG[stat.type] || TYPE_BG.other} border border-border/20 px-5 py-5 transition-all duration-500`}
                      style={{ opacity: animateIn ? 1 : 0, transform: animateIn ? 'scale(1)' : 'scale(0.9)', transitionDelay: `${i * 100}ms` }}
                    >
                      <span className="text-4xl">{TYPE_EMOJI[stat.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-black leading-tight" style={{ color: TYPE_COLOR[stat.type] }}>{TYPE_NAME[stat.type]}</p>
                        <p className="text-lg font-bold text-foreground">{metric}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                      </div>
                      {comp && <span className={`text-base font-black ${comp.positive ? 'text-emerald-500' : 'text-red-500'}`}>{comp.text}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-4 pb-2 text-center">
              <p className="text-[10px] text-muted-foreground/40 font-medium tracking-wider uppercase">The Daily Athlete</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="z-20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-xl border-t border-border/10">
        <div className="max-w-3xl mx-auto">
          <div className="h-1 rounded-full bg-muted/30 overflow-hidden mb-3">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>

          {slide === TOTAL_SLIDES - 1 ? (
            showShare ? (
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
                className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <Share2 className="h-4 w-4" />
                Share Your Month
              </button>
            )
          ) : (
            <div className="flex items-center justify-between">
              <button onClick={goPrev} disabled={slide === 0} className="px-4 py-2.5 text-muted-foreground text-sm font-medium hover:text-foreground disabled:opacity-20 transition-colors">Back</button>
              <div className="flex gap-1.5">
                {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                  <button key={i} onClick={() => setSlide(i)} className={cn('h-1.5 rounded-full transition-all duration-300', i === slide ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/20')} />
                ))}
              </div>
              <button onClick={goNext} className="group flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 transition-all active:scale-95">
                Next <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes popIn { 0% { transform: scale(0.3); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}
