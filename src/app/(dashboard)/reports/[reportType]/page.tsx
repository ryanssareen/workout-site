'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
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

// ── Client-side report cache (localStorage) ──
// Serves cached reports instantly (<100ms) with 0 Firebase reads.
// Reports still refresh in the background if stale.
const REPORT_CACHE_PREFIX = 'tda_report_';
const REPORT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (matches server TTL)

function getReportCacheKey(username: string, reportType: string, params: Record<string, string>): string {
  const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return `${REPORT_CACHE_PREFIX}${username}_${reportType}_${sortedParams}`;
}

function getLocalCachedReport(username: string, reportType: string, params: Record<string, string>): StructuredReport | null {
  try {
    const key = getReportCacheKey(username, reportType, params);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.cachedAt > REPORT_CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return cached.report;
  } catch { return null; }
}

function setLocalCachedReport(username: string, reportType: string, params: Record<string, string>, report: StructuredReport) {
  try {
    const key = getReportCacheKey(username, reportType, params);
    localStorage.setItem(key, JSON.stringify({ report, cachedAt: Date.now() }));
  } catch { /* storage full — non-fatal */ }
}

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
  const fetchedRef = useRef(false);

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

    // Instant load: serve from local cache while fetching in background
    if (!refresh) {
      const localCached = getLocalCachedReport(user.username, reportType, params);
      if (localCached) {
        setReport(localCached);
        setIsCached(true);
        setLoadingReport(false);
        // Background refresh — update cache silently, don't block UI
        fetchReportFromAPI(false).then(freshReport => {
          if (freshReport) {
            setReport(freshReport);
            setIsCached(false);
            setLocalCachedReport(user.username, reportType, params, freshReport);
          }
        }).catch(() => {});
        return;
      }
    }

    setLoadingReport(true);
    setError(null);
    setReport(null);

    try {
      const freshReport = await fetchReportFromAPI(refresh);
      if (freshReport) {
        setReport(freshReport);
        setIsCached(false);
        setLocalCachedReport(user.username, reportType, params, freshReport);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoadingReport(false);
    }
  };

  const fetchReportFromAPI = async (refresh: boolean): Promise<StructuredReport | null> => {
    if (!user || !reportType) return null;

    try {
      // Wait for Firebase Auth to have a current user before requesting
      const auth = getAuthInstance();
      let currentUser = auth.currentUser;
      if (!currentUser) {
        currentUser = await new Promise<any>((resolve) => {
          const unsub = auth.onAuthStateChanged((u) => { unsub(); resolve(u); });
        });
      }
      const idToken = await currentUser?.getIdToken();

      // Send cached workouts to avoid Firestore reads on the server
      let clientWorkouts: any[] | undefined;
      try {
        const role = user.role === 'student' ? 'athlete' : user.role;
        const cached = await useWorkoutStore.getState().getWorkouts(user.username, role as 'coach' | 'athlete');
        if (cached.length > 0) {
          // Serialize workouts — convert Firestore Timestamps to plain objects
          clientWorkouts = cached.map(w => ({
            ...w,
            date: w.date?.toDate ? { _seconds: Math.floor(w.date.toDate().getTime() / 1000) } : w.date,
            createdAt: undefined,
            updatedAt: undefined,
          }));
        }
      } catch { /* fallback: server will fetch from Firestore */ }

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
          ...(clientWorkouts ? { clientWorkouts } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 503) {
          throw new Error('Service temporarily unavailable — daily quota may be exceeded. Try again later.');
        }
        if (res.status === 401) {
          throw new Error('Authentication failed — please refresh the page and try again.');
        }
        throw new Error(data.error || 'Failed to generate report');
      }

      const data = await res.json();

      if (data.isInsufficient) {
        throw new Error(data.insufficientMessage || 'Not enough data for this report.');
      } else if (data.report) {
        return data.report as StructuredReport;
      } else {
        throw new Error('Could not generate this report. Try again later.');
      }
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    if (isCoach && !selectedAthlete) return; // wait for athlete selection
    if (fetchedRef.current) return; // prevent re-fetch loops
    fetchedRef.current = true;
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
