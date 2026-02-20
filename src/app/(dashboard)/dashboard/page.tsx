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
  Activity, CheckCircle2, Clock, UserCircle
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
  run: '#3b82f6', bike: '#22c55e', swim: '#06b6d4', strength: '#a855f7', other: '#6b7280',
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
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-muted-foreground animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const profileCompletion = user ? calculateProfileCompletion(user) : 100;
  const showProfileCTA = profileCompletion < 100;

  return (
    <div className="space-y-8 pb-8">
      {/* ── PROFILE COMPLETION CTA ──────────────────────────────── */}
      {showProfileCTA && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-red-500/5 to-green-500/5 p-6 sm:p-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex flex-col sm:flex-row items-center gap-6">
            <div className="shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-green-500 flex items-center justify-center shadow-xl shadow-red-600/20">
                <UserCircle className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Build Your Profile</h2>
              <p className="text-muted-foreground max-w-md">Complete your athlete profile to get personalized workouts and track your progress. It only takes a minute.</p>
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <div className="flex-1 max-w-xs h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-green-500 transition-all duration-500" style={{ width: `${profileCompletion}%` }} />
                </div>
                <span className="text-sm font-bold tabular-nums">{profileCompletion}%</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              <Button asChild size="lg" className="h-12 px-8 font-bold shadow-lg shadow-primary/20 text-base">
                <Link href="/profile?edit=1">Complete Profile <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <button onClick={() => sessionStorage.setItem('profile-cta-dismissed', 'true')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Do this later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="space-y-1 animate-in fade-in slide-in-from-left-4 duration-700">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {greeting}, <span className="text-primary">{user?.displayName?.split(' ')[0]}</span>
          </h1>
          <p className="text-muted-foreground">Track your training progress</p>
        </div>
        {workouts.length > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-2xl border border-green-500/20 bg-green-500/5 animate-in fade-in slide-in-from-right-4 duration-700" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            <ProgressRing progress={completionRate} size="lg" color="stroke-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Overall Progress</p>
              <p className="text-2xl font-bold">{completedCount}/{workouts.length}</p>
              <p className="text-xs text-muted-foreground">workouts completed</p>
            </div>
          </div>
        )}
      </div>

      {/* ── STATS ───────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="All Time" value={workouts.length} description="Total workouts" icon={Target} gradient="from-red-500/5 to-cyan-500/5 dark:from-red-500/15 dark:to-cyan-500/15" iconGradient="from-red-500 to-cyan-500" delay={250} />
        <StatCard title="Completed" value={completedCount} description={`${completionRate}% completion rate`} icon={CheckCircle2} gradient="from-green-500/5 to-green-500/5 dark:from-green-500/15 dark:to-green-500/15" iconGradient="from-green-500 to-green-500" delay={250} />
        <StatCard title="Remaining" value={workouts.length - completedCount} description="Still to complete" icon={TrendingUp} gradient="from-red-500/5 to-amber-500/5 dark:from-red-500/15 dark:to-amber-500/15" iconGradient="from-red-500 to-amber-500" delay={700} />
      </div>

      {/* ── UPCOMING WORKOUTS ───────────────────────────────────── */}
      <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Upcoming Workouts</CardTitle>
              <CardDescription>Ready to tackle these sessions</CardDescription>
            </div>
            <Button variant="outline" asChild className="group"><Link href="/workouts">View All<ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></Link></Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingWorkouts.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mb-4"><CheckCircle2 className="h-8 w-8 text-green-500" /></div>
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">You&apos;ve completed all your workouts. Check back later for new sessions.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingWorkouts.map((workout, index) => (
                <Link key={workout.id} href={`/workouts/${workout.id}`} className={cn('flex items-center justify-between p-4 rounded-xl border hover:border-primary/20 hover:bg-muted/50 transition-all duration-200 group animate-in fade-in slide-in-from-right-4 duration-500')} style={{ animationDelay: `${400 + index * 100}ms`, animationFillMode: 'backwards' }}>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{workout.name}</h3>
                      <Badge variant="secondary" className="capitalize">{workout.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{workout.description}</p>
                    {workout.duration && <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{workout.duration} minutes</p>}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm font-medium"><Calendar className="h-4 w-4 text-muted-foreground" />{format(workout.date.toDate(), 'MMM d')}</div>
                      <div className="text-xs text-muted-foreground">{format(workout.date.toDate(), 'yyyy')}</div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── WORKOUT DISTRIBUTION ────────────────────────────────── */}
      <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}>
        <CardHeader><CardTitle>Workout Distribution</CardTitle><CardDescription>Breakdown of completed workouts by type</CardDescription></CardHeader>
        <CardContent>
          <div className="h-[300px] min-w-[300px]">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {typeData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--card-foreground))' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-muted-foreground">No completed workouts yet</div>}
          </div>
        </CardContent>
      </Card>

      {/* ── QUICK ACTIONS ───────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '700ms', animationFillMode: 'backwards' }}>
        <Card className="hover:shadow-md hover:border-primary/20 transition-all duration-500 group">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Calendar View</CardTitle><CardDescription className="text-sm">See your schedule at a glance</CardDescription></CardHeader>
          <CardContent><Button asChild variant="outline" className="w-full group-hover:border-primary/30"><Link href="/calendar">Open Calendar<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent>
        </Card>
        <Card className="hover:shadow-md hover:border-primary/20 transition-all duration-500 group">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Target className="h-5 w-5 text-primary" />All Workouts</CardTitle><CardDescription className="text-sm">View your complete workout history</CardDescription></CardHeader>
          <CardContent><Button asChild variant="outline" className="w-full group-hover:border-primary/30"><Link href="/workouts">View Workouts<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent>
        </Card>
      </div>
    </div>
  );
}
