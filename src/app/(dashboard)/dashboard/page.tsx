'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Calendar, TrendingUp, Target, Zap, ArrowRight,
  CheckCircle2, Clock, UserCircle, Flame, BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/dashboard/stats/StatCard';
import { ProgressRing } from '@/components/dashboard/stats/ProgressRing';
import { cn } from '@/lib/utils';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

interface TypeData { name: string; value: number; color: string; [key: string]: string | number; }

const TYPE_COLORS: Record<string, string> = {
  run: '#3b82f6', bike: '#f59e0b', swim: '#06b6d4', strength: '#a855f7', other: '#6b7280',
};

function calculateProfileCompletion(user: any): number {
  let score = 0;
  if (user.displayName) score += 20;
  if (user.bio) score += 20;
  if (user.timezone) score += 15;
  if (user.sportPreferences?.length > 0) score += 15;
  if (user.trainingFor?.length > 0) score += 15;
  if (user.notificationPreferences) score += 15;
  return score;
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      const workoutData = await getUserWorkouts(user.uid, user.role);
      setWorkouts(workoutData);
      setLoading(false);
      setTimeout(() => setReady(true), 150);
    }
    loadData();
  }, [user]);

  const upcomingWorkouts = workouts.filter(w => !w.completed).slice(0, 5);
  const completedCount = workouts.filter(w => w.completed).length;
  const completionRate = workouts.length > 0 ? Math.round((completedCount / workouts.length) * 100) : 0;

  const typeData = useMemo((): TypeData[] => {
    const counts: Record<string, number> = { run: 0, bike: 0, swim: 0, strength: 0, other: 0 };
    workouts.filter(w => w.completed).forEach(workout => {
      if (counts[workout.type] !== undefined) counts[workout.type]++;
      else counts['other']++;
    });
    return Object.entries(counts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, color: TYPE_COLORS[name] }));
  }, [workouts]);

  if (loading || !ready) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-muted-foreground animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const profileCompletion = user ? calculateProfileCompletion(user) : 100;
  const needsOnboarding = !user?.sportPreferences?.length || !user?.ageRange;
  const showProfileCTA = profileCompletion < 100;

  return (
    <div className="space-y-6 pb-8">
      {/* ── PROFILE COMPLETION CTA ──────────────────────────────── */}
      {showProfileCTA && (
        <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/5 via-transparent to-neutral-900/5 dark:to-neutral-100/5 p-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex flex-col sm:flex-row items-center gap-5">
            <div className="shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-600/20">
                <UserCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{needsOnboarding ? 'Finish Your Setup' : 'Complete Your Profile'}</h2>
              <p className="text-sm text-muted-foreground max-w-md">{needsOnboarding ? 'Pick up where you left off — it only takes a minute.' : 'Get personalized workouts and better tracking.'}</p>
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <div className="flex-1 max-w-xs h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500" style={{ width: `${profileCompletion}%` }} />
                </div>
                <span className="text-sm font-bold tabular-nums text-red-500">{profileCompletion}%</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <Button asChild size="lg" className="h-11 px-6 font-semibold shadow-lg shadow-red-600/20">
                <Link href={needsOnboarding ? '/onboarding' : '/profile?edit=1'}>{needsOnboarding ? 'Continue Setup' : 'Complete Profile'} <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <button onClick={() => sessionStorage.setItem('profile-cta-dismissed', 'true')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1 animate-in fade-in slide-in-from-left-4 duration-700">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {greeting}, <span className="text-red-500">{user?.displayName?.split(' ')[0]}</span>
          </h1>
          <p className="text-muted-foreground text-sm">Here&apos;s your training overview</p>
        </div>
        {workouts.length > 0 && (
          <div className="flex items-center gap-4 p-3.5 rounded-xl border bg-card animate-in fade-in slide-in-from-right-4 duration-700" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            <ProgressRing progress={completionRate} size="lg" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Completion</p>
              <p className="text-2xl font-bold">{completedCount}<span className="text-base text-muted-foreground font-normal">/{workouts.length}</span></p>
            </div>
          </div>
        )}
      </div>

      {/* ── STATS ───────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total" value={workouts.length} description="All-time workouts" icon={Target} gradient="from-red-500/5 to-transparent" iconGradient="from-red-600 to-red-800" delay={200} />
        <StatCard title="Completed" value={completedCount} description={`${completionRate}% rate`} icon={CheckCircle2} gradient="from-red-500/5 to-transparent" iconGradient="from-red-500 to-red-700" delay={350} />
        <StatCard title="Remaining" value={workouts.length - completedCount} description="Left to finish" icon={Flame} gradient="from-red-500/5 to-transparent" iconGradient="from-red-500 to-neutral-800" delay={500} />
      </div>

      {/* ── UPCOMING WORKOUTS ───────────────────────────────────── */}
      <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-lg flex items-center gap-2"><Zap className="h-5 w-5 text-red-500" />Upcoming</CardTitle>
              <CardDescription className="text-xs">Your next sessions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs"><Link href="/workouts">View all<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingWorkouts.length === 0 ? (
            <div className="text-center py-10">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 mb-3"><CheckCircle2 className="h-7 w-7 text-red-500" /></div>
              <h3 className="text-base font-semibold mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">You&apos;ve completed all workouts. Check back soon.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {upcomingWorkouts.map((workout, index) => (
                <Link key={workout.id} href={`/workouts/${workout.id}`} className={cn('flex items-center justify-between p-3.5 rounded-lg border hover:border-red-500/20 hover:bg-red-500/[0.02] transition-all duration-200 group animate-in fade-in slide-in-from-right-4 duration-500')} style={{ animationDelay: `${400 + index * 80}ms`, animationFillMode: 'backwards' }}>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm group-hover:text-red-500 transition-colors truncate">{workout.name}</h3>
                      <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0">{workout.type}</Badge>
                    </div>
                    {workout.description && <p className="text-xs text-muted-foreground line-clamp-1">{workout.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    {workout.duration && <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1"><Clock className="h-3 w-3" />{workout.duration}m</span>}
                    <span className="text-xs font-medium text-muted-foreground"><Calendar className="h-3 w-3 inline mr-1" />{format(workout.date.toDate(), 'MMM d')}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-red-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── BOTTOM ROW: CHART + QUICK ACTIONS ──────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Chart — 3 cols */}
        <Card className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '500ms', animationFillMode: 'backwards' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-red-500" />Distribution</CardTitle>
            <CardDescription className="text-xs">Completed workouts by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {typeData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--card-foreground))', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No completed workouts yet</div>}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions — 2 cols */}
        <div className="lg:col-span-2 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}>
          <Card className="flex-1 hover:border-red-500/20 transition-all group">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 text-red-500" />Calendar</CardTitle>
              <CardDescription className="text-xs">View your schedule</CardDescription>
            </CardHeader>
            <CardContent><Button asChild variant="outline" size="sm" className="w-full"><Link href="/calendar">Open<ArrowRight className="ml-2 h-3.5 w-3.5" /></Link></Button></CardContent>
          </Card>
          <Card className="flex-1 hover:border-red-500/20 transition-all group">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-red-500" />Workouts</CardTitle>
              <CardDescription className="text-xs">Full workout history</CardDescription>
            </CardHeader>
            <CardContent><Button asChild variant="outline" size="sm" className="w-full"><Link href="/workouts">View all<ArrowRight className="ml-2 h-3.5 w-3.5" /></Link></Button></CardContent>
          </Card>
          <Card className="flex-1 hover:border-red-500/20 transition-all group">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-red-500" />Reports</CardTitle>
              <CardDescription className="text-xs">Training analytics</CardDescription>
            </CardHeader>
            <CardContent><Button asChild variant="outline" size="sm" className="w-full"><Link href="/reports">View<ArrowRight className="ml-2 h-3.5 w-3.5" /></Link></Button></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
