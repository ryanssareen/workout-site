'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout, WorkoutType } from '@/types';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import {
  startOfYear, endOfYear, format, isSameDay, getDay,
  eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth,
  isWithinInterval, subDays, differenceInDays,
} from 'date-fns';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { Loader2, X, Share2, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Constants ──

const YEAR = 2025; // Change this for different years
const TYPE_EMOJI: Record<string, string> = { run: '🏃', bike: '🚴', swim: '🏊', strength: '💪', other: '🏋️' };
const TYPE_LABEL: Record<string, string> = { run: 'Run', bike: 'Bike', swim: 'Swim', strength: 'Strength', other: 'Other' };
const TYPE_COLOR: Record<string, string> = {
  run: '#ef4444', bike: '#f97316', swim: '#dc2626', strength: '#b91c1c', other: '#991b1b',
};
const PIE_COLORS_RED = ['#ef4444', '#f97316', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'];

// ── Helpers ──

function toDate(w: Workout): Date {
  return (w.date as any)?.toDate?.() ?? new Date(w.date as any);
}

function fmtDuration(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtHours(totalMin: number): string {
  return `${Math.round(totalMin / 60)}`;
}

// ── Compute Stats ──

interface YearStats {
  totalWorkouts: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  totalCalories: number;
  totalElevationM: number;
  activeDays: number;
  maxStreak: number;
  sportBreakdown: { type: string; count: number; pct: number; distanceKm: number; durationMin: number }[];
  longestByType: Record<string, { name: string; date: Date; durationMin: number; distanceKm: number }>;
  furthestByType: Record<string, { name: string; date: Date; distanceKm: number; durationMin: number }>;
  monthlyActivity: { month: string; count: number }[];
  heatmap: { date: Date; count: number }[];
  events: { name: string; date: Date; type: string }[];
  totalPRs: number;
}

function computeYearStats(workouts: Workout[]): YearStats {
  const yearStart = startOfYear(new Date(YEAR, 0, 1));
  const yearEnd = endOfYear(new Date(YEAR, 0, 1));
  const yearWorkouts = workouts.filter(w => {
    const d = toDate(w);
    return isWithinInterval(d, { start: yearStart, end: yearEnd });
  });

  let totalDistanceM = 0, totalDurationSec = 0, totalCalories = 0, totalElevationM = 0, totalPRs = 0;
  const typeCounts: Record<string, number> = {};
  const typeDistM: Record<string, number> = {};
  const typeDurSec: Record<string, number> = {};
  const longestByType: Record<string, { name: string; date: Date; durationMin: number; distanceKm: number }> = {};
  const furthestByType: Record<string, { name: string; date: Date; distanceKm: number; durationMin: number }> = {};

  for (const w of yearWorkouts) {
    const d = toDate(w);
    const dist = w.actualStats?.distance || 0;
    const dur = w.actualStats?.duration || (w.duration || 0) * 60;
    totalDistanceM += dist;
    totalDurationSec += dur;
    totalCalories += w.actualStats?.calories || 0;
    totalElevationM += w.actualStats?.elevationGain || 0;
    totalPRs += (w.prs?.length || 0);

    typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
    typeDistM[w.type] = (typeDistM[w.type] || 0) + dist;
    typeDurSec[w.type] = (typeDurSec[w.type] || 0) + dur;

    const durMin = dur / 60;
    const distKm = dist / 1000;

    if (!longestByType[w.type] || durMin > longestByType[w.type].durationMin) {
      longestByType[w.type] = { name: w.name, date: d, durationMin: durMin, distanceKm: distKm };
    }
    if (!furthestByType[w.type] || distKm > furthestByType[w.type].distanceKm) {
      furthestByType[w.type] = { name: w.name, date: d, distanceKm: distKm, durationMin: durMin };
    }
  }

  // Sport breakdown
  const total = yearWorkouts.length || 1;
  const sportBreakdown = Object.entries(typeCounts)
    .map(([type, count]) => ({
      type, count,
      pct: Math.round((count / total) * 100),
      distanceKm: Math.round((typeDistM[type] || 0) / 100) / 10,
      durationMin: Math.round((typeDurSec[type] || 0) / 60),
    }))
    .sort((a, b) => b.count - a.count);

  // Active days & max streak
  const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });
  const activeDates = new Set<string>();
  for (const w of yearWorkouts) {
    activeDates.add(format(toDate(w), 'yyyy-MM-dd'));
  }
  const activeDays = activeDates.size;

  let maxStreak = 0, currentStreak = 0;
  for (const day of allDays) {
    if (activeDates.has(format(day, 'yyyy-MM-dd'))) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  // Monthly activity
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
  const monthlyActivity = months.map(m => {
    const ms = startOfMonth(m);
    const me = endOfMonth(m);
    const count = yearWorkouts.filter(w => isWithinInterval(toDate(w), { start: ms, end: me })).length;
    return { month: format(m, 'MMM'), count };
  });

  // Heatmap
  const heatmap = allDays.map(day => ({
    date: day,
    count: yearWorkouts.filter(w => isSameDay(toDate(w), day)).length,
  }));

  // Events (races tagged with 'race')
  const events = yearWorkouts
    .filter(w => w.tags?.includes('race'))
    .map(w => ({ name: w.name, date: toDate(w), type: w.type }));

  return {
    totalWorkouts: yearWorkouts.length,
    totalDistanceKm: Math.round(totalDistanceM / 100) / 10,
    totalDurationMin: Math.round(totalDurationSec / 60),
    totalCalories: Math.round(totalCalories),
    totalElevationM: Math.round(totalElevationM),
    activeDays,
    maxStreak,
    sportBreakdown,
    longestByType,
    furthestByType,
    monthlyActivity,
    heatmap,
    events,
    totalPRs,
  };
}

// ── Slides ──

type Slide = 'guess' | 'reveal' | 'stats' | 'breakdown' | 'records' | 'heatmap' | 'final';
const SLIDES: Slide[] = ['guess', 'reveal', 'stats', 'breakdown', 'records', 'heatmap', 'final'];

// ── Page ──

export default function YearlyWrappedPage() {
  const user = useAuthStore((s) => s.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [guess, setGuess] = useState('');
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [animateIn, setAnimateIn] = useState(false);

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

  const stats = useMemo(() => computeYearStats(workouts), [workouts]);
  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';

  // Trigger animation on slide change
  useEffect(() => {
    setAnimateIn(false);
    const t = setTimeout(() => setAnimateIn(true), 50);
    return () => clearTimeout(t);
  }, [currentSlide]);

  const goNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(c => c + 1);
    }
  }, [currentSlide]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(c => c - 1);
    }
  }, [currentSlide]);

  // Handle guess submit
  const handleGuess = () => {
    if (!guess.trim()) return;
    setGuessSubmitted(true);
    // Auto-advance to reveal after short delay
    setTimeout(() => setCurrentSlide(1), 1500);
  };

  // Guess response logic
  const guessNum = parseInt(guess) || 0;
  const actual = stats.totalWorkouts;
  const diff = Math.abs(guessNum - actual);
  const pctDiff = actual > 0 ? (diff / actual) * 100 : 0;

  let guessResponse = '';
  let guessEmoji = '';
  if (guessNum === actual) {
    guessResponse = `NO WAY THAT'S INSANEEEEEE! You guessed it exactly right!`;
    guessEmoji = '🤯';
  } else if (pctDiff <= 10) {
    guessResponse = `So close! You actually did ${actual}. That's impressive!`;
    guessEmoji = '🔥';
  } else if (pctDiff <= 25) {
    guessResponse = `Not bad! But you actually did ${actual} workouts this year.`;
    guessEmoji = '💪';
  } else if (guessNum > actual) {
    guessResponse = `Not even close 😅 You did ${actual}. But still, that's ${actual} more than zero!`;
    guessEmoji = '😅';
  } else {
    guessResponse = `Way off! You actually crushed ${actual} workouts! More than you thought!`;
    guessEmoji = '🚀';
  }

  // Pie data
  const pieData = stats.sportBreakdown.map((s, i) => ({
    name: TYPE_LABEL[s.type] || s.type, value: s.count, type: s.type, pct: s.pct,
  }));

  const shareText = `🏆 My ${YEAR} Wrapped: ${stats.totalWorkouts} workouts, ${stats.totalDistanceKm}km, ${Math.round(stats.totalDurationMin / 60)}hrs — The Daily Athlete`;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/wrapped` : '';

  if (loading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-red-500" />
          <p className="text-red-400/60 animate-pulse text-sm">Loading your year...</p>
        </div>
      </div>
    );
  }

  const slide = SLIDES[currentSlide];
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === SLIDES.length - 1;

  // Progress dots
  const progressBar = (
    <div className="flex items-center gap-1.5 justify-center mt-4">
      {SLIDES.map((_, i) => (
        <button
          key={i}
          onClick={() => {
            if (i === 0 || guessSubmitted) setCurrentSlide(i);
          }}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === currentSlide ? 'w-6 bg-red-500' : 'w-1.5 bg-white/20',
            i > 0 && !guessSubmitted && 'opacity-30 cursor-not-allowed',
          )}
        />
      ))}
    </div>
  );

  return (
    <div className="dark min-h-screen bg-black text-white relative">
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-xl">
        <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <X className="h-5 w-5 text-white/60" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-red-600 flex items-center justify-center">
            <span className="text-white font-bold text-[8px]">CT</span>
          </div>
          <span className="text-white/40 text-xs font-medium tracking-widest uppercase">{YEAR} Wrapped</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Slide content */}
      <div
        ref={cardRef}
        className={cn(
          'min-h-[calc(100vh-120px)] flex flex-col justify-center px-6 sm:px-12 md:px-20 py-8 transition-all duration-500',
          animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
      >
        {/* ═══ SLIDE: GUESS ═══ */}
        {slide === 'guess' && (
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="text-6xl mb-6">🏋️</div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
              You did <span className="text-red-500">a lot</span> of workouts in {YEAR}
            </h1>
            <p className="text-white/50 text-lg mb-10">Guess how many</p>

            {!guessSubmitted ? (
              <div className="w-full max-w-xs space-y-4">
                <input
                  type="number"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGuess()}
                  placeholder="Your guess..."
                  className="w-full text-center text-4xl font-bold bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
                  autoFocus
                />
                <button
                  onClick={handleGuess}
                  disabled={!guess.trim()}
                  className="w-full py-4 rounded-2xl bg-red-600 text-white font-bold text-lg hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  Lock it in 🔒
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-5xl font-bold text-red-500">{guessNum}</div>
                <p className="text-white/40 text-sm">Let&apos;s see...</p>
                <Loader2 className="h-6 w-6 animate-spin text-red-500 mx-auto" />
              </div>
            )}
          </div>
        )}

        {/* ═══ SLIDE: REVEAL ═══ */}
        {slide === 'reveal' && (
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="text-6xl mb-4">{guessEmoji}</div>
            <div className="relative mb-6">
              <div className="text-[120px] sm:text-[160px] font-black leading-none text-red-500 tracking-tighter">
                {actual}
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-white/30 text-sm font-medium tracking-widest uppercase">
                workouts
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-medium text-white/80 leading-relaxed max-w-sm">
              {guessResponse}
            </p>
            <button onClick={goNext} className="mt-10 flex items-center gap-2 text-red-400 text-sm font-medium hover:text-red-300 transition-colors">
              See your stats <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ═══ SLIDE: STATS ═══ */}
        {slide === 'stats' && (
          <div className="max-w-2xl mx-auto w-full">
            <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-6">Your {YEAR} in numbers</p>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                { value: `${stats.totalDistanceKm}`, unit: 'km', label: 'Total Distance', icon: '🌍' },
                { value: fmtHours(stats.totalDurationMin), unit: 'hrs', label: 'Total Hours', icon: '⏱️' },
                { value: `${stats.activeDays}`, unit: 'days', label: 'Active Days', icon: '📅' },
                { value: `${stats.maxStreak}`, unit: 'day streak', label: 'Max Streak', icon: '🔥' },
                { value: `${Math.round(stats.totalElevationM).toLocaleString()}`, unit: 'm', label: 'Elevation Gain', icon: '⛰️' },
                { value: `${stats.totalCalories > 0 ? Math.round(stats.totalCalories / 1000) + 'k' : '-'}`, unit: 'cal', label: 'Calories Burned', icon: '🔥' },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className={cn(
                    'rounded-2xl border border-white/5 p-4 sm:p-5 bg-gradient-to-br transition-all duration-500',
                    i === 0 ? 'from-red-500/20 to-red-900/10' :
                    i === 1 ? 'from-orange-500/15 to-orange-900/5' :
                    i === 2 ? 'from-red-600/15 to-red-900/5' :
                    i === 3 ? 'from-amber-500/15 to-amber-900/5' :
                    i === 4 ? 'from-red-700/15 to-red-900/5' :
                    'from-rose-500/15 to-rose-900/5',
                    animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                  )}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <span className="text-2xl">{stat.icon}</span>
                  <div className="mt-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-white">{stat.value}</span>
                      <span className="text-sm text-white/40">{stat.unit}</span>
                    </div>
                    <p className="text-white/30 text-xs mt-0.5">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {stats.totalElevationM > 0 && (
              <div className="mt-4 text-center">
                <p className="text-white/30 text-xs">
                  That&apos;s <span className="text-red-400 font-bold">{(stats.totalElevationM / 8849).toFixed(1)}x</span> up Everest 🏔️
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══ SLIDE: BREAKDOWN ═══ */}
        {slide === 'breakdown' && (
          <div className="max-w-lg mx-auto w-full">
            <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-6">Workout Breakdown</p>

            <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
              {/* Pie chart */}
              <div className="w-48 h-48 sm:w-56 sm:h-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius="40%" outerRadius="80%"
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                      animationBegin={0}
                      animationDuration={1000}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={entry.type} fill={TYPE_COLOR[entry.type] || PIE_COLORS_RED[i % PIE_COLORS_RED.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-3 w-full">
                {stats.sportBreakdown.map((s, i) => (
                  <div
                    key={s.type}
                    className={cn(
                      'flex items-center gap-3 transition-all duration-500',
                      animateIn ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4',
                    )}
                    style={{ transitionDelay: `${i * 150}ms` }}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLOR[s.type] }} />
                    <div className="flex-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{TYPE_EMOJI[s.type]}</span>
                        <span className="text-white font-semibold text-sm">{TYPE_LABEL[s.type] || s.type}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-bold">{s.count}</span>
                        <span className="text-white/30 text-xs ml-1">({s.pct}%)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-sport distance/time */}
            <div className="grid grid-cols-2 gap-2">
              {stats.sportBreakdown.filter(s => s.distanceKm > 0 || s.durationMin > 0).map(s => (
                <div key={s.type} className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
                  <span className="text-xl">{TYPE_EMOJI[s.type]}</span>
                  <div className="mt-1">
                    {s.distanceKm > 0 && (
                      <p className="text-white font-bold text-lg">{s.distanceKm}<span className="text-white/40 text-xs ml-0.5">km</span></p>
                    )}
                    <p className="text-white/40 text-xs">{fmtDuration(s.durationMin)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SLIDE: RECORDS ═══ */}
        {slide === 'records' && (
          <div className="max-w-lg mx-auto w-full">
            <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-6">Your Records</p>

            <div className="space-y-3">
              {/* Longest workouts per type */}
              {Object.entries(stats.longestByType)
                .filter(([, v]) => v.durationMin > 30)
                .sort(([, a], [, b]) => b.durationMin - a.durationMin)
                .slice(0, 4)
                .map(([type, record], i) => (
                  <div
                    key={`longest-${type}`}
                    className={cn(
                      'rounded-2xl bg-gradient-to-r from-white/5 to-transparent border border-white/5 p-4 transition-all duration-500',
                      animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                    )}
                    style={{ transitionDelay: `${i * 150}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{TYPE_EMOJI[type]}</span>
                        <div>
                          <p className="text-white/40 text-xs">Longest {TYPE_LABEL[type] || type}</p>
                          <p className="text-white font-bold text-lg">{fmtDuration(record.durationMin)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {record.distanceKm > 0 && (
                          <p className="text-red-400 font-bold">{record.distanceKm.toFixed(1)}<span className="text-xs text-red-400/60 ml-0.5">km</span></p>
                        )}
                        <p className="text-white/20 text-xs">{format(record.date, 'MMM d')}</p>
                      </div>
                    </div>
                    <p className="text-white/30 text-xs mt-2 truncate">{record.name}</p>
                  </div>
                ))}

              {/* Furthest distances per type */}
              {Object.entries(stats.furthestByType)
                .filter(([type, v]) => v.distanceKm > 5 && v.distanceKm > (stats.longestByType[type]?.distanceKm || 0) * 0.9)
                .sort(([, a], [, b]) => b.distanceKm - a.distanceKm)
                .slice(0, 3)
                .map(([type, record], i) => {
                  // Skip if already covered in longest
                  const longestForType = stats.longestByType[type];
                  if (longestForType && longestForType.name === record.name) return null;
                  return (
                    <div
                      key={`furthest-${type}`}
                      className={cn(
                        'rounded-2xl bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/10 p-4 transition-all duration-500',
                        animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                      )}
                      style={{ transitionDelay: `${(i + 4) * 150}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{TYPE_EMOJI[type]}</span>
                          <div>
                            <p className="text-white/40 text-xs">Furthest {TYPE_LABEL[type] || type}</p>
                            <p className="text-red-400 font-bold text-lg">{record.distanceKm.toFixed(1)}<span className="text-xs text-red-400/60 ml-0.5">km</span></p>
                          </div>
                        </div>
                        <p className="text-white/20 text-xs">{format(record.date, 'MMM d')}</p>
                      </div>
                      <p className="text-white/30 text-xs mt-2 truncate">{record.name}</p>
                    </div>
                  );
                })}

              {/* Events */}
              {stats.events.length > 0 && (
                <div className="mt-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/10 p-4">
                  <p className="text-amber-400/60 text-xs font-medium tracking-widest uppercase mb-2">🏅 Events / Races</p>
                  <p className="text-white font-bold text-2xl">{stats.events.length}</p>
                  <div className="mt-2 space-y-1">
                    {stats.events.slice(0, 5).map((e, i) => (
                      <p key={i} className="text-white/50 text-xs">
                        {TYPE_EMOJI[e.type]} {e.name} · {format(e.date, 'MMM d')}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {stats.totalPRs > 0 && (
                <div className="rounded-2xl bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/10 p-4 text-center">
                  <p className="text-red-400/60 text-xs font-medium tracking-widest uppercase">Personal Records Set</p>
                  <p className="text-red-400 font-black text-4xl mt-1">{stats.totalPRs}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ SLIDE: HEATMAP ═══ */}
        {slide === 'heatmap' && (
          <div className="max-w-3xl mx-auto w-full">
            <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-2">Activity Heatmap</p>
            <p className="text-white/20 text-xs mb-4">{stats.activeDays} active days out of 365</p>

            {/* Monthly bar chart (simple) */}
            <div className="mb-6">
              <div className="flex items-end gap-1 h-24">
                {stats.monthlyActivity.map((m, i) => {
                  const maxCount = Math.max(...stats.monthlyActivity.map(x => x.count), 1);
                  const height = (m.count / maxCount) * 100;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-white/50 text-[10px] font-bold">{m.count}</span>
                      <div
                        className={cn(
                          'w-full rounded-t-sm transition-all duration-700',
                          m.count > 0 ? 'bg-red-500' : 'bg-white/5',
                        )}
                        style={{
                          height: `${Math.max(height, 2)}%`,
                          opacity: m.count > 0 ? 0.4 + (height / 100) * 0.6 : 0.3,
                          transitionDelay: `${i * 60}ms`,
                        }}
                      />
                      <span className="text-white/30 text-[9px]">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GitHub-style heatmap */}
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-[2px] min-w-[680px]">
                {/* Group by week */}
                {(() => {
                  const weeks: { date: Date; count: number }[][] = [];
                  let currentWeek: { date: Date; count: number }[] = [];

                  // Pad start to align to Sunday
                  const firstDay = stats.heatmap[0];
                  if (firstDay) {
                    const dayOfWeek = getDay(firstDay.date);
                    for (let i = 0; i < dayOfWeek; i++) {
                      currentWeek.push({ date: new Date(), count: -1 }); // placeholder
                    }
                  }

                  for (const day of stats.heatmap) {
                    currentWeek.push(day);
                    if (getDay(day.date) === 6) { // Saturday = end of week
                      weeks.push(currentWeek);
                      currentWeek = [];
                    }
                  }
                  if (currentWeek.length > 0) weeks.push(currentWeek);

                  return weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[2px]">
                      {week.map((day, di) => (
                        <div
                          key={di}
                          className={cn(
                            'w-[11px] h-[11px] rounded-[2px] transition-all duration-300',
                            day.count < 0 ? 'bg-transparent' :
                            day.count === 0 ? 'bg-white/5' :
                            day.count === 1 ? 'bg-red-500/40' :
                            day.count === 2 ? 'bg-red-500/60' :
                            'bg-red-500',
                          )}
                          style={{ transitionDelay: `${wi * 5}ms` }}
                          title={day.count >= 0 ? `${format(day.date, 'MMM d')}: ${day.count} workout${day.count !== 1 ? 's' : ''}` : ''}
                        />
                      ))}
                    </div>
                  ));
                })()}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-1 mt-2">
                <span className="text-white/20 text-[9px] mr-1">Less</span>
                <div className="w-[11px] h-[11px] rounded-[2px] bg-white/5" />
                <div className="w-[11px] h-[11px] rounded-[2px] bg-red-500/40" />
                <div className="w-[11px] h-[11px] rounded-[2px] bg-red-500/60" />
                <div className="w-[11px] h-[11px] rounded-[2px] bg-red-500" />
                <span className="text-white/20 text-[9px] ml-1">More</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ SLIDE: FINAL ═══ */}
        {slide === 'final' && (
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="text-6xl mb-6">🏆</div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">
              That&apos;s a wrap, <span className="text-red-500">{firstName}</span>!
            </h1>
            <p className="text-white/50 text-lg mb-3">
              {YEAR} was {stats.totalWorkouts > 200 ? 'legendary' :
                stats.totalWorkouts > 100 ? 'incredible' :
                stats.totalWorkouts > 50 ? 'impressive' : 'a great start'}.
            </p>
            <div className="flex items-center gap-4 text-white/30 text-sm mb-10">
              <span>{stats.totalWorkouts} workouts</span>
              <span>·</span>
              <span>{stats.totalDistanceKm}km</span>
              <span>·</span>
              <span>{Math.round(stats.totalDurationMin / 60)}hrs</span>
            </div>

            <p className="text-white/30 text-xs mb-6">Share your {YEAR} wrapped with friends</p>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-30 px-4 pb-6 pt-3 bg-gradient-to-t from-black via-black/80 to-transparent">
        {progressBar}

        {/* Nav buttons or share */}
        {slide === 'final' ? (
          <div className="mt-4 max-w-lg mx-auto">
            {showShare ? (
              <ShareButtons
                title={`${YEAR} Wrapped`}
                shareText={shareText}
                shareUrl={shareUrl}
                fileName={`${YEAR}-wrapped`}
                cardRef={cardRef}
                captureBg="#000000"
                onClose={() => setShowShare(false)}
              />
            ) : (
              <button
                onClick={() => setShowShare(true)}
                className="w-full flex items-center justify-center gap-2.5 h-14 rounded-2xl text-base font-bold bg-red-600 text-white hover:bg-red-500 active:scale-[0.98] transition-all"
              >
                <Share2 className="h-5 w-5" />
                Share Your Wrapped
              </button>
            )}
          </div>
        ) : slide !== 'guess' && (
          <div className="mt-4 flex items-center justify-between max-w-lg mx-auto">
            <button
              onClick={goPrev}
              disabled={isFirst}
              className="px-4 py-2 text-white/40 text-sm hover:text-white/60 disabled:opacity-20 transition-colors"
            >
              Back
            </button>
            <button
              onClick={goNext}
              disabled={isLast}
              className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 disabled:opacity-20 transition-all active:scale-95"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
