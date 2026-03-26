'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { getPersonalRecords, getMilestones } from '@/lib/firebase/firestore';
import { Workout, PersonalRecord } from '@/types';
import type { Milestone } from '@/types/achievements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Target, Zap,
  CheckCircle2, Clock, Flame,
  Activity, Trophy, ChevronRight, Gift, X, CalendarRange,
  Circle, Plus, BarChart3, Calendar as CalendarIcon, Settings, BookOpen,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval, differenceInDays, isSameDay, subDays, parseISO, isPast, isToday as isTodayFn } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useStravaAutoSync } from '@/hooks/useStravaAutoSync';
import { CoachDashboard } from '@/components/dashboard/CoachDashboard';
import { ProfileCompletionBar } from '@/components/dashboard/ProfileCompletionBar';
import { DashboardAchievements } from '@/components/achievements/DashboardAchievements';

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '📋',
};

function getWorkoutDate(w: Workout): Date {
  try {
    const d = w.date?.toDate?.() ?? new Date(w.date as any);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch { return new Date(0); }
}

function calculateStreak(workouts: Workout[]): number {
  const completed = workouts
    .filter(w => w.completed)
    .map(w => getWorkoutDate(w))
    .sort((a, b) => b.getTime() - a.getTime());
  if (completed.length === 0) return 0;

  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  // If no workout today, start from yesterday
  if (!completed.some(d => isSameDay(d, checkDate))) {
    checkDate = subDays(checkDate, 1);
  }

  for (let i = 0; i < 365; i++) {
    const dayDate = subDays(checkDate, i);
    if (completed.some(d => isSameDay(d, dayDate))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── Workout status + styles (matches calendar color coding) ──────────
function getWorkoutStatus(workout: Workout) {
  const workoutDate = getWorkoutDate(workout);
  const today = isTodayFn(workoutDate);
  const past = isPast(workoutDate) && !today;

  const isStravaStandalone = workout.source === 'strava';
  const isMatchedByStrava = !isStravaStandalone && workout.completed && workout.completedBy === 'strava';
  const isLate = workout.completedLate === true;
  const isCompletedManual = workout.completed && !isStravaStandalone && !isMatchedByStrava && !isLate;
  const isMissed = past && !workout.completed && !isStravaStandalone;
  const isFuture = !workout.completed && !past && !isStravaStandalone;

  return { isStravaStandalone, isMatchedByStrava, isLate, isCompletedManual, isMissed, isFuture };
}

function getStatusStyles(status: ReturnType<typeof getWorkoutStatus>) {
  if (status.isCompletedManual || status.isMatchedByStrava) {
    return {
      border: 'border-green-400 dark:border-green-500/70',
      bg: 'bg-green-100/80 dark:bg-green-500/15',
    };
  }
  if (status.isStravaStandalone) {
    return {
      border: 'border-orange-400 dark:border-orange-500/70',
      bg: 'bg-orange-100/80 dark:bg-orange-500/15',
    };
  }
  if (status.isLate) {
    return {
      border: 'border-amber-400 dark:border-amber-500/70',
      bg: 'bg-amber-100/80 dark:bg-amber-500/15',
    };
  }
  if (status.isMissed) {
    return {
      border: 'border-red-400 dark:border-red-500/70 opacity-60',
      bg: 'bg-red-100/80 dark:bg-red-500/15',
    };
  }
  if (status.isFuture) {
    return {
      border: 'border-blue-400/60 dark:border-blue-500/50 border-dashed',
      bg: 'bg-blue-50/60 dark:bg-blue-500/10',
    };
  }
  return { border: 'border-border/40', bg: 'bg-card/60' };
}

function getStatusIcon(status: ReturnType<typeof getWorkoutStatus>) {
  if (status.isCompletedManual || status.isMatchedByStrava || status.isLate) {
    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  }
  if (status.isStravaStandalone) {
    return <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0" />;
  }
  if (status.isMissed) {
    return <Circle className="h-4 w-4 text-red-400 shrink-0" />;
  }
  // Future / planned
  return <Clock className="h-4 w-4 text-blue-400 shrink-0" />;
}


export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [wrapBannerDismissed, setWrapBannerDismissed] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const { getWorkouts, invalidate: invalidateWorkouts } = useWorkoutStore();

  // Refresh workouts (used by auto-sync callback) — invalidates cache so fresh data is fetched
  const refreshWorkouts = useCallback(async () => {
    if (!user) return;
    const workoutData = await invalidateWorkouts(user.username, user.role);
    setWorkouts(workoutData);
  }, [user, invalidateWorkouts]);

  // Auto-sync Strava in background on regular login
  useStravaAutoSync(user, refreshWorkouts);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      // Fetch workouts (cached), PRs, and milestones in parallel
      // Use allSettled so quota errors on one don't block others
      const [workoutResult, prResult, msResult] = await Promise.allSettled([
        getWorkouts(user.username, user.role),
        getPersonalRecords(user.username),
        getMilestones(user.username),
      ]);
      if (workoutResult.status === 'fulfilled') setWorkouts(workoutResult.value);
      else {
        // Try store cache as fallback
        const entry = useWorkoutStore.getState().cache.get(user.username);
        if (entry && entry.workouts.length > 0) setWorkouts(entry.workouts);
      }
      if (prResult.status === 'fulfilled') setPersonalRecords(prResult.value);
      if (msResult.status === 'fulfilled') setMilestones(msResult.value);
      setDataLoaded(true);
    }
    loadData();
  }, [user, getWorkouts]);

  // ── Derived data ──────────────────────────────────────────
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const thisWeekWorkouts = workouts.filter(w => {
    const d = getWorkoutDate(w);
    return isWithinInterval(d, { start: weekStart, end: weekEnd });
  });

  const thisWeekCompleted = thisWeekWorkouts.filter(w => w.completed).length;
  const thisWeekTotal = thisWeekWorkouts.length;

  // Last week's workouts for wrap banner
  const lastWeekStart = subWeeks(weekStart, 1);
  const lastWeekEnd = subWeeks(weekEnd, 1);
  const lastWeekWorkouts = workouts.filter(w => {
    const d = getWorkoutDate(w);
    return isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd });
  });
  const showWrapBanner = lastWeekWorkouts.length > 0 && !wrapBannerDismissed;

  const completedCount = workouts.filter(w => w.completed).length;
  const streak = useMemo(() => calculateStreak(workouts), [workouts]);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const upcomingWorkouts = workouts
    .filter(w => !w.completed && getWorkoutDate(w) >= todayStart)
    .sort((a, b) => getWorkoutDate(a).getTime() - getWorkoutDate(b).getTime())
    .slice(0, 2);

  const recentCompleted = workouts
    .filter(w => w.completed)
    .sort((a, b) => getWorkoutDate(b).getTime() - getWorkoutDate(a).getTime())
    .slice(0, 2);

  // Event countdowns
  const eventCountdowns = useMemo(() => {
    if (!user?.events) return [];
    return user.events
      .filter(e => e.eventDate)
      .map(e => {
        const eventDate = parseISO(e.eventDate!);
        const daysUntil = differenceInDays(eventDate, now);
        return { ...e, daysUntil, eventDateParsed: eventDate };
      })
      .filter(e => e.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 3);
  }, [user?.events, now]);

  if (!user || !dataLoaded) {
    return (
      <div className="space-y-6 pb-8">
        {/* Greeting skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        {/* Stats row skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-border/30 p-5 space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        {/* Workouts skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-border/20 p-4 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border/30 p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <div className="rounded-2xl border border-border/30 p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Combine recent done + upcoming planned for unified list
  const combinedWorkouts = [
    ...recentCompleted.map(w => ({ workout: w, section: 'done' as const })),
    ...upcomingWorkouts.map(w => ({ workout: w, section: 'planned' as const })),
  ];

  // Coach gets a dedicated dashboard
  if (user?.role === 'coach') {
    return <CoachDashboard username={user.username} timezone={user.timezone} />;
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ── PROFILE COMPLETION BAR ──────────────────────────────── */}
      {user && <ProfileCompletionBar user={user} />}

      {/* ── WEEKLY WRAP BANNER ────────────────────────────────── */}
      {showWrapBanner && (
        <Link href="/wrap" className="block group">
          <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 p-4 transition-all hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/5">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWrapBannerDismissed(true); }}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors z-10"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <Gift className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold group-hover:text-red-500 transition-colors">Your Weekly Wrap is ready!</p>
                <p className="text-xs text-muted-foreground">
                  You logged {lastWeekWorkouts.length} workout{lastWeekWorkouts.length !== 1 ? 's' : ''} last week — tap to see your capsule
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/40 ml-auto group-hover:text-red-500 transition-colors shrink-0" />
            </div>
          </div>
        </Link>
      )}

      {/* ── HERO HEADER ────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {greeting}, <span className="text-red-500">{user?.displayName?.split(' ')[0]}</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          {thisWeekCompleted > 0
            ? `${thisWeekCompleted} workout${thisWeekCompleted > 1 ? 's' : ''} done this week. ${thisWeekTotal - thisWeekCompleted > 0 ? `${thisWeekTotal - thisWeekCompleted} to go.` : 'All caught up!'}`
            : thisWeekTotal > 0
              ? `${thisWeekTotal} workout${thisWeekTotal > 1 ? 's' : ''} planned this week.`
              : "Let's get training."}
        </p>
      </div>

      {/* ── STATS ROW ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Streak — Duolingo-style flame widget */}
        <Card className="relative overflow-hidden p-4 border-orange-500/15 hover:border-orange-500/30 transition-all group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-red-500/5 opacity-60 group-hover:opacity-100 transition-opacity" />
          {/* Animated flame glow behind the icon — scales with streak */}
          {streak > 0 && (
            <div
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"
              style={{
                width: Math.min(40 + streak * 4, 100),
                height: Math.min(40 + streak * 4, 100),
                background: 'radial-gradient(circle, #f97316, #ef4444, transparent)',
              }}
            />
          )}
          <div className="relative flex items-center gap-3">
            <div className={`flex items-center justify-center rounded-xl shadow-lg shadow-orange-500/20 transition-all duration-500 ${
              streak >= 7 ? 'h-12 w-12 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600' :
              streak >= 3 ? 'h-11 w-11 bg-gradient-to-br from-orange-400 to-red-600' :
              'h-10 w-10 bg-gradient-to-br from-orange-500 to-red-600'
            }`}>
              <Flame className={`text-white transition-all ${
                streak >= 7 ? 'h-7 w-7 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' :
                streak >= 3 ? 'h-6 w-6' : 'h-5 w-5'
              }`} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{streak}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {streak === 0 ? 'Start a streak!' : streak === 1 ? 'Day streak' : streak >= 7 ? 'Day streak 🔥' : 'Day streak'}
              </p>
            </div>
          </div>
        </Card>

        {/* This Week */}
        <Card className="relative overflow-hidden p-4 border-red-500/15 hover:border-red-500/30 transition-all group">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-rose-500/5 opacity-60 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{thisWeekCompleted}<span className="text-sm text-muted-foreground font-normal">/{thisWeekTotal}</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">This week</p>
            </div>
          </div>
        </Card>

        {/* All-time */}
        <Card className="relative overflow-hidden p-4 border-emerald-500/15 hover:border-emerald-500/30 transition-all group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-green-500/5 opacity-60 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{completedCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">All-time</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── ACHIEVEMENTS ────────────────────────────────────────── */}
      {user && <DashboardAchievements username={user.username} prefetchedPRs={personalRecords} prefetchedMilestones={milestones} />}

      {/* ── YOUR WORKOUTS (unified: recent done + upcoming) ───── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500" />Your Workouts
            </CardTitle>
            <Link href="/workouts" className="text-xs text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {combinedWorkouts.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-medium mb-1">No workouts yet</p>
              <p className="text-xs text-muted-foreground">Your recent and upcoming workouts will show here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Recently done */}
              {recentCompleted.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Recently done</p>
                  {recentCompleted.map((workout) => {
                    const wDate = getWorkoutDate(workout);
                    const status = getWorkoutStatus(workout);
                    const styles = getStatusStyles(status);
                    const dateLabel = isSameDay(wDate, now) ? 'Today' : format(wDate, 'MMM d');
                    return (
                      <Link key={workout.id} href={`/workouts/${workout.id}`}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-all group',
                          styles.border,
                          styles.bg,
                        )}>
                        <span className="text-xl">{TYPE_EMOJI[workout.type] || '📋'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{workout.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{workout.type}</Badge>
                            {workout.duration && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{workout.duration}m</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">{dateLabel}</p>
                        </div>
                        {getStatusIcon(status)}
                      </Link>
                    );
                  })}
                </>
              )}

              {/* Upcoming planned */}
              {upcomingWorkouts.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mt-3">Coming up</p>
                  {upcomingWorkouts.map((workout) => {
                    const wDate = getWorkoutDate(workout);
                    const status = getWorkoutStatus(workout);
                    const styles = getStatusStyles(status);
                    const isToday = isSameDay(wDate, now);
                    const isTomorrow = isSameDay(wDate, new Date(now.getTime() + 86400000));
                    const dateLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : format(wDate, 'MMM d');
                    return (
                      <Link key={workout.id} href={`/workouts/${workout.id}`}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-all group',
                          styles.border,
                          styles.bg,
                        )}>
                        <span className="text-xl">{TYPE_EMOJI[workout.type] || '📋'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{workout.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{workout.type}</Badge>
                            {workout.duration && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{workout.duration}m</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('text-xs font-medium', isToday ? 'text-blue-500' : 'text-muted-foreground')}>{dateLabel}</p>
                        </div>
                        {getStatusIcon(status)}
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── EVENTS + CTAs ─────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Event Countdowns */}
        {eventCountdowns.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-red-500" />Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {eventCountdowns.map((event, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <div className={cn(
                      'h-10 w-10 rounded-lg flex flex-col items-center justify-center text-white shrink-0',
                      event.daysUntil <= 14 ? 'bg-red-600' : event.daysUntil <= 30 ? 'bg-orange-500' : 'bg-neutral-600'
                    )}>
                      <span className="text-xs font-bold leading-none">{event.daysUntil}</span>
                      <span className="text-[8px] leading-none mt-0.5">days</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{event.eventName || event.goal}</p>
                      <p className="text-[10px] text-muted-foreground">{format(event.eventDateParsed, 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly Wrap + Monthly Review CTAs */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/wrap" className="block">
            <Card className="p-4 hover:border-red-500/30 transition-all group cursor-pointer bg-gradient-to-br from-card to-red-500/[0.03] h-full">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Gift className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold group-hover:text-red-500 transition-colors">Weekly Wrap</p>
                  <p className="text-[10px] text-muted-foreground">Your week&apos;s capsule</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/review" className="block">
            <Card className="p-4 hover:border-blue-500/30 transition-all group cursor-pointer bg-gradient-to-br from-card to-blue-500/[0.03] h-full">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <CalendarRange className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold group-hover:text-blue-500 transition-colors">Monthly Review</p>
                  <p className="text-[10px] text-muted-foreground">Your month in review</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* ── WEEKLY ACTIVITY + SPORT BREAKDOWN ───────────────────── */}
      {workouts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Last 7 days activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-red-500" />Last 7 Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const days = Array.from({ length: 7 }, (_, i) => {
                  const d = subDays(now, 6 - i);
                  const count = workouts.filter(w => {
                    const wd = getWorkoutDate(w);
                    return isSameDay(wd, d) && w.completed;
                  }).length;
                  return { day: format(d, 'EEE'), count, isToday: isSameDay(d, now) };
                });
                const max = Math.max(...days.map(d => d.count), 1);
                return (
                  <div className="flex items-end gap-2 h-28">
                    {days.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                        <div className="w-full relative" style={{ height: '80px' }}>
                          <div
                            className={cn(
                              'absolute bottom-0 w-full rounded-md transition-all',
                              d.count > 0
                                ? d.isToday ? 'bg-red-500' : 'bg-red-500/60'
                                : 'bg-muted/40'
                            )}
                            style={{ height: d.count > 0 ? `${Math.max((d.count / max) * 100, 12)}%` : '4px' }}
                          />
                        </div>
                        <span className={cn('text-[10px]', d.isToday ? 'text-red-500 font-bold' : 'text-muted-foreground')}>
                          {d.day}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Sport breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-red-500" />Sport Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const completed = workouts.filter(w => w.completed);
                const types: Record<string, number> = {};
                completed.forEach(w => { types[w.type] = (types[w.type] || 0) + 1; });
                const sorted = Object.entries(types).sort(([, a], [, b]) => b - a);
                const total = completed.length;
                const TYPE_COLORS: Record<string, string> = {
                  run: 'bg-red-500', bike: 'bg-amber-500', swim: 'bg-cyan-500',
                  walk: 'bg-emerald-500', strength: 'bg-purple-500', other: 'bg-gray-500',
                };
                const TYPE_EMOJI: Record<string, string> = {
                  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '📋',
                };
                if (sorted.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No completed workouts yet</p>;
                return (
                  <div className="space-y-2.5">
                    {sorted.slice(0, 5).map(([type, count]) => {
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={type} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <span>{TYPE_EMOJI[type] || '📋'}</span>
                              <span className="capitalize font-medium">{type}</span>
                            </span>
                            <span className="text-muted-foreground">{count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', TYPE_COLORS[type] || 'bg-gray-500')} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── QUICK LINKS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { href: '/workouts/new', icon: Plus, label: 'New Workout', color: 'from-red-500 to-orange-500' },
          { href: '/calendar', icon: CalendarIcon, label: 'Calendar', color: 'from-blue-500 to-cyan-500' },
          { href: '/reports', icon: BookOpen, label: 'Reports', color: 'from-purple-500 to-fuchsia-500' },
          { href: '/settings', icon: Settings, label: 'Settings', color: 'from-gray-500 to-gray-600' },
        ].map(link => (
          <Link key={link.href} href={link.href}>
            <Card className="p-3 hover:border-foreground/20 transition-all group cursor-pointer">
              <div className="flex items-center gap-2.5">
                <div className={cn('h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform', link.color)}>
                  <link.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs font-medium">{link.label}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
