'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { Loader2, Sparkles } from 'lucide-react';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { getDbInstance } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Workout } from '@/types';
import { useCoachFilter } from '@/hooks/useCoachFilter';
import { AthleteSelector } from '@/components/dashboard/AthleteSelector';
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
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(true);

  const greeting = useMemo(() => getTimeGreeting(new Date()), []);

  const { getWorkouts } = useWorkoutStore();
  const isCoach = user?.role === 'coach';
  const { selectedAthlete, selectAthlete, athletes: coachAthletes } = useCoachFilter(
    isCoach ? user?.username : undefined
  );

  // For coaches, show the selected athlete's name (or "All Athletes")
  const selectedAthleteData = useMemo(() => {
    if (!isCoach || !selectedAthlete) return null;
    return coachAthletes.find(a => a.uid === selectedAthlete);
  }, [isCoach, selectedAthlete, coachAthletes]);

  const displayName = useMemo(() => {
    if (isCoach && selectedAthleteData) {
      return selectedAthleteData.displayName.split(' ')[0] || selectedAthleteData.displayName;
    }
    return user?.displayName ? user.displayName.split(' ')[0] || user.displayName : 'Athlete';
  }, [isCoach, selectedAthleteData, user?.displayName]);

  // Fetch workouts — try cache first, then Firestore
  const fetchWorkouts = useCallback(async () => {
    if (!user) return;
    try {
      const role = user.role === 'student' ? 'athlete' : user.role;
      const data = await getWorkouts(user.username, role as 'coach' | 'athlete');
      setWorkouts(data);
    } catch (err) {
      console.error('Failed to fetch workouts:', err);
      // If Firestore fails (quota), try to use whatever is in the store cache
      const cached = useWorkoutStore.getState().workouts;
      if (cached.length > 0) {
        setWorkouts(cached);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username, user?.role, getWorkouts]);

  // Fetch cached daily insight from Firestore
  // For coaches viewing a specific athlete, fetch the athlete's insight
  const insightUsername = isCoach && selectedAthlete ? selectedAthlete : user?.username;
  const fetchInsight = useCallback(async () => {
    if (!insightUsername) {
      setLoadingInsight(false);
      return;
    }
    try {
      const db = getDbInstance();
      const insightRef = doc(db, 'users', insightUsername, 'insights', 'daily');
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
    } catch (err: any) {
      // Silently fail on quota errors — insight is optional
      if (!err?.message?.includes('quota') && !err?.message?.includes('RESOURCE_EXHAUSTED') && !err?.code?.includes('permission')) {
        console.error('Failed to fetch insight:', err);
      }
    } finally {
      setLoadingInsight(false);
    }
  }, [insightUsername]);

  useEffect(() => {
    fetchWorkouts();
    fetchInsight();
  }, [fetchWorkouts, fetchInsight]);

  // Filter workouts by selected athlete for coaches
  const filteredWorkouts = useMemo(() => {
    if (!isCoach || !selectedAthlete) return workouts;
    return workouts.filter(w => w.ownerUsername === selectedAthlete || w.assignedTo === selectedAthlete);
  }, [workouts, isCoach, selectedAthlete]);

  // Compute mini stats for Zone 2 cards
  const { weeklyCount, monthlyCount } = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completed = filteredWorkouts.filter((w) => w.completed);
    return {
      weeklyCount: completed.filter((w) => toDate(w.date) >= startOfWeek).length,
      monthlyCount: completed.filter((w) => toDate(w.date) >= startOfMonth).length,
    };
  }, [filteredWorkouts]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-orange-500" />
            {isCoach ? 'Athlete Reports' : 'Your Reports'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {greeting}, {displayName}. {isCoach && !selectedAthlete ? 'Viewing all athletes.' : 'Here\u0027s what the data is telling you.'}
          </p>
        </div>
        {isCoach && (
          <AthleteSelector
            selectedAthlete={selectedAthlete}
            onSelect={selectAthlete}
            athletes={coachAthletes}
          />
        )}
      </div>

      {/* ═══ ZONE 1: THE SMART LAYER ═══ */}
      {(!isCoach || selectedAthlete) && (
        <section className="space-y-3">
          <AIInsightCard
            insight={insight}
            loading={loadingInsight}
            userName={displayName}
          />
          {!isCoach && (
            <AskAnythingBar
              userId={user.uid}
              userEmail={user.email}
              userRole={user.role}
              userName={displayName}
            />
          )}
        </section>
      )}

      {/* ═══ ZONE 2: YOUR REPORTS ═══ */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
          {isCoach ? 'Reports' : 'Your Reports'}
        </h2>
        <YourReportsZone
          weeklyWorkoutCount={weeklyCount}
          monthlyWorkoutCount={monthlyCount}
          isCoach={isCoach}
        />
      </section>

      {/* ═══ ZONE 3: EXPLORE YOUR DATA ═══ */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
          {isCoach ? 'Explore Data' : 'Explore Your Data'}
        </h2>
        <ExploreCards workouts={filteredWorkouts} user={user} />
      </section>
    </div>
  );
}
