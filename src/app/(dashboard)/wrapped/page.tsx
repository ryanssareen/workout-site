'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import { Loader2, X, Share2, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  YEAR, SLIDES, computeYearStats,
  StatsSlide, BreakdownSlide, RecordsSlide, HeatmapSlide, SummarySlide, FinalSlide,
} from '@/components/wrapped/WrappedSlides';
import type { Slide } from '@/components/wrapped/WrappedSlides';

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
      const data = await getUserWorkouts(user.username, user.role);
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
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-black/80 backdrop-blur-xl">
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={guess}
                  onChange={e => setGuess(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleGuess()}
                  placeholder="Your guess..."
                  className="w-full text-center text-4xl font-bold bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder:text-white/20 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

        {/* ═══ SHARED SLIDES ═══ */}
        {slide === 'stats' && <StatsSlide stats={stats} animateIn={animateIn} />}
        {slide === 'breakdown' && <BreakdownSlide stats={stats} animateIn={animateIn} />}
        {slide === 'records' && <RecordsSlide stats={stats} animateIn={animateIn} />}
        {slide === 'heatmap' && <HeatmapSlide stats={stats} animateIn={animateIn} />}
        {slide === 'summary' && <SummarySlide stats={stats} firstName={firstName} animateIn={animateIn} />}
        {slide === 'final' && <FinalSlide stats={stats} firstName={firstName} />}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-30 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-black via-black/80 to-transparent">
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
