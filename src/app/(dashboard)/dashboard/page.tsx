'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Calendar, TrendingUp, Target, Zap, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWorkouts() {
      if (!user) return;
      
      const data = await getUserWorkouts(user.uid, user.role);
      setWorkouts(data);
      setLoading(false);
    }

    loadWorkouts();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-muted-foreground">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  const upcomingWorkouts = workouts.filter(w => !w.completed).slice(0, 5);
  const completedCount = workouts.filter(w => w.completed).length;
  const completionRate = workouts.length > 0 
    ? Math.round((completedCount / workouts.length) * 100) 
    : 0;

  const statCards = [
    {
      title: 'Total Workouts',
      value: workouts.length,
      icon: Target,
      gradient: 'from-blue-500 to-cyan-500',
      description: 'All time',
    },
    {
      title: 'Completed',
      value: completedCount,
      icon: Zap,
      gradient: 'from-green-500 to-emerald-500',
      description: `${completionRate}% completion rate`,
    },
    {
      title: 'Pending',
      value: workouts.length - completedCount,
      icon: TrendingUp,
      gradient: 'from-orange-500 to-red-500',
      description: 'Ready to crush',
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* COACH CODE CARD - SUPER PROMINENT AT THE TOP! */}
      {user?.role === 'coach' && user?.coachCode && (
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-2 border-primary/30 shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold">🎯 Your Coach Code</CardTitle>
                <CardDescription className="text-base">Share this code with your students to connect instantly!</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1 text-center md:text-left">
                <div className="inline-block bg-background/50 backdrop-blur-sm px-8 py-6 rounded-2xl border-2 border-primary/20 shadow-lg">
                  <div className="font-mono text-6xl md:text-7xl font-black tracking-widest text-primary drop-shadow-lg">
                    {user.coachCode}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4 max-w-md">
                  💡 Students enter this code during registration to automatically become your students
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all"
                  onClick={() => {
                    navigator.clipboard.writeText(user.coachCode!);
                    toast.success('✅ Code copied to clipboard!');
                  }}
                >
                  📋 Copy Code
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Click to copy
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight">
            Welcome back, <span className="text-primary">{user?.displayName}</span>!
          </h1>
          <p className="text-muted-foreground">Here's your training overview</p>
        </div>
        {user?.role === 'coach' && (
          <Button asChild size="lg" className="shadow-lg shadow-primary/20">
            <Link href="/workouts/new">
              <Plus className="mr-2 h-5 w-5" />
              Create Workout
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-sm font-medium">{stat.title}</CardDescription>
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} opacity-10`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <CardTitle className="text-5xl font-bold tracking-tight">{stat.value}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Upcoming Workouts */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">Upcoming Workouts</CardTitle>
              <CardDescription>Your next scheduled training sessions</CardDescription>
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
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
                <Calendar className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No upcoming workouts</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                {user?.role === 'coach' 
                  ? "Create your first workout to get started with training planning"
                  : "Your coach hasn't assigned any workouts yet"}
              </p>
              {user?.role === 'coach' && (
                <Button asChild size="lg">
                  <Link href="/workouts/new">
                    <Plus className="mr-2 h-5 w-5" />
                    Create Your First Workout
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingWorkouts.map((workout) => (
                <Link
                  key={workout.id}
                  href={`/workouts/${workout.id}`}
                  className="flex items-center justify-between p-4 border-2 border-transparent rounded-xl hover:border-primary/20 hover:bg-muted/30 transition-all duration-200 group"
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
                      <p className="text-xs text-muted-foreground">{workout.duration} minutes</p>
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

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              View Calendar
            </CardTitle>
            <CardDescription>See all your workouts in a calendar view</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/calendar">
                Open Calendar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              All Workouts
            </CardTitle>
            <CardDescription>Browse and manage all your training sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/workouts">
                View All Workouts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
