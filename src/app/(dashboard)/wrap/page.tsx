'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
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

const TYPE_LABEL: Record<string, string> = {
  run: 'ran', bike: 'cycled', swim: 'swam', strength: 'lifted', other: 'trained',
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

interface WeekHighlight {
  label: string;
  detail: string;
  emoji: string;
  photo?: string;
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

function detectHighlight(workouts: Workout[]): WeekHighlight | null {
  if (workouts.length === 0) return null;

  let longest: Workout | null = null;
  let longestDur = 0;
  let furthest: Workout | null = null;
  let furthestDist = 0;

  for (const w of workouts) {
    const dur = w.actualStats?.duration
      ? w.actualStats.duration / 60
      : w.duration || 0;
    if (dur > longestDur) { longestDur = dur; longest = w; }
    const dist = (w.actualStats?.distance || 0) / 1000;
    if (dist > furthestDist) { furthestDist = dist; furthest = w; }
  }

  if (longestDur >= 60 && longest) {
    const hours = Math.floor(longestDur / 60);
    const mins = Math.round(longestDur % 60);
    const timeStr = hours > 0
      ? `${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`
      : `${Math.round(longestDur)} minutes`;
    return {
      label: `You ${TYPE_LABEL[longest.type] || 'trained'} for ${timeStr} non-stop`,
      detail: longest.name,
      emoji: TYPE_EMOJI[longest.type] || '🏋️',
      photo: longest.photos?.[0],
    };
  }

  if (furthestDist >= 5 && furthest) {
    return {
      label: `You ${TYPE_LABEL[furthest.type] || 'went'} ${furthestDist.toFixed(1)}km in one session`,
      detail: furthest.name,
      emoji: TYPE_EMOJI[furthest.type] || '🏋️',
      photo: furthest.photos?.[0],
    };
  }

  const completedCount = workouts.filter(w => w.completed).length;
  if (completedCount > 0) {
    return {
      label: `You completed ${completedCount} workout${completedCount > 1 ? 's' : ''} this week`,
      detail: 'Keep showing up!',
      emoji: '🔥',
    };
  }
  return null;
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

function pctChange(curr: number, prev: number): string | null {
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return 'new this week';
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return `${pct}% more than last week`;
  if (pct < 0) return `${Math.abs(pct)}% less than last week`;
  return 'same as last week';
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
      const data = await getUserWorkouts(user.username, user.role);
      setWorkouts(data);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const now = new Date();
  const targetWeekEnd = subWeeks(endOfWeek(now, { weekStartsOn: 0 }), weekOffset);
  const targetWeekStart = startOfWeek(targetWeekEnd, { weekStartsOn: 0 });
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
  const highlight = useMemo(() => detectHighlight(thisWeekWorkouts), [thisWeekWorkouts]);
  const rating = useMemo(() => getWeekRating(sportStats), [sportStats]);

  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';
  const weekLabel = `${format(targetWeekStart, 'MMM d')} – ${format(targetWeekEnd, 'MMM d, yyyy')}`;
  const isCurrentWeek = weekOffset === 0;

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/wrap` : '';
  const shareText = `${rating.emoji} My week's capsule: ${sportStats.map(s => `${TYPE_EMOJI[s.type]} ${s.distanceKm > 0 ? `${s.distanceKm}km` : `${s.count} sessions`}`).join(', ')}.\n\nTracked on The Daily Athlete`;

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
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3 bg-background/80 backdrop-blur-xl">
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

      {/* Full-screen capsule content */}
      <div ref={cardRef} className="min-h-[calc(100vh-60px)] flex flex-col justify-center px-6 sm:px-10 md:px-16 lg:px-24 py-10">

        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">CT</span>
          </div>
          <span className="text-muted-foreground text-sm font-medium tracking-widest uppercase">
            Your Week&apos;s Capsule
          </span>
        </div>

        {/* Greeting */}
        <h1 className="text-foreground text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-2">
          Dear {firstName},
        </h1>
        <p className="text-muted-foreground text-xl sm:text-2xl mb-12">
          this week was <span className="text-foreground font-semibold">{rating.word}</span> {rating.emoji}
        </p>

        {/* Sport stats */}
        <div className="space-y-6 mb-12">
          {sportStats.length === 0 ? (
            <div className="py-12">
              <p className="text-muted-foreground text-lg">No workouts logged this week.</p>
              <p className="text-muted-foreground/60 text-base mt-2">Next week is a fresh start!</p>
            </div>
          ) : (
            sportStats.map(stat => {
              const mainMetric = stat.distanceKm > 0
                ? `${stat.distanceKm}km`
                : stat.durationMin > 0
                  ? `${stat.durationMin} min`
                  : `${stat.count} session${stat.count > 1 ? 's' : ''}`;

              const compVal = stat.distanceKm > 0
                ? pctChange(stat.distanceKm, stat.prevDistanceKm)
                : stat.durationMin > 0
                  ? pctChange(stat.durationMin, stat.prevDurationMin)
                  : pctChange(stat.count, stat.prevCount);

              const isPositive = compVal?.includes('more') || compVal === 'new this week';

              return (
                <div key={stat.type} className="flex items-start gap-4">
                  <span className="text-3xl sm:text-4xl mt-1">{TYPE_EMOJI[stat.type]}</span>
                  <div>
                    <p className="text-foreground text-xl sm:text-2xl">
                      You{' '}
                      <span style={{ color: TYPE_COLOR[stat.type] }} className="font-bold">
                        {TYPE_LABEL[stat.type] || 'trained'} {mainMetric}
                      </span>
                    </p>
                    {compVal && (
                      <p className={`text-base mt-1 ${isPositive ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                        {isPositive ? '↑' : '↓'} {compVal}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Highlight */}
        {highlight && (
          <div className="rounded-2xl overflow-hidden mb-12 max-w-2xl bg-muted/30 border border-border/40">
            {highlight.photo && (
              <div className="h-48 sm:h-64 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={highlight.photo} alt="Highlight" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6">
              <p className="text-muted-foreground text-xs uppercase tracking-widest font-medium mb-3">
                This week&apos;s highlight
              </p>
              <p className="text-foreground text-xl sm:text-2xl font-medium">
                {highlight.emoji} {highlight.label}
              </p>
              <p className="text-muted-foreground text-base mt-2">{highlight.detail}</p>
            </div>
          </div>
        )}

        {/* Footer stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground/60">
          <span>{thisWeekWorkouts.length} workout{thisWeekWorkouts.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{thisWeekWorkouts.filter(w => w.completed).length} completed</span>
          <span>·</span>
          <span>{weekLabel}</span>
        </div>
      </div>

      {/* Sticky share bar */}
      <div className="sticky bottom-0 z-20 p-4 bg-background/80 backdrop-blur-xl border-t border-border/30">
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
              className="w-full flex items-center justify-center gap-2.5 h-14 rounded-2xl text-base font-semibold bg-foreground text-background hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Share2 className="h-5 w-5" />
              Send to friends
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
