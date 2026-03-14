'use client';

import { Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { AIInsight } from '@/types/reports-hub';

interface AIInsightCardProps {
  insight: AIInsight | null;
  loading: boolean;
  userName: string;
}

export function AIInsightCard({ insight, loading, userName }: AIInsightCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-yellow-500/10 border border-orange-500/20 p-5 sm:p-6 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-500/20 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 bg-orange-500/10 rounded" />
            <div className="h-4 w-full bg-orange-500/10 rounded" />
            <div className="h-4 w-3/4 bg-orange-500/10 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-yellow-500/10 border border-orange-500/20 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">
              Hey {userName} 👋
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Log a few more workouts and I&apos;ll start finding patterns in your training. Check back soon!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-yellow-500/10 border border-orange-500/20 p-5 sm:p-6 transition-all hover:border-orange-500/30">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">
            Today&apos;s Insight
          </p>
          <p className="text-sm text-foreground/90 mt-1 leading-relaxed">
            {insight.text}
          </p>
          {insight.detail && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {insight.detail}
            </p>
          )}
          {insight.reportType && (
            <Link
              href={`/reports/${insight.reportType}${insight.reportParams ? `?${new URLSearchParams(insight.reportParams).toString()}` : ''}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline mt-2"
            >
              Explore more <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
