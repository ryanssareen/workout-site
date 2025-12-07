'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Loader2 } from 'lucide-react';

/**
 * Dashboard page component
 * 
 * Data aggregation:
 * - Total workouts count
 * - Completed workouts count
 * - Pending workouts count
 * - Recent workouts preview (5 most recent)
 * 
 * Role-based features:
 * - Coaches: "Create Workout" button visible
 * - Students: View only mode
 * 
 * Loading states:
 * - Initial auth check
 * - Workout data fetch
 * - Redirect for unauthenticated users
 */
export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Authentication guard and data loading
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    async function loadWorkouts() {
      if (!user) return;
      
      setDataLoading(true);
      const data = await getUserWorkouts(user.uid, user.role);
      setWorkouts(data);
      setDataLoading(false);
    }

    if (user) {
      loadWorkouts();
    }
  }, [user, loading, router]);

  // Loading screen during auth check
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No user state (redirecting)
  if (!user) {
    return null;
  }

  // Calculate statistics
  const totalWorkouts = workouts.length;
  const completedWorkouts = workouts.filter(w => w.completed).length;
  const pendingWorkouts = workouts.filter(w => !w.completed).length;
  const upcomingWorkouts = workouts.filter(w => !w.completed).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header with CTA */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user.displayName}
          </p>
        </div>
        {user.role === 'coach' && (
          <Button asChild>
            <Link href="/workouts/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Workout
            </Link>
          </Button>
        )}
      </div>

      {/* Statistics cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total Workouts</CardDescription>
            <CardTitle className="text-4xl">{totalWorkouts}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader>
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-4xl text-green-600">{completedWorkouts}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader>
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-4xl text-yellow-600">{pendingWorkouts}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Upcoming workouts section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Upcoming Workouts</CardTitle>
            <CardDescription>Your next scheduled training sessions</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href="/workouts">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : upcomingWorkouts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No upcoming workouts</p>
              {user.role === 'coach' && (
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/workouts/new">Create Your First Workout</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <h3 className="font-semibold">{workout.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {workout.type}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {workout.date.toDate().toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
