'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import { Share2, Loader2, ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Minus, Instagram, Download } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';

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
      label: `You ${TYPE_LABEL[furthest.type] || 'went'} ${furthestDist.toFixed(1)}km in one session`,
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
  if (prev === 0) return { text: 'new', positive: true };
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return { text: `+${pct}%`, positive: true };
  if (pct < 0) return { text: `${pct}%`, positive: false };
  return { text: '=', positive: true };
}

// ── Page ──

export default function MonthlyReviewPage() {
  const user = useAuthStore((s) => s.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const [generatingStory, setGeneratingStory] = useState(false);

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
  const totalDurationHrs = Math.round(totalDurationMin / 6) / 10;
  const totalCalories = sportStats.reduce((s, st) => s + st.calories, 0);
  const prevTotalWorkouts = lastMonthWorkouts.length;
  const bestDay = useMemo(() => {
    const best = dailyData.reduce((a, b) => b.count > a.count ? b : a, dailyData[0]);
    return best?.count > 0 ? best : null;
  }, [dailyData]);
  const activeDays = dailyData.filter(d => d.count > 0).length;
  const totalDays = dailyData.length;

  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';
  const monthLabel = format(targetMonthStart, 'MMMM yyyy');
  const shortMonth = format(targetMonthStart, 'MMM yyyy');
  const isCurrentMonth = monthOffset === 0;

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/review` : '';
  const shareText = `${rating.emoji} My month in review: ${totalWorkouts} workouts, ${totalDistanceKm}km, ${totalDurationHrs}hrs.\n\nTracked on The Daily Athlete`;

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--card-foreground))',
    fontSize: '11px',
    padding: '6px 10px',
  };

  // ── Instagram Story Export ──
  const handleStoryExport = useCallback(async () => {
    if (!storyRef.current) return;
    setGeneratingStory(true);
    try {
      const dataUrl = await toPng(storyRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        width: 1080,
        height: 1920,
        style: { transform: 'scale(1)', transformOrigin: 'top left' },
      });
      const link = document.createElement('a');
      link.download = `monthly-review-story-${format(targetMonthStart, 'yyyy-MM')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Story image saved! Open Instagram and share it.', { icon: '📸', duration: 5000 });
    } catch (err) {
      console.error('Story export failed:', err);
      toast.error('Failed to generate story image');
    } finally {
      setGeneratingStory(false);
    }
  }, [targetMonthStart]);

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

  // Month-over-month diffs
  const prevDistKm = Math.round(lastMonthWorkouts.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / 100) / 10;
  const prevDurMin = Math.round(lastMonthWorkouts.reduce((s, w) => {
    if (w.actualStats?.duration) return s + w.actualStats.duration / 60;
    if (w.duration) return s + w.duration;
    return s;
  }, 0));

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-background/80 backdrop-blur-xl border-b border-border/20">
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

      {/* ═══ Wide dashboard content ═══ */}
      <div ref={cardRef} className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-4">

        {/* ROW 1: Title + Summary Cards (inline) */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
          <div className="shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
                <span className="text-white font-bold text-[10px]">CT</span>
              </div>
              <span className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                Month in Review
              </span>
            </div>
            <h1 className="text-foreground text-xl font-bold leading-tight">
              Dear {firstName}, this was <span className="text-primary">{rating.word}</span> {rating.emoji}
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap flex-1">
            {[
              { label: 'Workouts', value: totalWorkouts, sub: `${totalCompleted} done` },
              { label: 'Distance', value: `${totalDistanceKm}km` },
              { label: 'Time', value: `${totalDurationHrs}h` },
              { label: 'Active', value: `${activeDays}/${totalDays}d` },
            ].map(card => (
              <div key={card.label} className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2 min-w-[80px]">
                <p className="text-lg font-bold text-foreground leading-none">{card.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}{card.sub ? ` · ${card.sub}` : ''}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ROW 2: Sports + Pie + Month comparison (3 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Sport stats */}
          <div className="space-y-1.5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">By Sport</h2>
            {sportStats.map(stat => {
              const mainMetric = stat.distanceKm > 0
                ? `${stat.distanceKm}km`
                : stat.durationMin > 0
                  ? `${stat.durationMin}m`
                  : `${stat.count}x`;
              const comp = stat.distanceKm > 0
                ? pctChange(stat.distanceKm, stat.prevDistanceKm)
                : stat.durationMin > 0
                  ? pctChange(stat.durationMin, stat.prevDurationMin)
                  : pctChange(stat.count, stat.prevCount);
              return (
                <div key={stat.type} className="flex items-center gap-2 rounded-lg bg-muted/20 border border-border/20 px-2.5 py-2">
                  <span className="text-lg">{TYPE_EMOJI[stat.type]}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium" style={{ color: TYPE_COLOR[stat.type] }}>
                      {TYPE_LABEL[stat.type]} {mainMetric}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">{stat.count}x · {stat.durationMin}m</span>
                  </div>
                  {comp && (
                    <span className={`text-[10px] font-medium ${comp.positive ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {comp.text}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pie chart */}
          {pieData.length > 0 && (
            <div className="rounded-lg bg-muted/20 border border-border/20 p-3 flex flex-col">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breakdown</h2>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-28 h-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={3} dataKey="value" stroke="none">
                        {pieData.map((entry, i) => (
                          <Cell key={entry.type} fill={TYPE_COLOR[entry.type] || PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {pieData.map((entry) => (
                    <div key={entry.type} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[entry.type] || '#6b7280' }} />
                      <span className="text-[11px] text-foreground font-medium capitalize flex-1">{entry.name}</span>
                      <span className="text-[11px] text-muted-foreground">{entry.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* vs Last Month + Highlight */}
          <div className="space-y-3">
            {prevTotalWorkouts > 0 && (
              <div className="rounded-lg bg-muted/20 border border-border/20 p-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">vs Last Month</h2>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Workouts', curr: totalWorkouts, prev: prevTotalWorkouts },
                    { label: 'Distance', curr: totalDistanceKm, prev: prevDistKm },
                    { label: 'Time', curr: totalDurationMin, prev: prevDurMin },
                  ].map(item => {
                    const diff = item.prev > 0 ? Math.round(((item.curr - item.prev) / item.prev) * 100) : 0;
                    const isUp = diff > 0;
                    const isDown = diff < 0;
                    return (
                      <div key={item.label}>
                        <div className={`text-base font-bold ${isUp ? 'text-emerald-500' : isDown ? 'text-red-400' : 'text-foreground'}`}>
                          {isUp ? '+' : ''}{diff}%
                        </div>
                        <div className="flex items-center justify-center gap-0.5 mt-0.5">
                          {isUp ? <TrendingUp className="h-2.5 w-2.5 text-emerald-500" /> :
                           isDown ? <TrendingDown className="h-2.5 w-2.5 text-red-400" /> :
                           <Minus className="h-2.5 w-2.5 text-muted-foreground" />}
                          <span className="text-[10px] text-muted-foreground">{item.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {highlight && (
              <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/40">
                {highlight.photo && (
                  <div className="h-24 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={highlight.photo} alt="Highlight" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-foreground text-xs font-medium">{highlight.emoji} {highlight.label}</p>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{highlight.detail}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ROW 3: Daily Activity (full width) */}
        {dailyData.length > 0 && (
          <div className="rounded-lg bg-muted/20 border border-border/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daily Activity</h2>
              {bestDay && (
                <span className="text-[10px] text-muted-foreground">
                  Best: <span className="text-foreground font-medium">{bestDay.date}</span> ({bestDay.count})
                </span>
              )}
            </div>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} barCategoryGap="12%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
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
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
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
        )}

        {/* ROW 4: Weekly trends side-by-side */}
        {weeklyTrend.length > 1 && (weeklyTrend.some(w => w.distance > 0) || weeklyTrend.some(w => w.duration > 0)) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {weeklyTrend.some(w => w.distance > 0) && (
              <div className="rounded-lg bg-muted/20 border border-border/20 p-3">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Weekly Distance (km)</p>
                <div className="h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyTrend}>
                      <defs>
                        <linearGradient id="distGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${v} km`, 'Distance']) as any} />
                      <Area type="monotone" dataKey="distance" stroke="#22c55e" strokeWidth={2} fill="url(#distGradient)" dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {weeklyTrend.some(w => w.duration > 0) && (
              <div className="rounded-lg bg-muted/20 border border-border/20 p-3">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Weekly Duration (min)</p>
                <div className="h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyTrend}>
                      <defs>
                        <linearGradient id="durGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${v} min`, 'Duration']) as any} />
                      <Area type="monotone" dataKey="duration" stroke="#3b82f6" strokeWidth={2} fill="url(#durGradient)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Sticky share bar ═══ */}
      <div className="sticky bottom-0 z-20 px-4 py-2.5 bg-background/80 backdrop-blur-xl border-t border-border/30">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          {showShare ? (
            <div className="flex-1">
              <ShareButtons
                title="Share Your Monthly Review"
                shareText={shareText}
                shareUrl={shareUrl}
                fileName={`monthly-review-${format(targetMonthStart, 'yyyy-MM')}`}
                cardRef={cardRef}
                onClose={() => setShowShare(false)}
              />
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowShare(true)}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold bg-foreground text-background hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button
                onClick={handleStoryExport}
                disabled={generatingStory}
                className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {generatingStory ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Instagram className="h-4 w-4" />
                )}
                Insta Story
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══ Hidden Instagram Story template (9:16 ratio, 1080x1920) ═══ */}
      <div className="fixed -left-[9999px] top-0">
        <div
          ref={storyRef}
          style={{ width: 1080, height: 1920, padding: 80, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(145deg, #0f0f0f 0%, #1a0a2e 50%, #0f0f0f 100%)', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}
        >
          {/* Story top: branding */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 60 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>CT</span>
              </div>
              <span style={{ fontSize: 24, fontWeight: 500, color: '#888', letterSpacing: 4, textTransform: 'uppercase' as const }}>
                Month in Review
              </span>
            </div>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>
              {format(targetMonthStart, 'MMMM')}
              <br />
              <span style={{ color: '#a855f7' }}>{format(targetMonthStart, 'yyyy')}</span>
            </div>
            <div style={{ fontSize: 36, color: '#aaa' }}>
              This was <span style={{ color: '#fff', fontWeight: 700 }}>{rating.word}</span> {rating.emoji}
            </div>
          </div>

          {/* Story middle: key stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'WORKOUTS', value: String(totalWorkouts) },
                { label: 'DISTANCE', value: `${totalDistanceKm}km` },
                { label: 'TIME', value: `${totalDurationHrs}h` },
                { label: 'ACTIVE', value: `${activeDays}d` },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '28px 20px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 56, fontWeight: 800 }}>{s.value}</div>
                  <div style={{ fontSize: 18, color: '#888', marginTop: 8, letterSpacing: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Per sport */}
            {sportStats.slice(0, 3).map(stat => (
              <div key={stat.type} style={{ display: 'flex', alignItems: 'center', gap: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '20px 24px' }}>
                <span style={{ fontSize: 48 }}>{TYPE_EMOJI[stat.type]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 32, fontWeight: 700 }}>
                    <span style={{ color: TYPE_COLOR[stat.type] }}>
                      {TYPE_LABEL[stat.type]} {stat.distanceKm > 0 ? `${stat.distanceKm}km` : stat.durationMin > 0 ? `${stat.durationMin}min` : `${stat.count}x`}
                    </span>
                  </div>
                  <div style={{ fontSize: 20, color: '#888' }}>{stat.count} sessions</div>
                </div>
              </div>
            ))}

            {highlight && (
              <div style={{ background: 'rgba(168,85,247,0.1)', borderRadius: 16, padding: '24px 28px', border: '1px solid rgba(168,85,247,0.2)' }}>
                <div style={{ fontSize: 28, fontWeight: 600 }}>{highlight.emoji} {highlight.label}</div>
                <div style={{ fontSize: 20, color: '#aaa', marginTop: 8 }}>{highlight.detail}</div>
              </div>
            )}
          </div>

          {/* Story bottom: watermark */}
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: 22, color: '#555', letterSpacing: 3 }}>THE DAILY ATHLETE</div>
          </div>
        </div>
      </div>
    </div>
  );
}
