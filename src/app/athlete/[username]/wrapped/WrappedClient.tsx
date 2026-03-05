'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { X, ChevronRight, Lock } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  YEAR, PUBLIC_SLIDES, computeYearStats,
  StatsSlide, BreakdownSlide, RecordsSlide, HeatmapSlide, SummarySlide, FinalSlide,
} from '@/components/wrapped/WrappedSlides';
import type { WrappedPublicData } from './page';

export function WrappedPublicClient({ data }: { data: WrappedPublicData }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animateIn, setAnimateIn] = useState(false);

  const stats = useMemo(() => computeYearStats(data.workouts), [data.workouts]);
  const firstName = data.displayName?.split(' ')[0] || 'Athlete';

  // Trigger animation on slide change
  useEffect(() => {
    setAnimateIn(false);
    const t = setTimeout(() => setAnimateIn(true), 50);
    return () => clearTimeout(t);
  }, [currentSlide]);

  const goNext = useCallback(() => {
    if (currentSlide < PUBLIC_SLIDES.length - 1) {
      setCurrentSlide(c => c + 1);
    }
  }, [currentSlide]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(c => c - 1);
    }
  }, [currentSlide]);

  // Private profile
  if (data.isPrivate) {
    return (
      <div className="dark min-h-screen flex flex-col items-center justify-center bg-black text-white px-6">
        <Lock className="h-12 w-12 text-white/20 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Private Profile</h1>
        <p className="text-white/50 text-center max-w-sm mb-8">
          {data.displayName}&apos;s wrapped is not publicly visible.
        </p>
        <Link
          href="/register"
          className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors"
        >
          Create Your Own Wrapped
        </Link>
      </div>
    );
  }

  const slide = PUBLIC_SLIDES[currentSlide];
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === PUBLIC_SLIDES.length - 1;

  // Progress dots
  const progressBar = (
    <div className="flex items-center gap-1.5 justify-center mt-4">
      {PUBLIC_SLIDES.map((_, i) => (
        <button
          key={i}
          onClick={() => setCurrentSlide(i)}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === currentSlide ? 'w-6 bg-red-500' : 'w-1.5 bg-white/20',
          )}
        />
      ))}
    </div>
  );

  return (
    <div className="dark min-h-screen bg-black text-white relative">
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-xl">
        <Link href={`/athlete/${data.username}`} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <X className="h-5 w-5 text-white/60" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-red-600 flex items-center justify-center">
            <span className="text-white font-bold text-[8px]">CT</span>
          </div>
          <span className="text-white/40 text-xs font-medium tracking-widest uppercase">
            {firstName}&apos;s {YEAR} Wrapped
          </span>
        </div>
        <div className="w-9" />
      </div>

      {/* Slide content */}
      <div
        className={cn(
          'min-h-[calc(100vh-120px)] flex flex-col justify-center px-6 sm:px-12 md:px-20 py-8 transition-all duration-500',
          animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        )}
      >
        {slide === 'stats' && <StatsSlide stats={stats} animateIn={animateIn} />}
        {slide === 'breakdown' && <BreakdownSlide stats={stats} animateIn={animateIn} />}
        {slide === 'records' && <RecordsSlide stats={stats} animateIn={animateIn} />}
        {slide === 'heatmap' && <HeatmapSlide stats={stats} animateIn={animateIn} />}
        {slide === 'summary' && <SummarySlide stats={stats} firstName={firstName} animateIn={animateIn} />}
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

            <Link
              href="/register"
              className="px-8 py-4 rounded-2xl bg-red-600 text-white font-bold text-lg hover:bg-red-500 active:scale-[0.98] transition-all"
            >
              Create Your Own Wrapped 🚀
            </Link>
            <p className="text-white/20 text-xs mt-3">Free on The Daily Athlete</p>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-30 px-4 pb-6 pt-3 bg-gradient-to-t from-black via-black/80 to-transparent">
        {progressBar}

        {!isLast && (
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
              className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-all active:scale-95"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
