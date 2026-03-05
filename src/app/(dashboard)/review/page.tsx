'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout, WorkoutType } from '@/types';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import {
  startOfMonth, endOfMonth, subMonths, isWithinInterval, format,
  eachDayOfInterval, isSameDay, getDay, startOfWeek, endOfWeek,
  eachWeekOfInterval,
} from 'date-fns';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { Share2, Loader2, ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus  } from 'lucide-react';
import Link from 'next/link';
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
const PIE_COLORS = ['#22c55e', '#f97316', '#3b82f6', '#a855f7', '#6b7280', '#ef4444', '#14b8a6'];

// ── Helpers ──

function toDate(w: Workout): Date {
  return w.date?.toDate?.() ?? new Date(w.date as any);
}

interface SportStat {
  type: WorkoutType;
  count: number;
  distanceKm: number;
  durationMin: number;
  calories: number;
  prevCount: number;
  prevDistanceKm: number;
  prevDurationMin: number;
}

function computeMonthlySportStats(thisMonth: Workout[], lastMonth: Workout[]): SportStat[] {
  const types = new Set<WorkoutType>();
  [...thisMonth, ...lastMonth].forEach(w => types.add(w.type));

  return Array.from(types).map(type => {
    const tm = thisMonth.filter(w => w.type === type);
    const lm = lastMonth.filter(w => w.type === type);

    const sumDist = (ws: Workout[]) =>
      ws.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / 1000;
    const sumDur = (ws: Workout[]) =>
      ws.reduce((s, w) => {
        if (w.actualStats?.duration) return s + w.actualStats.duration / 60;
        if (w.duration) return s + w.duration;
        return s;
      }, 0);
    const sumCal = (ws: Workout[]) =>
      ws.reduce((s, w) => s + (w.actualStats?.calories || 0), 0);

    return {
      type,
      count: tm.length,
      distanceKm: Math.round(sumDist(tm) * 10) / 10,
      durationMin: Math.round(sumDur(tm)),
      calories: Math.round(sumCal(tm)),
      prevCount: lm.length,
      prevDistanceKm: Math.round(sumDist(lm) * 10) / 10,
      prevDurationMin: Math.round(sumDur(lm)),
    };
  }).sort((a, b) => b.count - a.count);
}

function detectMonthHighlight(workouts: Workout[]): { label: string; detail: string; emoji: string; photo?: string } | null {
  if (workouts.length === 0) return null;

  let longest: Workout | null = null;
  let longestDur = 0;
  let furthest: Workout | null = null;
  let furthestDist = 0;

  for (const w of workouts) {
    const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : w.duration || 0;
    if (dur > longestDur) { longestDur = dur; longest = w; }
    const dist = (w.actualStats?.distance || 0) / 1000;
    if (dist > furthestDist) { furthestDist = dist; furthest = w; }
  }

  if (furthestDist >= 5 && furthest) {
    return {
      label: `You ${TYPE_LABEL[furthest.type] || 'went'} ${furthestDist.toFixed(1)}km in a single session`,
      detail: furthest.name,
      emoji: TYPE_EMOJI[furthest.type] || '🏋️',
      photo: furthest.photos?.[0],
    };
  }

  if (longestDur >= 60 && longest) {
    const hours = Math.floor(longestDur / 60);
    const mins = Math.round(longestDur % 60);
    const timeStr = hours > 0
      ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
      : `${Math.round(longestDur)}m`;
    return {
      label: `You ${TYPE_LABEL[longest.type] || 'trained'} for ${timeStr} non-stop`,
      detail: longest.name,
      emoji: TYPE_EMOJI[longest.type] || '🏋️',
      photo: longest.photos?.[0],
    };
  }

  const completedCount = workouts.filter(w => w.completed).length;
  if (completedCount > 0) {
    return {
      label: `You completed ${completedCount} workout${completedCount > 1 ? 's' : ''} this month`,
      detail: 'Keep building the habit!',
      emoji: '🔥',
    };
  }
  return null;
}

function getMonthRating(stats: SportStat[]): { word: string; emoji: string } {
  const totalCount = stats.reduce((s, st) => s + st.count, 0);
  const totalPrev = stats.reduce((s, st) => s + st.prevCount, 0);
  if (totalCount === 0) return { word: 'quiet', emoji: '😴' };
  if (totalPrev === 0) return { word: 'a great start', emoji: '🚀' };
  const ratio = totalCount / totalPrev;
  if (ratio >= 1.3) return { word: 'incredible', emoji: '🔥' };
  if (ratio >= 1.1) return { word: 'productive', emoji: '💪' };
  if (ratio >= 0.9) return { word: 'consistent', emoji: '✅' };
  return { word: 'a recovery month', emoji: '🧘' };
}

function pctChange(curr: number, prev: number): { text: string; positive: boolean } | null {
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return { text: 'new this month', positive: true };
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return { text: `${pct}% more than last month`, positive: true };
  if (pct < 0) return { text: `${Math.abs(pct)}% less than last month`, positive: false };
  return { text: 'same as last month', positive: true };
}

// ── Page ──

export default function MonthlyReviewPage() {
  const user = useAuthStore((s) => s.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);
      const data = await getUserWorkouts(user.username, user.role);
      setWorkouts(data);
      setLoading(false);
    }
    load();
  }, [user]);

  const now = new Date();
  const targetMonthStart = startOfMonth(subMonths(now, monthOffset));
  const targetMonthEnd = endOfMonth(targetMonthStart);
  const prevMonthStart = startOfMonth(subMonths(targetMonthStart, 1));
  const prevMonthEnd = endOfMonth(prevMonthStart);

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

  // ── Chart Data ──

  // Pie chart: workout type breakdown
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    thisMonthWorkouts.forEach(w => {
      counts[w.type] = (counts[w.type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([type, count]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: count,
        type,
        pct: Math.round((count / thisMonthWorkouts.length) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [thisMonthWorkouts]);

  // Daily activity: workouts per day of month
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: targetMonthStart, end: targetMonthEnd });
    return days.map(day => {
      const dayWorkouts = thisMonthWorkouts.filter(w => isSameDay(toDate(w), day));
      return {
        day: format(day, 'd'),
        date: format(day, 'MMM d'),
        count: dayWorkouts.length,
        completed: dayWorkouts.filter(w => w.completed).length,
        isToday: isSameDay(day, now),
        dayOfWeek: getDay(day),
      };
    });
  }, [thisMonthWorkouts, targetMonthStart, targetMonthEnd, now]);

  // Weekly volume trend (distance + duration per week)
  const weeklyTrend = useMemo(() => {
    const weeks = eachWeekOfInterval(
      { start: targetMonthStart, end: targetMonthEnd },
      { weekStartsOn: 1 },
    );
    return weeks.map((weekStart, i) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekWorkouts = thisMonthWorkouts.filter(w => {
        const d = toDate(w);
        return d >= weekStart && d <= weekEnd;
      });
      const totalDist = weekWorkouts.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / 1000;
      const totalDur = weekWorkouts.reduce((s, w) => {
        if (w.actualStats?.duration) return s + w.actualStats.duration / 60;
        if (w.duration) return s + w.duration;
        return s;
      }, 0);
      return {
        week: `W${i + 1}`,
        label: `${format(weekStart, 'MMM d')}`,
        distance: Math.round(totalDist * 10) / 10,
        duration: Math.round(totalDur),
        workouts: weekWorkouts.length,
      };
    });
  }, [thisMonthWorkouts, targetMonthStart, targetMonthEnd]);

  // Aggregate stats
  const totalWorkouts = thisMonthWorkouts.length;
  const totalCompleted = thisMonthWorkouts.filter(w => w.completed).length;
  const totalDistanceKm = Math.round(sportStats.reduce((s, st) => s + st.distanceKm, 0) * 10) / 10;
  const totalDurationMin = sportStats.reduce((s, st) => s + st.durationMin, 0);
  const totalDurationHrs = Math.round(totalDurationMin / 6) / 10; // 1 decimal
  const totalCalories = sportStats.reduce((s, st) => s + st.calories, 0);
  const prevTotalWorkouts = lastMonthWorkouts.length;

  // Best day (most workouts)
  const bestDay = useMemo(() => {
    const best = dailyData.reduce((a, b) => b.count > a.count ? b : a, dailyData[0]);
    return best?.count > 0 ? best : null;
  }, [dailyData]);

  // Active days
  const activeDays = dailyData.filter(d => d.count > 0).length;
  const totalDays = dailyData.length;

  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';
  const monthLabel = format(targetMonthStart, 'MMMM yyyy');
  const isCurrentMonth = monthOffset === 0;

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/review` : '';
  const shareText = `${rating.emoji} My month in review: ${totalWorkouts} workouts, ${totalDistanceKm}km, ${totalDurationHrs}hrs.\n\nTracked on The Daily Athlete`;

  // Chart tooltip style
  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '12px',
    color: 'hsl(var(--card-foreground))',
    fontSize: '12px',
    padding: '8px 12px',
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-foreground" />
          <p className="text-muted-foreground animate-pulse">Loading your review...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-3 py-2.5 bg-background/80 backdrop-blur-xl border-b border-border/20">
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

      {/* Content */}
      <div ref={cardRef} className="max-w-md mx-auto px-4 py-6 space-y-8">

        {/* ── Title + Rating ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">CT</span>
            </div>
            <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Your Month in Review
            </span>
          </div>
          <h1 className="text-foreground text-2xl sm:text-3xl font-bold leading-tight mb-1">
            Dear {firstName},
          </h1>
          <p className="text-muted-foreground text-base">
            this was <span className="text-foreground font-semibold">{rating.word}</span> {rating.emoji}
          </p>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Workouts', value: totalWorkouts, sub: `${totalCompleted} completed` },
            { label: 'Distance', value: `${totalDistanceKm}km`, sub: totalDistanceKm > 0 ? 'total' : 'no distance logged' },
            { label: 'Time', value: `${totalDurationHrs}h`, sub: `${totalDurationMin} min total` },
            { label: 'Active Days', value: activeDays, sub: `of ${totalDays} days` },
          ].map(card => (
            <div key={card.label} className="rounded-xl bg-muted/30 border border-border/30 p-3">
              <p className="text-xl font-bold text-foreground">{card.value}</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{card.label}</p>
              <p className="text-[10px] text-muted-foreground/60">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Per-Sport Stats ── */}
        {sportStats.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">By Sport</h2>
            {sportStats.map(stat => {
              const mainMetric = stat.distanceKm > 0
                ? `${stat.distanceKm}km`
                : stat.durationMin > 0
                  ? `${stat.durationMin} min`
                  : `${stat.count} session${stat.count > 1 ? 's' : ''}`;

              const comp = stat.distanceKm > 0
                ? pctChange(stat.distanceKm, stat.prevDistanceKm)
                : stat.durationMin > 0
                  ? pctChange(stat.durationMin, stat.prevDurationMin)
                  : pctChange(stat.count, stat.prevCount);

              return (
                <div key={stat.type} className="flex items-center gap-3 rounded-xl bg-muted/20 border border-border/20 p-3">
                  <span className="text-2xl">{TYPE_EMOJI[stat.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium">
                      You{' '}
                      <span style={{ color: TYPE_COLOR[stat.type] }} className="font-bold">
                        {TYPE_LABEL[stat.type] || 'trained'} {mainMetric}
                      </span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{stat.count} session{stat.count !== 1 ? 's' : ''}</span>
                      {stat.durationMin > 0 && <span className="text-[11px] text-muted-foreground">· {stat.durationMin} min</span>}
                      {stat.calories > 0 && <span className="text-[11px] text-muted-foreground">· {stat.calories} cal</span>}
                    </div>
                  </div>
                  {comp && (
                    <div className={`flex items-center gap-1 text-[11px] font-medium shrink-0 ${comp.positive ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {comp.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span>
                        {comp.text.includes('more') ? `+${comp.text.split('%')[0]}%` :
                         comp.text.includes('less') ? `-${comp.text.split('%')[0]}%` :
                         comp.text === 'new this month' ? 'New' : '='}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Workout Breakdown Pie Chart ── */}
        {pieData.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Workout Breakdown</h2>
            <div className="rounded-xl bg-muted/20 border border-border/20 p-4">
              <div className="flex items-center gap-4">
                <div className="w-32 h-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={58}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={entry.type} fill={TYPE_COLOR[entry.type] || PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {pieData.map((entry) => (
                    <div key={entry.type} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[entry.type] || '#6b7280' }} />
                      <span className="text-xs text-foreground font-medium capitalize flex-1">{entry.name}</span>
                      <span className="text-xs text-muted-foreground">{entry.value} · {entry.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Daily Activity Chart ── */}
        {dailyData.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Daily Activity</h2>
              {bestDay && (
                <span className="text-[11px] text-muted-foreground">
                  Best: <span className="text-foreground font-medium">{bestDay.date}</span>
                </span>
              )}
            </div>
            <div className="rounded-xl bg-muted/20 border border-border/20 p-3">
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                      contentStyle={tooltipStyle}
                      formatter={((value: any) => [`${value} workout${value !== 1 ? 's' : ''}`, 'Activity']) as any}
                      labelFormatter={((label: any) => {
                        const item = dailyData.find(d => d.day === label);
                        return item?.date || label;
                      }) as any}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {dailyData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.isToday ? '#ef4444' : entry.count > 0 ? '#ef4444' : 'hsl(var(--muted))'}
                          fillOpacity={entry.isToday ? 1 : entry.count > 0 ? 0.6 : 0.15}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ── Weekly Volume Trend ── */}
        {weeklyTrend.length > 1 && (weeklyTrend.some(w => w.distance > 0) || weeklyTrend.some(w => w.duration > 0)) && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Weekly Volume</h2>
            <div className="grid grid-cols-1 gap-3">
              {/* Distance trend */}
              {weeklyTrend.some(w => w.distance > 0) && (
                <div className="rounded-xl bg-muted/20 border border-border/20 p-3">
                  <p className="text-[11px] text-muted-foreground font-medium mb-2">Distance (km)</p>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyTrend}>
                        <defs>
                          <linearGradient id="distGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="week"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${v} km`, 'Distance']) as any} />
                        <Area type="monotone" dataKey="distance" stroke="#22c55e" strokeWidth={2.5} fill="url(#distGradient)" dot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Duration trend */}
              {weeklyTrend.some(w => w.duration > 0) && (
                <div className="rounded-xl bg-muted/20 border border-border/20 p-3">
                  <p className="text-[11px] text-muted-foreground font-medium mb-2">Duration (min)</p>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyTrend}>
                        <defs>
                          <linearGradient id="durGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="week"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${v} min`, 'Duration']) as any} />
                        <Area type="monotone" dataKey="duration" stroke="#3b82f6" strokeWidth={2.5} fill="url(#durGradient)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Month-over-Month Comparison ── */}
        {prevTotalWorkouts > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">vs Last Month</h2>
            <div className="rounded-xl bg-muted/20 border border-border/20 p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  {
                    label: 'Workouts',
                    curr: totalWorkouts,
                    prev: prevTotalWorkouts,
                  },
                  {
                    label: 'Distance',
                    curr: totalDistanceKm,
                    prev: Math.round(lastMonthWorkouts.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / 100) / 10,
                  },
                  {
                    label: 'Time',
                    curr: totalDurationMin,
                    prev: Math.round(lastMonthWorkouts.reduce((s, w) => {
                      if (w.actualStats?.duration) return s + w.actualStats.duration / 60;
                      if (w.duration) return s + w.duration;
                      return s;
                    }, 0)),
                  },
                ].map(item => {
                  const diff = item.prev > 0 ? Math.round(((item.curr - item.prev) / item.prev) * 100) : 0;
                  const isUp = diff > 0;
                  const isDown = diff < 0;
                  return (
                    <div key={item.label}>
                      <div className={`text-xl font-bold ${isUp ? 'text-emerald-500' : isDown ? 'text-red-400' : 'text-foreground'}`}>
                        {isUp ? '+' : ''}{diff}%
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {isUp ? <TrendingUp className="h-3 w-3 text-emerald-500" /> :
                         isDown ? <TrendingDown className="h-3 w-3 text-red-400" /> :
                         <Minus className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Monthly Highlight ── */}
        {highlight && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Monthly Highlight</h2>
            <div className="rounded-xl overflow-hidden bg-muted/30 border border-border/40">
              {highlight.photo && (
                <div className="h-40 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={highlight.photo} alt="Highlight" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <p className="text-foreground text-base font-medium">
                  {highlight.emoji} {highlight.label}
                </p>
                <p className="text-muted-foreground text-sm mt-1">{highlight.detail}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground/60 pb-2">
          <span>{totalWorkouts} workout{totalWorkouts !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{totalCompleted} completed</span>
          <span>·</span>
          <span>{monthLabel}</span>
        </div>
      </div>

      {/* Sticky share bar */}
      <div className="sticky bottom-0 z-20 px-4 py-3 bg-background/80 backdrop-blur-xl border-t border-border/30">
        <div className="max-w-md mx-auto">
          {showShare ? (
            <ShareButtons
              title="Share Your Monthly Review"
              shareText={shareText}
              shareUrl={shareUrl}
              fileName={`monthly-review-${format(targetMonthStart, 'yyyy-MM')}`}
              cardRef={cardRef}
              onClose={() => setShowShare(false)}
            />
          ) : (
            <button
              onClick={() => setShowShare(true)}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-semibold bg-foreground text-background hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Share2 className="h-4 w-4" />
              Send to friends
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
