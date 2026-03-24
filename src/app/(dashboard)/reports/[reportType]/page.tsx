'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useCoachFilter } from '@/hooks/useCoachFilter';
import { AthleteSelector } from '@/components/dashboard/AthleteSelector';
import { Loader2, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getAuthInstance } from '@/lib/firebase/config';
import { ReportContainer } from '@/components/reports/ReportContainer';
import type { StructuredReport } from '@/types/reports';
import type { DeepDiveReportType } from '@/types/reports-hub';

/** Report type display names */
const REPORT_TITLES: Record<string, string> = {
  'sport-deep-dive': 'Sport Deep Dive',
  'trend-report': 'Trend Report',
  'pr-timeline': 'Personal Records',
  'recovery-report': 'Recovery Check',
  'goal-tracker': 'Goal Tracker',
};

export default function DeepDiveReportPage() {
  const { reportType } = useParams<{ reportType: string }>();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const isCoach = user?.role === 'coach';
  const { selectedAthlete, selectAthlete, athletes: coachAthletes } = useCoachFilter(
    isCoach ? user?.username : undefined
  );

  const [report, setReport] = useState<StructuredReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  const displayName = useMemo(
    () => user?.displayName || 'Athlete',
    [user?.displayName],
  );

  // Collect search params into a params object
  const params = useMemo(() => {
    const p: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== 'refresh') p[key] = value;
    });
    return p;
  }, [searchParams]);

  const generateReport = async (refresh = false) => {
    if (!user || !reportType) return;
    setLoadingReport(true);
    setError(null);
    setReport(null);

    try {
      const idToken = await getAuthInstance().currentUser?.getIdToken();
      const res = await fetch('/api/ai/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          reportType: reportType as DeepDiveReportType,
          params,
          refresh,
          ...(isCoach && selectedAthlete ? { athleteUsername: selectedAthlete } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate report');
      }

      const data = await res.json();

      if (data.isInsufficient) {
        setError(data.insufficientMessage || 'Not enough data for this report.');
      } else if (data.report) {
        setReport(data.report);
        setIsCached(!!data.cached);
      } else {
        setError('Could not generate this report. Try again later.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (isCoach && !selectedAthlete) return; // wait for athlete selection
    generateReport(searchParams.get('refresh') === 'true');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, reportType, selectedAthlete]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  const title = REPORT_TITLES[reportType] || 'Report';

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Back link + athlete selector + refresh */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Link>
        <div className="flex items-center gap-2">
          {isCoach && (
            <AthleteSelector
              selectedAthlete={selectedAthlete}
              onSelect={selectAthlete}
              athletes={coachAthletes}
            />
          )}
        {report && !loadingReport && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generateReport(true)}
            className="text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {isCached ? 'Regenerate' : 'Refresh'}
          </Button>
        )}
        </div>
      </div>

      {/* Loading state */}
      {loadingReport && (
        <div className="space-y-4">
          <div className="animate-pulse">
            <div className="h-8 w-64 bg-muted rounded mb-2" />
            <div className="h-4 w-48 bg-muted rounded mb-6" />
          </div>

          <div className="rounded-2xl border bg-card p-8 animate-pulse space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between pb-6 border-b">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-muted" />
                <div className="space-y-2">
                  <div className="h-5 w-40 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <div className="h-4 w-20 bg-muted rounded ml-auto" />
                <div className="h-3 w-32 bg-muted rounded ml-auto" />
              </div>
            </div>

            {/* Stat cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-xl" />
              ))}
            </div>

            {/* Chart skeleton */}
            <div className="h-48 bg-muted rounded-xl" />

            {/* Highlight skeleton */}
            <div className="h-20 bg-muted rounded-xl" />

            {/* Text skeleton */}
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-3/4 bg-muted rounded" />
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loadingReport && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
            {title}
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-500 mb-4">{error}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/reports">Back to Reports Hub</Link>
          </Button>
        </div>
      )}

      {/* Report */}
      {report && !loadingReport && (
        <ReportContainer
          report={report}
          userName={displayName}
          userEmail={user.email}
        />
      )}
    </div>
  );
}
