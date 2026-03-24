'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { Workout, WorkoutType } from '@/types';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import {
  startOfWeek, endOfWeek, subWeeks, isWithinInterval, format,
  eachDayOfInterval, isSameDay,
} from 'date-fns';
import { Share2, Loader2, ChevronLeft, ChevronRight, X, Trophy } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

// ── Helpers ──

function toDate(w: Workout): Date {
  return w.date?.toDate?.() ?? new Date(w.date as any);
}

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '🏋️',
};

const TYPE_NAME: Record<string, string> = {
  run: 'Running', bike: 'Cycling', swim: 'Swimming', walk: 'Walking', strength: 'Strength', other: 'Other',
};

const TYPE_BG: Record<string, string> = {
  run: 'from-green-500/20 to-green-500/5', bike: 'from-orange-500/20 to-orange-500/5',
  swim: 'from-blue-500/20 to-blue-500/5', walk: 'from-emerald-500/20 to-emerald-500/5',
  strength: 'from-purple-500/20 to-purple-500/5', other: 'from-gray-500/20 to-gray-500/5',
};

const TYPE_COLOR: Record<string, string> = {
  run: '#22c55e', bike: '#f97316', swim: '#3b82f6', walk: '#10b981', strength: '#a855f7', other: '#6b7280',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface SportStat {
  type: WorkoutType;
  count: number;
  distanceKm: number;
  durationMin: number;
  calories: number;
  prevDistanceKm: number;
  prevDurationMin: number;
  prevCount: number;
}

function computeWeeklySportStats(
  thisWeek: Workout[],
  lastWeek: Workout[],
): SportStat[] {
  const types = new Set<WorkoutType>();
  [...thisWeek, ...lastWeek].forEach(w => types.add(w.type));

  return Array.from(types).map(type => {
    const tw = thisWeek.filter(w => w.type === type);
    const lw = lastWeek.filter(w => w.type === type);

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
      count: tw.length,
      distanceKm: Math.round(sumDist(tw) * 10) / 10,
      durationMin: Math.round(sumDur(tw)),
      calories: Math.round(sumCal(tw)),
      prevDistanceKm: Math.round(sumDist(lw) * 10) / 10,
      prevDurationMin: Math.round(sumDur(lw)),
      prevCount: lw.length,
    };
  }).sort((a, b) => b.count - a.count);
}

function getWeekRating(stats: SportStat[]): { word: string; emoji: string } {
  const totalCount = stats.reduce((s, st) => s + st.count, 0);
  const totalPrev = stats.reduce((s, st) => s + st.prevCount, 0);
  if (totalCount === 0) return { word: 'quiet', emoji: '😴' };
  if (totalPrev === 0) return { word: 'a great start', emoji: '🚀' };
  const ratio = totalCount / totalPrev;
  if (ratio >= 1.3) return { word: 'incredible', emoji: '🔥' };
  if (ratio >= 1.1) return { word: 'solid', emoji: '💪' };
  if (ratio >= 0.9) return { word: 'consistent', emoji: '✅' };
  return { word: 'a recovery week', emoji: '🧘' };
}

function pctChange(curr: number, prev: number): { text: string; positive: boolean } | null {
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return { text: 'new', positive: true };
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return { text: `+${pct}%`, positive: true };
  if (pct < 0) return { text: `${pct}%`, positive: false };
  return { text: '=', positive: true };
}

const fmtDur = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };

// ── Page ──

export default function WrapPage() {
  const user = useAuthStore((s) => s.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

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
        console.error('Failed to load wrap data:', err);
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
  const targetWeekEnd = subWeeks(endOfWeek(now, { weekStartsOn: 1 }), weekOffset);
  const targetWeekStart = startOfWeek(targetWeekEnd, { weekStartsOn: 1 });
  const prevWeekStart = subWeeks(targetWeekStart, 1);
  const prevWeekEnd = subWeeks(targetWeekEnd, 1);

  const thisWeekWorkouts = useMemo(
    () => workouts.filter(w => isWithinInterval(toDate(w), { start: targetWeekStart, end: targetWeekEnd })),
    [workouts, targetWeekStart, targetWeekEnd],
  );
  const lastWeekWorkouts = useMemo(
    () => workouts.filter(w => isWithinInterval(toDate(w), { start: prevWeekStart, end: prevWeekEnd })),
    [workouts, prevWeekStart, prevWeekEnd],
  );

  const sportStats = useMemo(() => computeWeeklySportStats(thisWeekWorkouts, lastWeekWorkouts), [thisWeekWorkouts, lastWeekWorkouts]);
  const activeSports = useMemo(() => sportStats.filter(s => s.count > 0), [sportStats]);
  const rating = useMemo(() => getWeekRating(sportStats), [sportStats]);

  const totalWorkouts = thisWeekWorkouts.length;
  const totalDistanceKm = Math.round(activeSports.reduce((s, st) => s + st.distanceKm, 0) * 10) / 10;
  const totalDurationMin = activeSports.reduce((s, st) => s + st.durationMin, 0);
  const totalCalories = activeSports.reduce((s, st) => s + st.calories, 0);

  // Daily activity data for the bar chart
  const dailyActivity = useMemo(() => {
    const days = eachDayOfInterval({ start: targetWeekStart, end: targetWeekEnd });
    return days.map(day => {
      const dayWorkouts = thisWeekWorkouts.filter(w => isSameDay(toDate(w), day));
      // Find the primary sport for this day (most common type)
      const typeCounts: Record<string, number> = {};
      dayWorkouts.forEach(w => { typeCounts[w.type] = (typeCounts[w.type] || 0) + 1; });
      const primaryType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      return { day, count: dayWorkouts.length, primaryType };
    });
  }, [thisWeekWorkouts, targetWeekStart, targetWeekEnd]);

  // Highlight of the week (longest or furthest workout)
  const highlight = useMemo(() => {
    if (thisWeekWorkouts.length === 0) return null;
    // Prefer furthest by distance, else longest by duration
    const withDist = thisWeekWorkouts.filter(w => (w.actualStats?.distance || 0) > 0);
    if (withDist.length > 0) {
      const best = withDist.sort((a, b) => (b.actualStats?.distance || 0) - (a.actualStats?.distance || 0))[0];
      const distKm = Math.round((best.actualStats?.distance || 0) / 100) / 10;
      const dur = best.actualStats?.duration ? Math.round(best.actualStats.duration / 60) : best.duration || 0;
      return { workout: best, metric: `${distKm}km`, sub: fmtDur(dur), label: 'Furthest' };
    }
    const withDur = thisWeekWorkouts.filter(w => {
      const d = w.actualStats?.duration ? w.actualStats.duration / 60 : w.duration || 0;
      return d > 0;
    });
    if (withDur.length > 0) {
      const best = withDur.sort((a, b) => {
        const da = a.actualStats?.duration ? a.actualStats.duration / 60 : a.duration || 0;
        const db = b.actualStats?.duration ? b.actualStats.duration / 60 : b.duration || 0;
        return db - da;
      })[0];
      const dur = best.actualStats?.duration ? Math.round(best.actualStats.duration / 60) : best.duration || 0;
      return { workout: best, metric: fmtDur(dur), sub: '', label: 'Longest' };
    }
    return null;
  }, [thisWeekWorkouts]);

  // Breakdown pie data
  const pieData = useMemo(() => {
    if (thisWeekWorkouts.length === 0) return [];
    const counts: Record<string, number> = {};
    thisWeekWorkouts.forEach(w => { counts[w.type] = (counts[w.type] || 0) + 1; });
    return Object.entries(counts).map(([type, count]) => ({
      type, count, pct: Math.round((count / thisWeekWorkouts.length) * 100),
    })).sort((a, b) => b.count - a.count);
  }, [thisWeekWorkouts]);

  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';
  const weekLabel = `${format(targetWeekStart, 'MMM d')} – ${format(targetWeekEnd, 'MMM d, yyyy')}`;
  const isCurrentWeek = weekOffset === 0;

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/wrap` : '';
  const shareText = `${rating.emoji} My week's capsule: ${activeSports.map(s => `${TYPE_EMOJI[s.type]} ${s.distanceKm > 0 ? `${s.distanceKm}km` : `${s.count} sessions`}`).join(', ')}.\n\nTracked on The Daily Athlete`;

  const maxDailyCount = Math.max(...dailyActivity.map(d => d.count), 1);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-foreground" />
          <p className="text-muted-foreground animate-pulse">Loading your wrap...</p>
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
          <a href="/dashboard" className="inline-block text-sm text-primary hover:underline">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-background/80 backdrop-blur-xl">
        <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors">
          <X className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(o => o + 1)} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-xs text-muted-foreground min-w-[140px] text-center">{weekLabel}</span>
          <button disabled={isCurrentWeek} onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
            className="p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-20">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <ThemeToggle />
      </div>

      {/* Capsule content */}
      <div ref={cardRef} className="w-full max-w-[calc(100vw-1rem)] sm:max-w-2xl lg:max-w-4xl mx-auto px-2 sm:px-6 py-5 space-y-4">

        {/* ═══ Hero — label, week, rating, stat badges ═══ */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 border border-border/30 p-5 sm:p-6">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase mb-1">Your Week&apos;s Capsule</p>
          <h2 className="text-foreground text-2xl sm:text-3xl font-black tracking-tight leading-none mb-0.5" style={{ WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility' }}>
            {weekLabel}
          </h2>
          <h1 className="text-foreground text-base sm:text-lg font-medium leading-tight mb-5">
            Dear {firstName}, this week was <span className="font-bold text-foreground">{rating.word}</span> {rating.emoji}
          </h1>
          {/* Stat badges — 3 or 4 across */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              { value: String(totalWorkouts), label: 'workouts' },
              { value: totalDistanceKm > 0 ? `${totalDistanceKm}km` : '—', label: 'distance' },
              { value: totalDurationMin > 0 ? fmtDur(totalDurationMin) : '—', label: 'time' },
              ...(totalCalories > 0 ? [{ value: `${totalCalories}`, label: 'calories' }] : []),
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-foreground/5 border border-border/20 py-3 text-center">
                <p className="text-2xl font-black text-foreground leading-none">{s.value}</p>
                <p className="text-[9px] text-muted-foreground mt-1.5 font-medium uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ Daily Activity — 7-day bar chart ═══ */}
        <div className="rounded-2xl bg-muted/10 border border-border/20 p-4 sm:p-5">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Daily Activity</h2>
          <div className="flex items-end gap-1.5 sm:gap-3 h-28 sm:h-36">
            {dailyActivity.map((d, i) => {
              const barH = d.count > 0 ? Math.max(12, (d.count / maxDailyCount) * 100) : 0;
              const color = d.primaryType ? (TYPE_COLOR[d.primaryType] || '#6b7280') : '#6b7280';
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex flex-col items-center justify-end flex-1">
                    {d.count > 0 && (
                      <span className="text-[10px] font-bold text-foreground mb-1">{d.count}</span>
                    )}
                    <div
                      className="w-full rounded-lg transition-all duration-500"
                      style={{
                        height: `${barH}%`,
                        backgroundColor: d.count > 0 ? color : 'transparent',
                        opacity: d.count > 0 ? 0.7 : 0,
                        minHeight: d.count > 0 ? 12 : 0,
                      }}
                    />
                    {d.count === 0 && (
                      <div className="w-full h-1 rounded-full bg-muted-foreground/10" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">{DAY_LABELS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ Two-column: Highlight + Breakdown ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Highlight of the Week */}
          {highlight && (
            <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-border/20 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{highlight.label} of the Week</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{TYPE_EMOJI[highlight.workout.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-black text-foreground leading-tight truncate">
                    {highlight.metric}
                  </p>
                  {highlight.sub && (
                    <p className="text-xs text-muted-foreground">{highlight.sub}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                    {highlight.workout.name || TYPE_NAME[highlight.workout.type]} · {format(toDate(highlight.workout), 'EEE')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Breakdown — horizontal stacked bar */}
          {pieData.length > 0 && (
            <div className="rounded-2xl bg-muted/10 border border-border/20 p-4 sm:p-5">
              <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Breakdown</h2>
              <div className="flex h-4 rounded-full overflow-hidden mb-3">
                {pieData.map(e => (
                  <div
                    key={e.type}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${e.pct}%`, backgroundColor: TYPE_COLOR[e.type] || '#6b7280' }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {pieData.map(e => (
                  <div key={e.type} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[e.type] || '#6b7280' }} />
                    <span className="text-xs text-muted-foreground font-medium">{TYPE_NAME[e.type] || e.type} {e.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ By Sport — grid on wider screens ═══ */}
        <div className="space-y-2">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">By Sport</h2>
          {activeSports.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 text-center py-6">No workouts this week. Next week is a fresh start!</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeSports.map(stat => {
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

      {/* Sticky share bar */}
      <div className="sticky bottom-0 z-20 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-xl border-t border-border/30">
        <div className="max-w-[calc(100vw-1rem)] sm:max-w-2xl lg:max-w-4xl mx-auto">
          {showShare ? (
            <ShareButtons
              title="Share Your Wrap"
              shareText={shareText}
              shareUrl={shareUrl}
              fileName={`weekly-wrap-${format(targetWeekStart, 'yyyy-MM-dd')}`}
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
