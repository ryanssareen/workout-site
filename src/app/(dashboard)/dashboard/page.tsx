'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Calendar, TrendingUp, Target, Zap,
  CheckCircle2, Clock, UserCircle, Flame, BarChart3,
  Plus, Activity, Trophy, ChevronRight,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval, differenceInDays, isSameDay, subDays, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from '@/components/dashboard/stats/ProgressRing';
import { cn } from '@/lib/utils';
import { useStravaAutoSync } from '@/hooks/useStravaAutoSync';
import { ProfileCompletionBar } from '@/components/dashboard/ProfileCompletionBar';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts';

const TYPE_COLORS: Record<string, string> = {
  run: '#ef4444', bike: '#f59e0b', swim: '#06b6d4', strength: '#a855f7', other: '#6b7280',
};
const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', strength: '💪', other: '📋',
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


export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const searchParams = useSearchParams();
  const redirectedRef = useRef(false);

  // Detect if arriving from onboarding Strava connect
  const fromOnboarding = searchParams.get('strava') === 'connected';

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Refresh workouts from Firestore (used by auto-sync callback)
  const refreshWorkouts = useCallback(async () => {
    if (!user) return;
    const workoutData = await getUserWorkouts(user.username, user.role);
    setWorkouts(workoutData);
  }, [user]);

  // After first sync phase (week data), redirect to calendar so user sees recent workouts
  // The async sync function continues running in the background (month/year phases)
  const handleFirstPhaseComplete = useCallback(() => {
    if (!fromOnboarding || redirectedRef.current) return;
    redirectedRef.current = true;
    router.push('/calendar');
  }, [fromOnboarding, router]);

  // Auto-sync Strava in background on login
  useStravaAutoSync(user, refreshWorkouts, fromOnboarding ? handleFirstPhaseComplete : undefined);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      const workoutData = await getUserWorkouts(user.username, user.role);
      setWorkouts(workoutData);
      setLoading(false);
      setTimeout(() => setReady(true), 100);
    }
    loadData();
  }, [user]);

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

  const completedCount = workouts.filter(w => w.completed).length;
  const completionRate = workouts.length > 0 ? Math.round((completedCount / workouts.length) * 100) : 0;
  const streak = useMemo(() => calculateStreak(workouts), [workouts]);

  const upcomingWorkouts = workouts
    .filter(w => !w.completed)
    .sort((a, b) => getWorkoutDate(a).getTime() - getWorkoutDate(b).getTime())
    .slice(0, 4);

  const recentCompleted = workouts
    .filter(w => w.completed)
    .sort((a, b) => getWorkoutDate(b).getTime() - getWorkoutDate(a).getTime())
    .slice(0, 3);

  // Weekly bar chart data (Mon-Sun)
  const weeklyChartData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      const dayWorkouts = thisWeekWorkouts.filter(w => isSameDay(getWorkoutDate(w), dayDate));
      const completed = dayWorkouts.filter(w => w.completed).length;
      const pending = dayWorkouts.filter(w => !w.completed).length;
      const isToday = isSameDay(dayDate, now);
      return { day, completed, pending, total: completed + pending, isToday };
    });
  }, [thisWeekWorkouts, weekStart, now]);

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

  // Type distribution for mini chart
  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    workouts.filter(w => w.completed).forEach(w => {
      counts[w.type] = (counts[w.type] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, pct: Math.round((count / completedCount) * 100) }));
  }, [workouts, completedCount]);

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

  return (
    <div className="space-y-6 pb-8">

      {/* ── PROFILE COMPLETION BAR ──────────────────────────────── */}
      {user && <ProfileCompletionBar user={user} />}

      {/* ── HERO HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href="/workouts/new"><Plus className="h-4 w-4 mr-1.5" />New Workout</Link>
          </Button>
        </div>
      </div>

      {/* ── STATS ROW ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
              <p className="text-xs text-muted-foreground mt-0.5">All-time completed</p>
            </div>
          </div>
        </Card>

        {/* Completion Rate */}
        <Card className="p-4 hover:border-red-500/20 transition-all">
          <div className="flex items-center gap-3">
            <ProgressRing progress={completionRate} size="sm" strokeWidth={4} />
            <div>
              <p className="text-2xl font-bold leading-none">{completionRate}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Completion rate</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── WEEKLY CHART + UPCOMING ────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Weekly Activity Chart - 3 cols */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-red-500" />This Week
              </CardTitle>
              <Link href="/calendar" className="text-xs text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1">
                Calendar <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {thisWeekTotal > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyChartData} barCategoryGap="20%">
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--card-foreground))', fontSize: '12px' }}
                      formatter={((value: any, name: any) => [value, name === 'completed' ? 'Done' : 'Pending']) as any}
                    />
                    <Bar dataKey="completed" stackId="a" radius={[0, 0, 0, 0]} fill="#ef4444">
                      {weeklyChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.isToday ? '#dc2626' : '#ef4444'} fillOpacity={entry.isToday ? 1 : 0.7} />
                      ))}
                    </Bar>
                    <Bar dataKey="pending" stackId="a" radius={[4, 4, 0, 0]} fill="#fca5a5" fillOpacity={0.4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-center">
                <Calendar className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No workouts this week</p>
                <Button asChild size="sm" variant="link" className="text-red-500 mt-1">
                  <Link href="/workouts/new">Create one</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Type Breakdown - 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-red-500" />Breakdown
              </CardTitle>
              <Link href="/reports" className="text-xs text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1">
                Reports <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {typeBreakdown.length > 0 ? (
              <div className="space-y-3">
                {typeBreakdown.map(({ type, count, pct }) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-lg w-7 text-center">{TYPE_EMOJI[type] || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{type}</span>
                        <span className="text-xs text-muted-foreground">{count} · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: TYPE_COLORS[type] || '#6b7280' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[180px] flex flex-col items-center justify-center text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Complete workouts to see your breakdown</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── UPCOMING + RECENT + EVENTS ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Upcoming Workouts */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-red-500" />Upcoming
              </CardTitle>
              <Link href="/workouts" className="text-xs text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1">
                All workouts <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingWorkouts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-10 w-10 text-red-500/30 mx-auto mb-2" />
                <p className="text-sm font-medium mb-1">All caught up!</p>
                <p className="text-xs text-muted-foreground">No pending workouts</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingWorkouts.map((workout) => {
                  const wDate = getWorkoutDate(workout);
                  const isToday = isSameDay(wDate, now);
                  const isTomorrow = isSameDay(wDate, new Date(now.getTime() + 86400000));
                  const dateLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : format(wDate, 'MMM d');
                  return (
                    <Link key={workout.id} href={`/workouts/${workout.id}`}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border transition-all group hover:border-red-500/20 hover:bg-red-500/[0.02]',
                        isToday && 'border-red-500/20 bg-red-500/[0.03]'
                      )}>
                      <span className="text-xl">{TYPE_EMOJI[workout.type] || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-red-500 transition-colors">{workout.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{workout.type}</Badge>
                          {workout.duration && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{workout.duration}m</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-xs font-medium', isToday ? 'text-red-500' : 'text-muted-foreground')}>{dateLabel}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-red-500 transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Recent + Events */}
        <div className="space-y-4">
          {/* Recent Completed */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" />Recently Done</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCompleted.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No completed workouts yet</p>
              ) : (
                <div className="space-y-2">
                  {recentCompleted.map((w) => (
                    <Link key={w.id} href={`/workouts/${w.id}`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                      <span className="text-base">{TYPE_EMOJI[w.type] || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate group-hover:text-red-500 transition-colors">{w.name}</p>
                        <p className="text-[10px] text-muted-foreground">{format(getWorkoutDate(w), 'MMM d')}</p>
                      </div>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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

          {/* Quick Links */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm" className="h-9 text-xs">
                <Link href="/calendar"><Calendar className="h-3.5 w-3.5 mr-1.5" />Calendar</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-9 text-xs">
                <Link href="/reports"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Reports</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-9 text-xs">
                <Link href="/profile"><UserCircle className="h-3.5 w-3.5 mr-1.5" />Profile</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-9 text-xs">
                <Link href="/workouts"><Target className="h-3.5 w-3.5 mr-1.5" />Workouts</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
