'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { Workout, WorkoutType } from '@/types';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import {
  startOfWeek, endOfWeek, subWeeks, isWithinInterval, format,
  eachDayOfInterval, isSameDay,
} from 'date-fns';
import { Share2, Loader2, ChevronLeft, ChevronRight, X, Trophy, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

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

// ── Helpers ──

function toDate(w: Workout): Date {
  try {
    const d = w.date?.toDate?.() ?? new Date(w.date as any);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch { return new Date(0); }
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
  const [slide, setSlide] = useState(0);
  const [animateIn, setAnimateIn] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const TOTAL_SLIDES = 4;

  // Trigger animation on slide change
  useEffect(() => {
    setAnimateIn(false);
    const t = setTimeout(() => setAnimateIn(true), 50);
    return () => clearTimeout(t);
  }, [slide]);

  // Reset to slide 0 when week changes
  useEffect(() => { setSlide(0); }, [weekOffset]);

  const goNext = useCallback(() => setSlide(s => Math.min(s + 1, TOTAL_SLIDES - 1)), []);
  const goPrev = useCallback(() => setSlide(s => Math.max(s - 1, 0)), []);

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

  // Animated counters for slide 1
  const countWorkouts = useCountUp(totalWorkouts, 1000, slide === 1 && animateIn);
  const countDist = useCountUp(Math.round(totalDistanceKm), 1200, slide === 1 && animateIn);
  const countDur = useCountUp(totalDurationMin, 1400, slide === 1 && animateIn);

  const progressPct = ((slide + 1) / TOTAL_SLIDES) * 100;

  return (
    <div className="fixed inset-0 bg-background overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="z-20 flex items-center justify-between px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-background/80 backdrop-blur-xl border-b border-border/10">
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

      {/* Slide content — fills remaining space */}
      <div
        ref={cardRef}
        className={cn(
          'flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-20 transition-all duration-500',
          animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        )}
      >
        {/* ═══ SLIDE 0 — The Verdict ═══ */}
        {slide === 0 && (
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="text-8xl sm:text-9xl mb-6 drop-shadow-lg" style={{ animation: animateIn ? 'popIn 0.6s ease-out' : undefined }}>
              {rating.emoji}
            </div>
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-2">Your Week&apos;s Capsule</p>
            <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight leading-tight mb-3">
              This week was<br />
              <span className="text-primary">{rating.word}</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              {format(targetWeekStart, 'MMM d')} – {format(targetWeekEnd, 'MMM d')}
            </p>
            <button
              onClick={goNext}
              className="mt-10 group flex items-center gap-2 text-primary text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              See the numbers <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* ═══ SLIDE 1 — The Numbers ═══ */}
        {slide === 1 && (
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-8">The Numbers</p>
            <div className="space-y-8 w-full">
              {[
                { value: countWorkouts, unit: '', label: 'workouts', delay: '0ms' },
                ...(totalDistanceKm > 0 ? [{ value: countDist, unit: 'km', label: 'distance covered', delay: '150ms' }] : []),
                ...(totalDurationMin > 0 ? [{ value: countDur > 60 ? Math.floor(countDur / 60) : countDur, unit: countDur > 60 ? 'hrs' : 'min', label: 'of training', delay: '300ms' }] : []),
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="transition-all duration-700"
                  style={{
                    opacity: animateIn ? 1 : 0,
                    transform: animateIn ? 'translateY(0)' : 'translateY(20px)',
                    transitionDelay: stat.delay,
                  }}
                >
                  <div className="text-6xl sm:text-7xl font-black text-foreground tracking-tighter leading-none">
                    {stat.value}<span className="text-primary">{stat.unit}</span>
                  </div>
                  <p className="text-muted-foreground text-sm mt-1 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SLIDE 2 — Day by Day ═══ */}
        {slide === 2 && (
          <div className="max-w-lg mx-auto w-full">
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-6 text-center">Day by Day</p>
            <div className="flex items-end gap-2 sm:gap-4 h-40 sm:h-52 mb-8">
              {dailyActivity.map((d, i) => {
                const barH = d.count > 0 ? Math.max(16, (d.count / maxDailyCount) * 100) : 0;
                const color = d.primaryType ? (TYPE_COLOR[d.primaryType] || '#6b7280') : '#6b7280';
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col items-center justify-end flex-1">
                      {d.count > 0 && (
                        <span className="text-lg font-black text-foreground mb-1">{d.count > 0 ? TYPE_EMOJI[d.primaryType] || '🏋️' : ''}</span>
                      )}
                      <div
                        className="w-full rounded-xl transition-all"
                        style={{
                          height: animateIn ? `${barH}%` : '0%',
                          backgroundColor: d.count > 0 ? color : 'transparent',
                          opacity: d.count > 0 ? 0.75 : 0,
                          minHeight: d.count > 0 ? 16 : 0,
                          transitionDuration: '800ms',
                          transitionDelay: `${i * 80}ms`,
                          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                      />
                      {d.count === 0 && <div className="w-full h-1 rounded-full bg-muted-foreground/10" />}
                    </div>
                    <span className="text-xs text-muted-foreground font-bold">{DAY_LABELS[i]}</span>
                  </div>
                );
              })}
            </div>

            {/* Highlight */}
            {highlight && (
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 p-5 flex items-center gap-4"
                style={{ opacity: animateIn ? 1 : 0, transform: animateIn ? 'scale(1)' : 'scale(0.95)', transition: 'all 500ms 400ms' }}
              >
                <Trophy className="h-8 w-8 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-500/80 font-bold uppercase tracking-wider">{highlight.label} of the Week</p>
                  <p className="text-2xl font-black text-foreground leading-tight truncate">
                    {TYPE_EMOJI[highlight.workout.type]} {highlight.metric}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {highlight.workout.name || TYPE_NAME[highlight.workout.type]} · {format(toDate(highlight.workout), 'EEEE')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ SLIDE 3 — By Sport + Share ═══ */}
        {slide === 3 && (
          <div className="max-w-lg mx-auto w-full overflow-y-auto max-h-[calc(100vh-200px)]">
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase mb-6 text-center">By Sport</p>

            {/* Breakdown bar */}
            {pieData.length > 0 && (
              <div className="mb-6">
                <div className="flex h-6 rounded-full overflow-hidden mb-3">
                  {pieData.map((e, i) => (
                    <div
                      key={e.type}
                      className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                      style={{
                        width: animateIn ? `${e.pct}%` : '0%',
                        backgroundColor: TYPE_COLOR[e.type] || '#6b7280',
                        transitionDuration: '800ms',
                        transitionDelay: `${i * 100}ms`,
                      }}
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
            {activeSports.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">😴</div>
                <p className="text-muted-foreground">No workouts this week. Next week is a fresh start!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeSports.map((stat, i) => {
                  const metric = stat.distanceKm > 0 ? `${stat.distanceKm}km` : stat.durationMin > 0 ? fmtDur(stat.durationMin) : `${stat.count}x`;
                  const detail = stat.distanceKm > 0 ? `${stat.count} sessions · ${fmtDur(stat.durationMin)}` : `${stat.count} sessions`;
                  const comp = stat.distanceKm > 0 ? pctChange(stat.distanceKm, stat.prevDistanceKm) : stat.durationMin > 0 ? pctChange(stat.durationMin, stat.prevDurationMin) : pctChange(stat.count, stat.prevCount);
                  return (
                    <div
                      key={stat.type}
                      className={`flex items-center gap-4 rounded-2xl bg-gradient-to-r ${TYPE_BG[stat.type] || TYPE_BG.other} border border-border/20 px-5 py-4 transition-all duration-500`}
                      style={{ opacity: animateIn ? 1 : 0, transform: animateIn ? 'translateX(0)' : 'translateX(-20px)', transitionDelay: `${i * 100}ms` }}
                    >
                      <span className="text-3xl">{TYPE_EMOJI[stat.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-black leading-tight" style={{ color: TYPE_COLOR[stat.type] }}>{TYPE_NAME[stat.type]}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{metric} · {detail}</p>
                      </div>
                      {comp && <span className={`text-sm font-black ${comp.positive ? 'text-emerald-500' : 'text-red-500'}`}>{comp.text}</span>}
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

      {/* Bottom bar — progress + nav */}
      <div className="z-20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-xl border-t border-border/10">
        <div className="max-w-lg mx-auto">
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-muted/30 overflow-hidden mb-3">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>

          {slide === TOTAL_SLIDES - 1 ? (
            showShare ? (
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
                className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <Share2 className="h-4 w-4" />
                Share Your Week
              </button>
            )
          ) : (
            <div className="flex items-center justify-between">
              <button
                onClick={goPrev}
                disabled={slide === 0}
                className="px-4 py-2.5 text-muted-foreground text-sm font-medium hover:text-foreground disabled:opacity-20 transition-colors"
              >
                Back
              </button>
              <div className="flex gap-1.5">
                {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      i === slide ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/20',
                    )}
                  />
                ))}
              </div>
              <button
                onClick={goNext}
                className="group flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 transition-all active:scale-95"
              >
                Next <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.3); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
