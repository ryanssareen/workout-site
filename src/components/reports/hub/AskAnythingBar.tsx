'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportRenderer } from '@/components/reports/ReportRenderer';
import type { StructuredReport } from '@/types/reports';

const PLACEHOLDER_SUGGESTIONS = [
  "How's my running this month?",
  'Compare this month vs last',
  'Show me my personal records',
  'Am I training enough?',
  'What should I focus on?',
];

interface AskAnythingBarProps {
  userId: string;
  userEmail: string;
  userRole: string;
  userName: string;
}

export function AskAnythingBar({ userId, userEmail, userRole, userName }: AskAnythingBarProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotate placeholder suggestions
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_SUGGESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    setReport(null);
    setExpanded(true);

    try {
      const res = await fetch('/api/ai/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          userId,
          userEmail,
          userRole,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate report');
      }

      const data = await res.json();

      if (data.isInsufficient) {
        setError(data.insufficientMessage || 'Not enough data to answer that question.');
      } else if (data.report) {
        setReport(data.report);
      } else {
        setError('Could not generate a report. Try rephrasing your question.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setReport(null);
    setError(null);
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={PLACEHOLDER_SUGGESTIONS[placeholderIndex]}
            className="w-full pl-10 pr-20 py-3 rounded-xl border bg-background text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
          />
          <div className="absolute right-2 flex items-center gap-1">
            {(report || error) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={!query.trim() || loading}
              className="h-8 px-3 text-xs rounded-lg bg-orange-600 hover:bg-orange-700 text-white"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Ask'}
            </Button>
          </div>
        </div>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border bg-card p-6 animate-pulse">
          <div className="space-y-3">
            <div className="h-5 w-48 bg-muted rounded" />
            <div className="flex gap-3">
              <div className="h-20 flex-1 bg-muted rounded-lg" />
              <div className="h-20 flex-1 bg-muted rounded-lg" />
              <div className="h-20 flex-1 bg-muted rounded-lg" />
            </div>
            <div className="h-40 w-full bg-muted rounded-lg" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
        </div>
      )}

      {/* Report result */}
      {report && !loading && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Collapse header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-medium truncate">{report.title}</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>

          {/* Report content */}
          {expanded && (
            <div className="px-4 pb-4 border-t">
              {report.subtitle && (
                <p className="text-xs text-muted-foreground mt-3 mb-4">{report.subtitle}</p>
              )}
              <ReportRenderer sections={report.sections} />
              {report.summary && (
                <p className="text-sm text-muted-foreground mt-4 pt-3 border-t italic">
                  {report.summary}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
