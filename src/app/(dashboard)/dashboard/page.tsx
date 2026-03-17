'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { getPersonalRecords, getMilestones } from '@/lib/firebase/firestore';
import { Workout, PersonalRecord } from '@/types';
import type { Milestone } from '@/types/achievements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import {
  Target, Zap,
  CheckCircle2, Clock, Flame,
  Activity, Trophy, ChevronRight, Gift, X, CalendarRange,
  Circle,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval, differenceInDays, isSameDay, subDays, parseISO, isPast, isToday as isTodayFn } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useStravaAutoSync } from '@/hooks/useStravaAutoSync';
import { ProfileCompletionBar } from '@/components/dashboard/ProfileCompletionBar';
import { DashboardAchievements } from '@/components/achievements/DashboardAchievements';

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '📋',
};

function getWorkoutDate(w: Workout): Date {
  return w.date?.toDate?.() ?? new Date(w.date as any);
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
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
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
      const [workoutData, prData, msData] = await Promise.all([
        getWorkouts(user.username, user.role),
        getPersonalRecords(user.username),
        getMilestones(user.username),
      ]);
      setWorkouts(workoutData);
      setPersonalRecords(prData);
      setMilestones(msData);
      setLoading(false);
      setTimeout(() => setReady(true), 100);
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

  if (loading || !ready) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Combine recent done + upcoming planned for unified list
  const combinedWorkouts = [
    ...recentCompleted.map(w => ({ workout: w, section: 'done' as const })),
    ...upcomingWorkouts.map(w => ({ workout: w, section: 'planned' as const })),
  ];

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
        {/* Streak */}
        <Card className="p-4 hover:border-red-500/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-sm">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{streak}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Day streak</p>
            </div>
          </div>
        </Card>

        {/* This Week */}
        <Card className="p-4 hover:border-red-500/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-sm">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{thisWeekCompleted}<span className="text-sm text-muted-foreground font-normal">/{thisWeekTotal}</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">This week</p>
            </div>
          </div>
        </Card>

        {/* All-time */}
        <Card className="p-4 hover:border-red-500/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-sm">
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
    </div>
  );
}
