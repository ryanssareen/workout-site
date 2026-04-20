'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle2, Clock, Plus, Calendar, Loader2 } from 'lucide-react';
import { getCoachDashboardStats, CoachStats } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { isCoachAssigned } from '@/types/workout';
import { format, isPast, isFuture, startOfDay } from 'date-fns';
import { formatInTimezone } from '@/lib/dateUtils';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TYPE_CONFIG } from '@/components/calendar/types';
import { useCoachFilter } from '@/hooks/useCoachFilter';
import { AthleteSelector } from './AthleteSelector';

interface CoachDashboardProps {
  username: string;
  timezone?: string;
  prefetchedWorkouts?: Workout[];
}

export function CoachDashboard({ username, timezone, prefetchedWorkouts }: CoachDashboardProps) {
  const [stats, setStats] = useState<CoachStats | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>(prefetchedWorkouts ?? []);
  const [loading, setLoading] = useState(!prefetchedWorkouts);
  const [error, setError] = useState<string | null>(null);
  const { selectedAthlete, selectAthlete, athletes: coachAthletes } = useCoachFilter(username);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const w = prefetchedWorkouts ?? workouts;
        const statsData = await getCoachDashboardStats(username, w);
        setStats(statsData);
        if (!prefetchedWorkouts) setLoading(false);
      } catch (err) {
        console.error('Failed to load coach dashboard:', err);
        setError('Could not load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username, prefetchedWorkouts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 px-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">😴</div>
          <h2 className="text-lg font-semibold">Data unavailable</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={() => window.location.reload()} className="text-sm text-primary hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const today = startOfDay(new Date());

  // Filter workouts by selected athlete
  const filteredWorkouts = selectedAthlete
    ? workouts.filter(w => w.ownerUsername === selectedAthlete || w.assignedTo === selectedAthlete)
    : workouts;

  const upcoming = filteredWorkouts
    .filter(w => !w.completed && isFuture(w.date?.toDate?.() ?? new Date()))
    .sort((a, b) => (a.date?.toDate?.()?.getTime() ?? 0) - (b.date?.toDate?.()?.getTime() ?? 0))
    .slice(0, 8);

  const recentlyCompleted = filteredWorkouts
    .filter(w => w.completed)
    .sort((a, b) => {
      const aTime = a.completedAt?.toDate?.()?.getTime() ?? a.updatedAt?.toDate?.()?.getTime() ?? 0;
      const bTime = b.completedAt?.toDate?.()?.getTime() ?? b.updatedAt?.toDate?.()?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 8);

  const completionRate = stats ? Math.round(stats.overallCompletionRate * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Athlete Selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Coach Dashboard</h1>
        <AthleteSelector
          selectedAthlete={selectedAthlete}
          onSelect={selectAthlete}
          athletes={coachAthletes}
        />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalStudents ?? 0}</p>
                <p className="text-xs text-muted-foreground">Athletes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Calendar className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalWorkouts ?? 0}</p>
                <p className="text-xs text-muted-foreground">Assigned (90d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completionRate}%</p>
                <p className="text-xs text-muted-foreground">Completion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pendingWorkouts ?? 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/workouts/new">
            <Plus className="h-4 w-4 mr-1.5" />
            Assign Workout
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/workouts">View All Workouts</Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Assigned */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming Workouts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No upcoming workouts</p>
            ) : (
              upcoming.map((w) => {
                const typeConfig = TYPE_CONFIG[w.type];
                return (
                  <Link
                    key={w.id}
                    href={`/workouts/${w.id}?owner=${w.ownerUsername || w.assignedTo}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">{typeConfig?.emoji ?? '📋'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{w.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(w as any).assignedToName && <span className="font-medium">{(w as any).assignedToName} · </span>}
                          {format(w.date?.toDate?.() ?? new Date(), 'MMM d')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs shrink-0">
                      {w.type}
                    </Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recently Completed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recently Completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentlyCompleted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No completed workouts yet</p>
            ) : (
              recentlyCompleted.map((w) => {
                const typeConfig = TYPE_CONFIG[w.type];
                return (
                  <Link
                    key={w.id}
                    href={`/workouts/${w.id}?owner=${w.ownerUsername || w.assignedTo}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{w.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(w as any).assignedToName && <span className="font-medium">{(w as any).assignedToName} · </span>}
                          {w.completedAt?.toDate ? format(w.completedAt.toDate(), 'MMM d') : 'Recently'}
                        </p>
                      </div>
                    </div>
                    {w.completionRating && (
                      <span className="text-xs text-muted-foreground">
                        {['', 'Struggled', 'Tough', 'Moderate', 'Strong', 'Crushed it'][w.completionRating]}
                      </span>
                    )}
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
