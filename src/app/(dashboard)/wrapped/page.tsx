'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { Workout } from '@/types';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import { Loader2, X, Share2, ChevronRight, ChevronLeft, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import {
  YEAR, SLIDES, computeYearStats,
  StatsSlide, BreakdownSlide, RecordsSlide, HeatmapSlide, SummarySlide, FinalSlide,
} from '@/components/wrapped/WrappedSlides';
import type { Slide } from '@/components/wrapped/WrappedSlides';

// ── Slide gradient backgrounds ──────────────────────────────────────

const SLIDE_GRADIENTS: Record<Slide, string> = {
  guess: 'bg-gradient-to-br from-indigo-950 via-slate-950 to-black',
  reveal: 'bg-gradient-to-br from-red-950 via-orange-950/80 to-black',
  stats: 'bg-gradient-to-br from-blue-950 via-slate-950 to-indigo-950/80',
  breakdown: 'bg-gradient-to-br from-purple-950 via-slate-950 to-fuchsia-950/60',
  records: 'bg-gradient-to-br from-amber-950 via-slate-950 to-yellow-950/60',
  heatmap: 'bg-gradient-to-br from-emerald-950 via-slate-950 to-teal-950/60',
  summary: 'bg-gradient-to-br from-orange-950 via-slate-950 to-rose-950/60',
  final: 'bg-gradient-to-br from-red-950 via-purple-950 to-indigo-950',
};

// Radial glow overlays per slide (inline styles for radial gradients)
const SLIDE_GLOW: Record<Slide, string> = {
  guess: 'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.15) 0%, transparent 70%)',
  reveal: 'radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.2) 0%, transparent 60%)',
  stats: 'radial-gradient(ellipse at 50% 30%, rgba(59,130,246,0.15) 0%, transparent 70%)',
  breakdown: 'radial-gradient(ellipse at 50% 30%, rgba(168,85,247,0.15) 0%, transparent 70%)',
  records: 'radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.15) 0%, transparent 70%)',
  heatmap: 'radial-gradient(ellipse at 50% 30%, rgba(16,185,129,0.15) 0%, transparent 70%)',
  summary: 'radial-gradient(ellipse at 50% 30%, rgba(249,115,22,0.15) 0%, transparent 70%)',
  final: 'radial-gradient(ellipse at 50% 50%, rgba(239,68,68,0.2) 0%, rgba(168,85,247,0.1) 50%, transparent 80%)',
};

// ── Animated counter hook ────────────────────────────────────────────

function useCountUp(target: number, duration: number = 1500, enabled: boolean = true) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, enabled]);

  return value;
}

// ── Page ──

export default function YearlyWrappedPage() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [guess, setGuess] = useState('');
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [animateIn, setAnimateIn] = useState(false);

  // Stats computed once and locked — never recomputed even if component re-renders
  const statsRef = useRef<ReturnType<typeof computeYearStats> | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    async function load() {
      if (!user || fetchedRef.current) return;
      fetchedRef.current = true;
      const { getWorkouts } = useWorkoutStore.getState();
      const data = await getWorkouts(user.username, user.role);
      statsRef.current = computeYearStats(data);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const stats = statsRef.current ?? computeYearStats([]);
  const firstName = user?.displayName?.split(' ')[0] || 'Athlete';

  // Lock the guess answer at submission time so it never changes
  const lockedAnswerRef = useRef<{ actual: number; guessNum: number; response: string; emoji: string } | null>(null);

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

  // Handle guess submit — lock the answer immediately
  const handleGuess = () => {
    if (!guess.trim()) return;
    const gNum = parseInt(guess) || 0;
    const act = stats.totalWorkouts;
    const diff = Math.abs(gNum - act);
    const pctDiff = act > 0 ? (diff / act) * 100 : 0;

    let response = '';
    let emoji = '';
    if (gNum === act) {
      response = `NO WAY THAT'S INSANEEEEEE! You guessed it exactly right!`;
      emoji = '🤯';
    } else if (pctDiff <= 10) {
      response = `So close! You actually did ${act}. That's impressive!`;
      emoji = '🔥';
    } else if (pctDiff <= 25) {
      response = `Not bad! But you actually did ${act} workouts this year.`;
      emoji = '💪';
    } else if (gNum > act) {
      response = `Not even close. You did ${act}. But still, that's ${act} more than zero!`;
      emoji = '😅';
    } else {
      response = `Way off! You actually crushed ${act} workouts! More than you thought!`;
      emoji = '🚀';
    }

    lockedAnswerRef.current = { actual: act, guessNum: gNum, response, emoji };
    setGuessSubmitted(true);
    setTimeout(() => setCurrentSlide(1), 1500);
  };

  // Use locked values after submission, live values before
  const guessNum = lockedAnswerRef.current?.guessNum ?? (parseInt(guess) || 0);
  const actual = lockedAnswerRef.current?.actual ?? stats.totalWorkouts;
  const guessResponse = lockedAnswerRef.current?.response ?? '';
  const guessEmoji = lockedAnswerRef.current?.emoji ?? '';

  const shareText = `🏆 My ${YEAR} Wrapped: ${stats.totalWorkouts} workouts, ${stats.totalDistanceKm}km, ${Math.round(stats.totalDurationMin / 60)}hrs — The Daily Athlete`;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/athlete/${user?.username}/wrapped` : '';

  // Animated counter for reveal slide
  const slide = SLIDES[currentSlide];
  const countedValue = useCountUp(actual, 1800, slide === 'reveal' && animateIn);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-950 to-black">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-xl bg-red-500/20 animate-pulse" />
            <Loader2 className="h-12 w-12 animate-spin text-red-500 relative" />
          </div>
          <p className="text-red-400/60 animate-pulse text-sm tracking-wide">Loading your year...</p>
        </div>
      </div>
    );
  }

  const isFirst = currentSlide === 0;
  const isLast = currentSlide === SLIDES.length - 1;
  const progressPct = ((currentSlide + 1) / SLIDES.length) * 100;

  // Progress bar — sleek gradient fill
  const progressBar = (
    <div className="relative w-full max-w-xs mx-auto mt-4">
      {/* Track */}
      <div className="h-1 rounded-full bg-white/10 overflow-hidden backdrop-blur-sm">
        {/* Fill */}
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #ef4444, #f59e0b, #ef4444)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s ease-in-out infinite',
          }}
        />
      </div>
      {/* Slide indicators below */}
      <div className="flex items-center justify-between mt-2 px-0.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              if (i === 0 || guessSubmitted) setCurrentSlide(i);
            }}
            className={cn(
              'w-1.5 h-1.5 rounded-full transition-all duration-300',
              i === currentSlide
                ? 'bg-white scale-150 shadow-[0_0_6px_rgba(255,255,255,0.5)]'
                : i < currentSlide
                  ? 'bg-white/40'
                  : 'bg-white/15',
              i > 0 && !guessSubmitted && 'opacity-30 cursor-not-allowed',
            )}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'min-h-screen relative transition-all duration-700 ease-in-out',
        SLIDE_GRADIENTS[slide],
      )}
      style={{
        // Force light-on-dark regardless of theme — wrapped always has dark backgrounds
        colorScheme: 'dark',
        // @ts-ignore - override CSS custom properties for shadcn/tailwind theme
        '--foreground': '0 0% 98%',
        '--muted-foreground': '240 5% 64.9%',
        '--background': '240 10% 3.9%',
        '--card': '240 10% 3.9%',
        '--border': '240 3.7% 15.9%',
        '--primary': '0 72.2% 50.6%',
      } as React.CSSProperties}
    >
      {/* Radial glow overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700"
        style={{ background: SLIDE_GLOW[slide] }}
      />

      {/* Final slide animated shimmer overlay */}
      {slide === 'final' && (
        <div
          className="fixed inset-0 pointer-events-none z-0 opacity-30"
          style={{
            background: 'linear-gradient(125deg, transparent 30%, rgba(239,68,68,0.08) 45%, rgba(168,85,247,0.08) 55%, transparent 70%)',
            backgroundSize: '400% 400%',
            animation: 'celebrateShimmer 6s ease-in-out infinite',
          }}
        />
      )}

      {/* Global keyframes */}
      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes celebrateShimmer {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.2), 0 0 60px rgba(239,68,68,0.05); }
          50% { box-shadow: 0 0 30px rgba(239,68,68,0.4), 0 0 80px rgba(239,68,68,0.1); }
        }
        @keyframes numberPop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-black/30 backdrop-blur-xl border-b border-white/5">
        <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <X className="h-5 w-5 text-white/60" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20">
            <span className="text-white font-bold text-[8px]">CT</span>
          </div>
          <span className="text-white/50 text-xs font-medium tracking-widest uppercase">{YEAR} Wrapped</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Slide content */}
      <div
        ref={cardRef}
        className={cn(
          'relative z-10 min-h-[calc(100vh-120px)] flex flex-col justify-center px-6 sm:px-12 md:px-20 py-8 transition-all duration-500',
          animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        )}
      >
        {/* ═══ SLIDE: GUESS ═══ */}
        {slide === 'guess' && (
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="text-7xl sm:text-8xl mb-8 drop-shadow-2xl">🏋️</div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 leading-tight tracking-tight text-white">
              You did <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">a lot</span> of workouts in {YEAR}
            </h1>
            <p className="text-white/50 text-xl mb-12 font-light">Guess how many</p>

            {!guessSubmitted ? (
              <div className="w-full max-w-xs space-y-5">
                <div className="relative group">
                  {/* Glow ring behind input */}
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={guess}
                    onChange={e => setGuess(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && handleGuess()}
                    placeholder="?"
                    className="relative w-full text-center text-5xl sm:text-6xl font-black bg-white/5 border-2 border-white/10 rounded-2xl py-5 px-6 text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/60 focus:bg-white/[0.07] transition-all duration-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    style={{ animation: 'glowPulse 3s ease-in-out infinite' }}
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleGuess}
                  disabled={!guess.trim()}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-lg hover:from-red-500 hover:to-red-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-red-600/25 hover:shadow-red-500/40"
                >
                  Lock it in
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">{guessNum}</div>
                <p className="text-white/40 text-sm">Let&apos;s see...</p>
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-lg bg-red-500/20 animate-pulse" />
                  <Loader2 className="h-6 w-6 animate-spin text-red-400 mx-auto relative" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ SLIDE: REVEAL ═══ */}
        {slide === 'reveal' && (
          <div className="flex flex-col items-center text-center max-w-lg mx-auto">
            <div
              className="text-7xl mb-6"
              style={{ animation: animateIn ? 'numberPop 0.6s ease-out forwards' : undefined }}
            >
              {guessEmoji}
            </div>
            <div className="relative mb-8">
              {/* Glow behind the number */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full bg-red-500/15 blur-3xl" />
              </div>
              <div
                className="relative text-[120px] sm:text-[160px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-red-400 via-red-500 to-orange-500 tracking-tighter"
                style={{ animation: animateIn ? 'numberPop 0.8s ease-out forwards' : undefined }}
              >
                {countedValue}
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-white/30 text-sm font-semibold tracking-[0.3em] uppercase">
                workouts
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-medium text-white/70 leading-relaxed max-w-sm">
              {guessResponse}
            </p>
            <button
              onClick={goNext}
              className="mt-10 group flex items-center gap-2 text-red-400 text-sm font-medium hover:text-red-300 transition-colors"
            >
              See your stats
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        )}

        {/* ═══ SHARED SLIDES ═══ */}
        {slide === 'stats' && <StatsSlide stats={stats} animateIn={animateIn} />}
        {slide === 'breakdown' && <BreakdownSlide stats={stats} animateIn={animateIn} />}
        {slide === 'records' && <RecordsSlide stats={stats} animateIn={animateIn} />}
        {slide === 'heatmap' && <HeatmapSlide stats={stats} animateIn={animateIn} />}
        {slide === 'summary' && <SummarySlide stats={stats} firstName={firstName} animateIn={animateIn} />}
        {slide === 'final' && <FinalSlide stats={stats} firstName={firstName} />}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-30 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-sm">
        {progressBar}

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
                className="w-full flex items-center justify-center gap-2.5 h-14 rounded-2xl text-base font-bold bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white hover:from-red-500 hover:via-red-400 hover:to-orange-400 active:scale-[0.98] transition-all shadow-lg shadow-red-600/30"
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
              className="group flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white/50 text-sm font-medium hover:text-white/80 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Back
            </button>
            <button
              onClick={goNext}
              disabled={isLast}
              className="group flex items-center gap-2 px-7 py-3 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/15 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95 backdrop-blur-sm border border-white/10 shadow-lg shadow-black/20"
            >
              Next
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
