'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout, WorkoutType } from '@/types';
import {
  startOfMonth, endOfMonth, subMonths, isWithinInterval, format,
  eachDayOfInterval, isSameDay, getDay, startOfWeek, endOfWeek,
  eachWeekOfInterval, isBefore,
} from 'date-fns';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import { Share2, Loader2, ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus, Calendar, Clock, Flame, MapPin } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

// ── Constants ──

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', strength: '💪', other: '🏋️',
};
const TYPE_LABEL: Record<string, string> = {
  run: 'ran', bike: 'cycled', swim: 'swam', strength: 'lifted', other: 'trained',
};
const TYPE_COLOR: Record<string, string> = {
  run: '#22c55e', bike: '#f97316', swim: '#3b82f6', strength: '#a855f7', other: '#6b7280',
};
const TYPE_BG: Record<string, string> = {
  run: 'from-green-500/20 to-green-500/5', bike: 'from-orange-500/20 to-orange-500/5',
  swim: 'from-blue-500/20 to-blue-500/5', strength: 'from-purple-500/20 to-purple-500/5',
  other: 'from-gray-500/20 to-gray-500/5',
};
const PIE_COLORS = ['#22c55e', '#f97316', '#3b82f6', '#a855f7', '#6b7280', '#ef4444', '#14b8a6'];
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

function detectMonthHighlight(workouts: Workout[]): { label: string; detail: string; emoji: string; photo?: string } | null {
  if (workouts.length === 0) return null;
  let longest: Workout | null = null, longestDur = 0;
  let furthest: Workout | null = null, furthestDist = 0;
  for (const w of workouts) {
    const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : w.duration || 0;
    if (dur > longestDur) { longestDur = dur; longest = w; }
    const dist = (w.actualStats?.distance || 0) / 1000;
    if (dist > furthestDist) { furthestDist = dist; furthest = w; }
  }
  if (furthestDist >= 5 && furthest) return { label: `${TYPE_LABEL[furthest.type] || 'went'} ${furthestDist.toFixed(1)}km in one session`, detail: furthest.name, emoji: TYPE_EMOJI[furthest.type] || '🏋️', photo: furthest.photos?.[0] };
  if (longestDur >= 60 && longest) {
    const h = Math.floor(longestDur / 60), m = Math.round(longestDur % 60);
    return { label: `${TYPE_LABEL[longest.type] || 'trained'} for ${h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${Math.round(longestDur)}m`} non-stop`, detail: longest.name, emoji: TYPE_EMOJI[longest.type] || '🏋️', photo: longest.photos?.[0] };
  }
  const c = workouts.filter(w => w.completed).length;
  if (c > 0) return { label: `Completed ${c} workout${c > 1 ? 's' : ''}`, detail: 'Keep building the habit!', emoji: '🔥' };
  return null;
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
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-[10px] text-muted-foreground/60 text-center font-semibold py-1">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {blanks.map((_, i) => <div key={`b-${i}`} className="h-9" />)}
        {days.map((d) => {
          const isToday = isSameDay(d.date, today);
          const active = d.count > 0;
          return (
            <div
              key={format(d.date, 'd')}
              className={cn(
                'h-9 flex flex-col items-center justify-center rounded-lg relative transition-colors',
                active
                  ? 'bg-emerald-500/15'
                  : 'bg-transparent',
                isToday && 'ring-1 ring-primary/50',
              )}
              title={`${format(d.date, 'MMM d')}: ${d.count} workout${d.count !== 1 ? 's' : ''}`}
            >
              <span className={cn(
                'text-xs font-semibold leading-none',
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60',
                isToday && 'text-primary',
              )}>
                {format(d.date, 'd')}
              </span>
              {active && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {Array.from({ length: Math.min(d.count, 3) }).map((_, i) => (
                    <div key={i} className="w-1 h-1 rounded-full bg-emerald-500" />
                  ))}
                </div>
              )}
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
  const highlight = useMemo(() => detectMonthHighlight(thisMonthWorkouts), [thisMonthWorkouts]);
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

  const dailyData = useMemo(() => {
    return eachDayOfInterval({ start: targetMonthStart, end: targetMonthEnd }).map(day => {
      const dw = thisMonthWorkouts.filter(w => isSameDay(toDate(w), day));
      return { day: format(day, 'd'), date: format(day, 'MMM d'), count: dw.length, isToday: isSameDay(day, now), dayOfWeek: getDay(day) };
    });
  }, [thisMonthWorkouts, targetMonthStart, targetMonthEnd, now]);

  const weeklyTrend = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: targetMonthStart, end: targetMonthEnd }, { weekStartsOn: 1 });
    return weeks.map((ws, i) => {
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const ww = thisMonthWorkouts.filter(w => { const d = toDate(w); return d >= ws && d <= we; });
      return {
        week: `W${i + 1}`, label: format(ws, 'MMM d'),
        distance: Math.round(ww.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / 100) / 10,
        duration: Math.round(ww.reduce((s, w) => { if (w.actualStats?.duration) return s + w.actualStats.duration / 60; if (w.duration) return s + w.duration; return s; }, 0)),
        workouts: ww.length,
      };
    });
  }, [thisMonthWorkouts, targetMonthStart, targetMonthEnd]);

  const totalWorkouts = thisMonthWorkouts.length;
  const totalCompleted = thisMonthWorkouts.filter(w => w.completed).length;
  const totalDistanceKm = Math.round(sportStats.reduce((s, st) => s + st.distanceKm, 0) * 10) / 10;
  const totalDurationMin = sportStats.reduce((s, st) => s + st.durationMin, 0);
  const totalDurationHrs = Math.round(totalDurationMin / 6) / 10;
  const totalCalories = sportStats.reduce((s, st) => s + st.calories, 0);
  const prevTotalWorkouts = lastMonthWorkouts.length;
  const activeDays = calendarDays.filter(d => d.count > 0).length;
  const totalDays = calendarDays.length;
  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/review` : '';
  const shareText = `${rating.emoji} My ${format(targetMonthStart, 'MMMM')} in review: ${totalWorkouts} workouts, ${totalDistanceKm}km, ${totalDurationHrs}hrs — The Daily Athlete`;
  const tooltipStyle = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--card-foreground))', fontSize: '11px', padding: '6px 10px' };

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
        <span className="text-xs font-medium text-muted-foreground min-w-[110px] text-center">{monthLabel}</span>
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

      <div ref={cardRef} className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-4">

        {/* ═══ ROW 1: Hero — title + big stat badges ═══ */}
        <div className="rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 border border-border/30 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
                  <span className="text-white font-bold text-[10px]">CT</span>
                </div>
                <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">Month in Review</span>
              </div>
              <h1 className="text-foreground text-xl sm:text-2xl font-bold leading-tight">
                Dear {firstName}, this was <span className={rating.color}>{rating.word}</span> {rating.emoji}
              </h1>
            </div>
            {/* Big stats */}
            <div className="flex gap-2 sm:gap-3 shrink-0">
              {[
                { icon: Flame, value: String(totalWorkouts), label: 'workouts', color: 'text-orange-400', bg: 'from-orange-500/15 to-orange-500/5' },
                { icon: MapPin, value: `${totalDistanceKm}km`, label: 'distance', color: 'text-green-400', bg: 'from-green-500/15 to-green-500/5' },
                { icon: Clock, value: `${totalDurationHrs}h`, label: 'time', color: 'text-blue-400', bg: 'from-blue-500/15 to-blue-500/5' },
                { icon: Calendar, value: `${activeDays}`, label: `of ${totalDays} days`, color: 'text-purple-400', bg: 'from-purple-500/15 to-purple-500/5' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl bg-gradient-to-b ${s.bg} border border-border/20 px-3 py-2.5 text-center min-w-[72px]`}>
                  <s.icon className={`h-3.5 w-3.5 ${s.color} mx-auto mb-1`} />
                  <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ ROW 2: Calendar + Sports + Pie (3 cols) ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

          {/* Activity Calendar */}
          <div className="rounded-xl bg-muted/10 border border-border/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity</h2>
              <span className="text-[10px] text-emerald-500 font-medium">{activeDays} active days</span>
            </div>
            <ActivityCalendar days={calendarDays} monthStart={targetMonthStart} />
          </div>

          {/* Sport stats */}
          <div className="space-y-1.5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">By Sport</h2>
            {sportStats.map(stat => {
              const metric = stat.distanceKm > 0 ? `${stat.distanceKm}km` : stat.durationMin > 0 ? `${stat.durationMin}m` : `${stat.count}x`;
              const comp = stat.distanceKm > 0 ? pctChange(stat.distanceKm, stat.prevDistanceKm) : stat.durationMin > 0 ? pctChange(stat.durationMin, stat.prevDurationMin) : pctChange(stat.count, stat.prevCount);
              return (
                <div key={stat.type} className={`flex items-center gap-2.5 rounded-xl bg-gradient-to-r ${TYPE_BG[stat.type] || TYPE_BG.other} border border-border/20 px-3 py-2.5`}>
                  <span className="text-xl">{TYPE_EMOJI[stat.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      <span style={{ color: TYPE_COLOR[stat.type] }}>{metric}</span>
                      <span className="text-muted-foreground font-normal ml-1">· {stat.count} sessions · {stat.durationMin}m</span>
                    </p>
                  </div>
                  {comp && <span className={`text-[10px] font-bold ${comp.positive ? 'text-emerald-400' : 'text-red-400'}`}>{comp.text}</span>}
                </div>
              );
            })}
            {sportStats.length === 0 && (
              <div className="text-xs text-muted-foreground/50 text-center py-4">No workouts this month</div>
            )}
          </div>

          {/* Pie + vs Last Month */}
          <div className="space-y-3">
            {pieData.length > 0 && (
              <div className="rounded-xl bg-muted/10 border border-border/20 p-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breakdown</h2>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-24 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={22} outerRadius={44} paddingAngle={3} dataKey="value" stroke="none">
                          {pieData.map((entry, i) => <Cell key={entry.type} fill={TYPE_COLOR[entry.type] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1">
                    {pieData.map(e => (
                      <div key={e.type} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLOR[e.type] || '#6b7280' }} />
                        <span className="text-[11px] text-foreground font-medium capitalize flex-1">{e.name}</span>
                        <span className="text-[11px] text-muted-foreground">{e.value} · {e.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {prevTotalWorkouts > 0 && (
              <div className="rounded-xl bg-muted/10 border border-border/20 p-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">vs Last Month</h2>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Workouts', curr: totalWorkouts, prev: prevTotalWorkouts },
                    { label: 'Distance', curr: totalDistanceKm, prev: prevDistKm },
                    { label: 'Time', curr: totalDurationMin, prev: prevDurMin },
                  ].map(item => {
                    const diff = item.prev > 0 ? Math.round(((item.curr - item.prev) / item.prev) * 100) : 0;
                    const isUp = diff > 0, isDown = diff < 0;
                    return (
                      <div key={item.label}>
                        <div className={`text-base font-bold ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-foreground'}`}>
                          {isUp ? '+' : ''}{diff}%
                        </div>
                        <div className="flex items-center justify-center gap-0.5 mt-0.5">
                          {isUp ? <TrendingUp className="h-2.5 w-2.5 text-emerald-400" /> : isDown ? <TrendingDown className="h-2.5 w-2.5 text-red-400" /> : <Minus className="h-2.5 w-2.5 text-muted-foreground" />}
                          <span className="text-[10px] text-muted-foreground">{item.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {highlight && (
              <div className="rounded-xl overflow-hidden bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                {highlight.photo && (
                  <div className="h-20 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={highlight.photo} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-foreground text-xs font-semibold">{highlight.emoji} {highlight.label}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{highlight.detail}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ ROW 3: Daily bar chart (full width, compact) ═══ */}
        {dailyData.length > 0 && (
          <div className="rounded-xl bg-muted/10 border border-border/20 p-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daily Activity</h2>
            </div>
            <div className="h-[90px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} barCategoryGap="10%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} contentStyle={tooltipStyle}
                    formatter={((value: any) => [`${value} workout${value !== 1 ? 's' : ''}`, '']) as any}
                    labelFormatter={((label: any) => dailyData.find(d => d.day === label)?.date || label) as any}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {dailyData.map((entry, i) => (
                      <Cell key={i} fill={entry.count > 0 ? '#22c55e' : 'hsl(var(--muted))'} fillOpacity={entry.count > 0 ? 0.7 : 0.15} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══ ROW 4: Weekly trends side-by-side ═══ */}
        {weeklyTrend.length > 1 && (weeklyTrend.some(w => w.distance > 0) || weeklyTrend.some(w => w.duration > 0)) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {weeklyTrend.some(w => w.distance > 0) && (
              <div className="rounded-xl bg-muted/10 border border-border/20 p-3">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Weekly Distance (km)</p>
                <div className="h-[70px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyTrend}>
                      <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${v} km`, '']) as any} />
                      <Area type="monotone" dataKey="distance" stroke="#22c55e" strokeWidth={2} fill="url(#dg)" dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {weeklyTrend.some(w => w.duration > 0) && (
              <div className="rounded-xl bg-muted/10 border border-border/20 p-3">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Weekly Duration (min)</p>
                <div className="h-[70px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyTrend}>
                      <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${v} min`, '']) as any} />
                      <Area type="monotone" dataKey="duration" stroke="#3b82f6" strokeWidth={2} fill="url(#tg)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Share ═══ */}
      <div className="sticky bottom-0 z-20 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-xl border-t border-border/30">
        <div className="max-w-6xl mx-auto">
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
