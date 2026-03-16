'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { Workout, WorkoutType } from '@/types';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import {
  startOfWeek, endOfWeek, subWeeks, isWithinInterval, format,
} from 'date-fns';
import { Share2, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

// ── Helpers ──

function toDate(w: Workout): Date {
  return w.date?.toDate?.() ?? new Date(w.date as any);
}

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', strength: '💪', other: '🏋️',
};

const TYPE_NAME: Record<string, string> = {
  run: 'Running', bike: 'Cycling', swim: 'Swimming', strength: 'Strength', other: 'Other',
};

const TYPE_BG: Record<string, string> = {
  run: 'from-green-500/20 to-green-500/5', bike: 'from-orange-500/20 to-orange-500/5',
  swim: 'from-blue-500/20 to-blue-500/5', strength: 'from-purple-500/20 to-purple-500/5',
  other: 'from-gray-500/20 to-gray-500/5',
};

const TYPE_COLOR: Record<string, string> = {
  run: '#22c55e', bike: '#f97316', swim: '#3b82f6', strength: '#a855f7', other: '#6b7280',
};

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

// ── Page ──

export default function WrapPage() {
  const user = useAuthStore((s) => s.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

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
  const fmtDur = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };

  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';
  const weekLabel = `${format(targetWeekStart, 'MMM d')} – ${format(targetWeekEnd, 'MMM d, yyyy')}`;
  const isCurrentWeek = weekOffset === 0;

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/wrap` : '';
  const shareText = `${rating.emoji} My week's capsule: ${activeSports.map(s => `${TYPE_EMOJI[s.type]} ${s.distanceKm > 0 ? `${s.distanceKm}km` : `${s.count} sessions`}`).join(', ')}.\n\nTracked on The Daily Athlete`;

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
      <div ref={cardRef} className="w-full max-w-lg mx-auto px-4 py-5 space-y-3">

        {/* ═══ Hero — label, week, rating, stat badges ═══ */}
        <div className="rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 border border-border/30 p-4">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase mb-1">Your Week&apos;s Capsule</p>
          <h2 className="text-foreground text-2xl font-black tracking-tight leading-none mb-0.5" style={{ WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility' }}>
            {weekLabel}
          </h2>
          <h1 className="text-foreground text-base font-medium leading-tight mb-4">
            Dear {firstName}, this week was <span className="font-bold text-foreground">{rating.word}</span> {rating.emoji}
          </h1>
          {/* Stat badges — 3 across */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: String(totalWorkouts), label: 'workouts' },
              { value: totalDistanceKm > 0 ? `${totalDistanceKm}km` : '—', label: 'distance' },
              { value: totalDurationMin > 0 ? fmtDur(totalDurationMin) : '—', label: 'time' },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-foreground/5 border border-border/20 py-2.5 text-center">
                <p className="text-xl font-black text-foreground leading-none">{s.value}</p>
                <p className="text-[9px] text-muted-foreground mt-1 font-medium uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ By Sport — only active sports ═══ */}
        <div className="space-y-1.5">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">By Sport</h2>
          {activeSports.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 text-center py-4">No workouts this week. Next week is a fresh start!</div>
          ) : (
            activeSports.map(stat => {
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
            })
          )}
        </div>

        {/* ═══ Footer branding ═══ */}
        <div className="pt-1 pb-2 text-center">
          <p className="text-[10px] text-muted-foreground/50 font-medium tracking-wider uppercase">The Daily Athlete</p>
        </div>
      </div>

      {/* Sticky share bar */}
      <div className="sticky bottom-0 z-20 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-xl border-t border-border/30">
        <div className="max-w-lg mx-auto">
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
