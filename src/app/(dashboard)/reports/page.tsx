'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Loader2, Sparkles } from 'lucide-react';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { getDbInstance } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Workout } from '@/types';
import { AIInsightCard } from '@/components/reports/hub/AIInsightCard';
import { AskAnythingBar } from '@/components/reports/hub/AskAnythingBar';
import { YourReportsZone } from '@/components/reports/hub/YourReportsZone';
import { ExploreCards } from '@/components/reports/hub/ExploreCards';
import type { AIInsight } from '@/types/reports-hub';

const getTimeGreeting = (date: Date) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
};

/** Parse a workout date to JS Date */
function toDate(d: Date | { seconds: number }): Date {
  if (d instanceof Date) return d;
  if (d && typeof d === 'object' && 'seconds' in d) return new Date(d.seconds * 1000);
  return new Date(d);
}

export default function ReportsHubPage() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(true);

  const firstName = useMemo(
    () => (user?.displayName ? user.displayName.split(' ')[0] || user.displayName : 'Athlete'),
    [user?.displayName],
  );
  const greeting = useMemo(() => getTimeGreeting(new Date()), []);

  const { getWorkouts } = useWorkoutStore();

  // Fetch workouts
  const fetchWorkouts = useCallback(async () => {
    if (!user) return;
    setLoadingWorkouts(true);
    try {
      const role = user.role === 'student' ? 'athlete' : user.role;
      const data = await getWorkouts(user.username, role as 'coach' | 'athlete');
      setWorkouts(data);
    } catch (err) {
      console.error('Failed to fetch workouts:', err);
    } finally {
      setLoadingWorkouts(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username, user?.role, getWorkouts]);

  // Fetch cached daily insight from Firestore
  const fetchInsight = useCallback(async () => {
    if (!user?.username) {
      setLoadingInsight(false);
      return;
    }
    try {
      const db = getDbInstance();
      const insightRef = doc(db, 'users', user.username, 'insights', 'daily');
      const insightDoc = await getDoc(insightRef);

      if (insightDoc.exists()) {
        const data = insightDoc.data();
        const expiresAt = data.expiresAt?.toDate?.() ?? new Date(data.expiresAt);

        // Only use if not expired
        if (expiresAt > new Date()) {
          setInsight({
            text: data.text,
            detail: data.detail,
            reportType: data.reportType,
            reportParams: data.reportParams,
            generatedAt: data.generatedAt?.toDate?.() ?? new Date(data.generatedAt),
            expiresAt,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch insight:', err);
    } finally {
      setLoadingInsight(false);
    }
  }, [user?.username]);

  useEffect(() => {
    fetchWorkouts();
    fetchInsight();
  }, [fetchWorkouts, fetchInsight]);

  // Compute mini stats for Zone 2 cards
  const { weeklyCount, monthlyCount } = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completed = workouts.filter((w) => w.completed);
    return {
      weeklyCount: completed.filter((w) => toDate(w.date) >= startOfWeek).length,
      monthlyCount: completed.filter((w) => toDate(w.date) >= startOfMonth).length,
    };
  }, [workouts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-orange-500" />
          Your Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {greeting}, {firstName}. Here&apos;s what your data is telling you.
        </p>
      </div>

      {/* ═══ ZONE 1: THE SMART LAYER ═══ */}
      <section className="space-y-3">
        <AIInsightCard
          insight={insight}
          loading={loadingInsight}
          userName={firstName}
        />
        <AskAnythingBar
          userId={user.uid}
          userEmail={user.email}
          userRole={user.role}
          userName={firstName}
        />
      </section>

      {/* ═══ ZONE 2: YOUR REPORTS ═══ */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
          Your Reports
        </h2>
        <YourReportsZone
          weeklyWorkoutCount={weeklyCount}
          monthlyWorkoutCount={monthlyCount}
        />
      </section>

      {/* ═══ ZONE 3: EXPLORE YOUR DATA ═══ */}
      {!loadingWorkouts && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
            Explore Your Data
          </h2>
          <ExploreCards workouts={workouts} user={user} />
        </section>
      )}

      {/* Loading state for Zone 3 */}
      {loadingWorkouts && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
            Explore Your Data
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
