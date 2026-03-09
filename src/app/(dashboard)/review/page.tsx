'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout, WorkoutType } from '@/types';
import {
  startOfMonth, endOfMonth, subMonths, isWithinInterval, format,
  eachDayOfInterval, isSameDay, getDay, isBefore,
} from 'date-fns';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import { Share2, Loader2, ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

// ── Constants ──

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', strength: '💪', other: '🏋️',
};
const TYPE_NAME: Record<string, string> = {
  run: 'Running', bike: 'Cycling', swim: 'Swimming', strength: 'Strength', other: 'Other',
};
const TYPE_COLOR: Record<string, string> = {
  run: '#22c55e', bike: '#f97316', swim: '#3b82f6', strength: '#a855f7', other: '#6b7280',
};
const TYPE_BG: Record<string, string> = {
  run: 'from-green-500/20 to-green-500/5', bike: 'from-orange-500/20 to-orange-500/5',
  swim: 'from-blue-500/20 to-blue-500/5', strength: 'from-purple-500/20 to-purple-500/5',
  other: 'from-gray-500/20 to-gray-500/5',
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

function pctChange(curr: number, prev: number): { text: string; positive: boolean } | null {
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return { text: 'new', positive: true };
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return { text: `+${pct}%`, positive: true };
  if (pct < 0) return { text: `${pct}%`, positive: false };
  return { text: '=', positive: true };
}

// ── Activity Calendar Component ──

function ActivityCalendar({ days, monthStart }: { days: { date: Date; count: number }[]; monthStart: Date }) {
  const rawDay = getDay(monthStart); // 0=Sun in JS
  const firstDayOfWeek = rawDay === 0 ? 6 : rawDay - 1; // Convert to Mon=0
  const blanks = Array.from({ length: firstDayOfWeek });
  const today = new Date();

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-[8px] text-muted-foreground/50 text-center font-semibold py-0.5">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-[2px]">
        {blanks.map((_, i) => <div key={`b-${i}`} className="h-7" />)}
        {days.map((d) => {
          const isToday = isSameDay(d.date, today);
          const active = d.count > 0;
          return (
            <div
              key={format(d.date, 'd')}
              className={cn(
                'h-7 flex items-center justify-center rounded-md transition-colors',
                active
                  ? 'bg-emerald-500/20'
                  : 'bg-transparent',
                isToday && 'ring-1 ring-primary/50',
              )}
              title={`${format(d.date, 'MMM d')}: ${d.count} workout${d.count !== 1 ? 's' : ''}`}
            >
              <span className={cn(
                'text-[10px] font-bold leading-none',
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
      const data = await getUserWorkouts(user.username, user.role);
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

      <div ref={cardRef} className="w-full max-w-lg mx-auto px-4 py-5 space-y-3">

        {/* ═══ Hero — month, rating, big stats ═══ */}
        <div className="rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 border border-border/30 p-4">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase mb-1">Month in Review</p>
          <h2 className="text-foreground text-2xl font-black tracking-tight leading-none mb-0.5" style={{ WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility' }}>
            {monthLabel}
          </h2>
          <h1 className="text-foreground text-base font-medium leading-tight mb-4">
            Dear {firstName}, this was <span className={`font-bold ${rating.color}`}>{rating.word}</span> {rating.emoji}
          </h1>
          {/* Stat badges — 4 across, big numbers, no icons */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: String(totalWorkouts), label: 'workouts' },
              { value: `${totalDistanceKm}km`, label: 'distance' },
              { value: `${totalDurationHrs}h`, label: 'time' },
              { value: `${activeDays}/${totalDays}`, label: 'active days' },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-foreground/5 border border-border/20 py-2.5 text-center">
                <p className="text-xl font-black text-foreground leading-none">{s.value}</p>
                <p className="text-[9px] text-muted-foreground mt-1 font-medium uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ vs Last Month — compact inline comparison ═══ */}
        {prevTotalWorkouts > 0 && (() => {
          const items = [
            { label: 'Workouts', curr: totalWorkouts, prev: prevTotalWorkouts },
            { label: 'Distance', curr: totalDistanceKm, prev: prevDistKm },
            { label: 'Time', curr: totalDurationMin, prev: prevDurMin },
          ];
          return (
            <div className="flex items-center justify-center gap-4 py-1">
              <span className="text-[10px] text-muted-foreground font-medium">vs {format(prevMonthStart, 'MMM')}</span>
              {items.map(item => {
                const diff = item.prev > 0 ? Math.round(((item.curr - item.prev) / item.prev) * 100) : 0;
                const isUp = diff > 0, isDown = diff < 0;
                return (
                  <div key={item.label} className="flex items-center gap-1">
                    {isUp ? <TrendingUp className="h-2.5 w-2.5 text-emerald-400" /> : isDown ? <TrendingDown className="h-2.5 w-2.5 text-red-400" /> : <Minus className="h-2.5 w-2.5 text-muted-foreground" />}
                    <span className={`text-[11px] font-bold ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {isUp ? '+' : ''}{diff}%
                    </span>
                    <span className="text-[9px] text-muted-foreground">{item.label.toLowerCase()}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ═══ By Sport — with sport name labels ═══ */}
        <div className="space-y-1.5">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">By Sport</h2>
          {sportStats.map(stat => {
            const fmtDur = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };
            const metric = stat.distanceKm > 0 ? `${stat.distanceKm}km` : stat.durationMin > 0 ? fmtDur(stat.durationMin) : `${stat.count}x`;
            const detail = stat.distanceKm > 0
              ? `${stat.count} sessions · ${fmtDur(stat.durationMin)}`
              : `${stat.count} sessions`;
            const comp = stat.distanceKm > 0 ? pctChange(stat.distanceKm, stat.prevDistanceKm) : stat.durationMin > 0 ? pctChange(stat.durationMin, stat.prevDurationMin) : pctChange(stat.count, stat.prevCount);
            return (
              <div key={stat.type} className={`flex items-center gap-2.5 rounded-xl bg-gradient-to-r ${TYPE_BG[stat.type] || TYPE_BG.other} border border-border/20 px-3 py-2`}>
                <span className="text-lg">{TYPE_EMOJI[stat.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground leading-tight" style={{ color: TYPE_COLOR[stat.type] }}>
                    {TYPE_NAME[stat.type] || stat.type}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {metric} · {detail}
                  </p>
                </div>
                {comp && <span className={`text-[11px] font-black ${comp.positive ? 'text-emerald-400' : 'text-red-400'}`}>{comp.text}</span>}
              </div>
            );
          })}
          {sportStats.length === 0 && (
            <div className="text-xs text-muted-foreground/50 text-center py-4">No workouts this month</div>
          )}
        </div>

        {/* ═══ Activity Calendar ═══ */}
        <div className="rounded-xl bg-muted/10 border border-border/20 p-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Activity</h2>
            <span className="text-[10px] text-emerald-500 font-medium">{activeDays} active days</span>
          </div>
          <ActivityCalendar days={calendarDays} monthStart={targetMonthStart} />
        </div>

        {/* ═══ Breakdown — horizontal stacked bar ═══ */}
        {pieData.length > 0 && (
          <div className="rounded-xl bg-muted/10 border border-border/20 p-3">
            <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breakdown</h2>
            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden">
              {pieData.map(e => (
                <div
                  key={e.type}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${e.pct}%`, backgroundColor: TYPE_COLOR[e.type] || '#6b7280' }}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
              {pieData.map(e => (
                <div key={e.type} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[e.type] || '#6b7280' }} />
                  <span className="text-[10px] text-muted-foreground">{TYPE_NAME[e.type] || e.name} {e.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Footer branding ═══ */}
        <div className="pt-1 pb-2 text-center">
          <p className="text-[10px] text-muted-foreground/50 font-medium tracking-wider uppercase">The Daily Athlete</p>
        </div>
      </div>

      {/* ═══ Share ═══ */}
      <div className="sticky bottom-0 z-20 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-xl border-t border-border/30">
        <div className="max-w-lg mx-auto">
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
