'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, getCoachDashboardStats, CoachStats } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Plus, Calendar, TrendingUp, Target, Zap, ArrowRight,
  Users, Activity, CheckCircle2, Clock, Copy, Check
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { StatCard } from '@/components/dashboard/stats/StatCard';
import { ProgressRing } from '@/components/dashboard/stats/ProgressRing';
import { StudentOverview } from '@/components/dashboard/StudentOverview';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { ProfileCompletionBanner } from '@/components/dashboard/ProfileCompletionBanner';
import { cn } from '@/lib/utils';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface TypeData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

const TYPE_COLORS: Record<string, string> = {
  run: '#3b82f6',
  bike: '#22c55e',
  swim: '#06b6d4',
  strength: '#a855f7',
  other: '#6b7280',
};

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [coachStats, setCoachStats] = useState<CoachStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);

  // Time-based greeting
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

      if (user.role === 'coach') {
        const stats = await getCoachDashboardStats(user.uid);
        setCoachStats(stats);
      }

      setLoading(false);
      // Small delay before revealing content for smooth entrance
      setTimeout(() => setReady(true), 150);
    }

    loadData();
  }, [user]);

  const handleCopyCode = () => {
    if (user?.coachCode) {
      navigator.clipboard.writeText(user.coachCode);
      setCopied(true);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const upcomingWorkouts = workouts.filter(w => !w.completed).slice(0, 5);
  const completedCount = workouts.filter(w => w.completed).length;
  const completionRate = workouts.length > 0
    ? Math.round((completedCount / workouts.length) * 100)
    : 0;

  const typeData = useMemo((): TypeData[] => {
    const counts: Record<string, number> = { run: 0, bike: 0, swim: 0, strength: 0, other: 0 };

    workouts.filter(w => w.completed).forEach(workout => {
      if (counts[workout.type] !== undefined) {
        counts[workout.type]++;
      } else {
        counts['other']++;
      }
    });

    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: TYPE_COLORS[name],
      }));
  }, [workouts]);

  const isConnected = !!user?.coachId;

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

  // ---------- Coach Dashboard ----------
  if (user?.role === 'coach') {
    return (
      <div className="space-y-8 pb-8">
        <OnboardingModal />
        <ProfileCompletionBanner />
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-1 animate-in fade-in slide-in-from-left-4 duration-700">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {greeting}, <span className="text-primary">{user?.displayName?.split(' ')[0]}</span> 👋
            </h1>
            <p className="text-muted-foreground">Here&apos;s your coaching overview</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-700" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            {user?.coachCode && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 dark:border-primary/30 bg-primary/5 dark:bg-primary/10">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Code</div>
                <div className="font-mono text-xl font-bold tracking-wider">{user.coachCode}</div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyCode}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
            <Button asChild size="lg" className="shadow-lg shadow-primary/20 dark:shadow-none">
              <Link href="/workouts/new">
                <Plus className="mr-2 h-5 w-5" />
                Create Workout
              </Link>
            </Button>
          </div>
        </div>

        {/* Athlete Metrics */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Athlete Overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Total Athletes"
              value={coachStats?.totalStudents ?? 0}
              description="Athletes enrolled"
              icon={Users}
              gradient="from-blue-500/5 to-cyan-500/5 dark:from-blue-500/15 dark:to-cyan-500/15"
              iconGradient="from-blue-500 to-cyan-500"
              delay={250}
            />
            <StatCard
              title="Active This Week"
              value={coachStats?.activeStudents ?? 0}
              description="Completed a workout"
              icon={Activity}
              gradient="from-green-500/5 to-emerald-500/5 dark:from-green-500/15 dark:to-emerald-500/15"
              iconGradient="from-green-500 to-emerald-500"
              delay={250}
            />
            <StatCard
              title="Avg Completion"
              value={`${coachStats?.overallCompletionRate ?? 0}%`}
              description="Overall rate"
              icon={Target}
              gradient="from-violet-500/5 to-purple-500/5 dark:from-violet-500/15 dark:to-purple-500/15"
              iconGradient="from-violet-500 to-purple-500"
              delay={700}
            />
          </div>
        </div>

        {/* Workout Metrics */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            Workout Stats
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Workouts Created"
              value={coachStats?.totalWorkouts ?? 0}
              description="All time"
              icon={Target}
              gradient="from-orange-500/5 to-amber-500/5 dark:from-orange-500/15 dark:to-amber-500/15"
              iconGradient="from-orange-500 to-amber-500"
              delay={550}
            />
            <StatCard
              title="Completed"
              value={coachStats?.completedWorkouts ?? 0}
              description={`${coachStats?.overallCompletionRate ?? 0}% completion rate`}
              icon={CheckCircle2}
              gradient="from-green-500/5 to-emerald-500/5 dark:from-green-500/15 dark:to-emerald-500/15"
              iconGradient="from-green-500 to-emerald-500"
              delay={700}
            />
            <StatCard
              title="Pending"
              value={coachStats?.pendingWorkouts ?? 0}
              description="Awaiting completion"
              icon={Clock}
              gradient="from-rose-500/5 to-pink-500/5 dark:from-rose-500/15 dark:to-pink-500/15"
              iconGradient="from-rose-500 to-pink-500"
              delay={850}
            />
          </div>
        </div>

        {/* Two Column: Students & Upcoming */}
        <div className="grid gap-6 lg:grid-cols-2">
          <StudentOverview students={coachStats?.studentsWithStats ?? []} delay={600} />

          <Card
            className="animate-in fade-in slide-in-from-bottom-4 duration-700"
            style={{ animationDelay: '700ms', animationFillMode: 'backwards' }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Upcoming Workouts
                  </CardTitle>
                  <CardDescription>Next scheduled sessions</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild className="group">
                  <Link href="/workouts">
                    View All
                    <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingWorkouts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">No upcoming workouts</p>
                  <Button asChild size="sm">
                    <Link href="/workouts/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Workout
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingWorkouts.map((workout, index) => (
                    <Link
                      key={workout.id}
                      href={`/workouts/${workout.id}`}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        'hover:border-primary/20 dark:hover:border-white/20 hover:bg-muted/50 dark:hover:bg-white/5 transition-all duration-200 group',
                        'animate-in fade-in slide-in-from-right-2 duration-500'
                      )}
                      style={{ animationDelay: `${800 + index * 50}ms`, animationFillMode: 'backwards' }}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                            {workout.name}
                          </h4>
                          <Badge variant="secondary" className="capitalize text-xs">
                            {workout.type}
                          </Badge>
                        </div>
                        {workout.duration && (
                          <p className="text-xs text-muted-foreground">{workout.duration} min</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-muted-foreground">
                          {format(workout.date.toDate(), 'MMM d')}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div
          className="grid gap-4 sm:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-700"
          style={{ animationDelay: '900ms', animationFillMode: 'backwards' }}
        >
          <Card className="hover:shadow-md dark:hover:shadow-none hover:border-primary/20 dark:hover:border-white/20 transition-all duration-500 group">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Calendar View
              </CardTitle>
              <CardDescription className="text-sm">See all workouts on a calendar</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full group-hover:border-primary/30 dark:group-hover:border-white/20">
                <Link href="/calendar">
                  Open Calendar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md dark:hover:shadow-none hover:border-primary/20 dark:hover:border-white/20 transition-all duration-500 group">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                All Workouts
              </CardTitle>
              <CardDescription className="text-sm">Browse and manage workouts</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full group-hover:border-primary/30 dark:group-hover:border-white/20">
                <Link href="/workouts">
                  View Workouts
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---------- Athlete Dashboard ----------
  return (
    <div className="space-y-8 pb-8">
      <OnboardingModal />
      <ProfileCompletionBanner />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="space-y-1 animate-in fade-in slide-in-from-left-4 duration-700">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {greeting}, <span className="text-primary">{user?.displayName?.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-muted-foreground">Track your training progress</p>
        </div>

        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-700" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
          {!isConnected && (
            <Button asChild size="lg" className="shadow-lg shadow-primary/20 dark:shadow-none">
              <Link href="/settings">
                <Users className="mr-2 h-5 w-5" />
                Connect to Coach
              </Link>
            </Button>
          )}

          {workouts.length > 0 && (
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-green-500/20 dark:border-green-500/30 bg-green-500/5 dark:bg-green-500/10">
              <ProgressRing progress={completionRate} size="lg" color="stroke-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Overall Progress</p>
                <p className="text-2xl font-bold">{completedCount}/{workouts.length}</p>
                <p className="text-xs text-muted-foreground">workouts completed</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Athlete Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="All Time"
          value={workouts.length}
          description={isConnected ? 'Total from your coach' : 'Total workouts assigned'}
          icon={Target}
          gradient="from-blue-500/5 to-cyan-500/5 dark:from-blue-500/15 dark:to-cyan-500/15"
          iconGradient="from-blue-500 to-cyan-500"
          delay={250}
        />
        <StatCard
          title="Completed"
          value={completedCount}
          description={`${completionRate}% completion rate`}
          icon={CheckCircle2}
          gradient="from-green-500/5 to-emerald-500/5 dark:from-green-500/15 dark:to-emerald-500/15"
          iconGradient="from-green-500 to-emerald-500"
          delay={250}
        />
        <StatCard
          title="Remaining"
          value={workouts.length - completedCount}
          description="Still to complete"
          icon={TrendingUp}
          gradient="from-orange-500/5 to-amber-500/5 dark:from-orange-500/15 dark:to-amber-500/15"
          iconGradient="from-orange-500 to-amber-500"
          delay={700}
        />
      </div>

      {/* Upcoming Workouts */}
      <Card
        className="animate-in fade-in slide-in-from-bottom-4 duration-700"
        style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Upcoming Workouts
              </CardTitle>
              <CardDescription>Ready to tackle these sessions</CardDescription>
            </div>
            <Button variant="outline" asChild className="group">
              <Link href="/workouts">
                View All
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingWorkouts.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 dark:bg-green-500/20 mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                You&apos;ve completed all your assigned workouts. Check back later for new sessions.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingWorkouts.map((workout, index) => (
                <Link
                  key={workout.id}
                  href={`/workouts/${workout.id}`}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border',
                    'hover:border-primary/20 dark:hover:border-white/20 hover:bg-muted/50 dark:hover:bg-white/5 transition-all duration-200 group',
                    'animate-in fade-in slide-in-from-right-4 duration-500'
                  )}
                  style={{ animationDelay: `${400 + index * 100}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                        {workout.name}
                      </h3>
                      <Badge variant="secondary" className="capitalize">
                        {workout.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{workout.description}</p>
                    {workout.duration && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {workout.duration} minutes
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(workout.date.toDate(), 'MMM d')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(workout.date.toDate(), 'yyyy')}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workout Distribution Chart */}
      <Card
        className="animate-in fade-in slide-in-from-bottom-4 duration-700"
        style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}
      >
        <CardHeader>
          <CardTitle>Workout Distribution</CardTitle>
          <CardDescription>Breakdown of completed workouts by type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] min-w-[300px]">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--card-foreground))',
                    }}
                    itemStyle={{
                      color: 'hsl(var(--card-foreground))',
                    }}
                    labelStyle={{
                      color: 'hsl(var(--card-foreground))',
                    }}
                  />
                  <Legend
                    wrapperStyle={{
                      color: 'hsl(var(--muted-foreground))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No completed workouts yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div
        className="grid gap-4 sm:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-700"
        style={{ animationDelay: '700ms', animationFillMode: 'backwards' }}
      >
        <Card className="hover:shadow-md dark:hover:shadow-none hover:border-primary/20 dark:hover:border-white/20 transition-all duration-500 group">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Calendar View
            </CardTitle>
            <CardDescription className="text-sm">See your schedule at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full group-hover:border-primary/30 dark:group-hover:border-white/20">
              <Link href="/calendar">
                Open Calendar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md dark:hover:shadow-none hover:border-primary/20 dark:hover:border-white/20 transition-all duration-500 group">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              All Workouts
            </CardTitle>
            <CardDescription className="text-sm">View your complete workout history</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full group-hover:border-primary/30 dark:group-hover:border-white/20">
              <Link href="/workouts">
                View Workouts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
