'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getWorkout, toggleWorkoutCompletion } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit, ArrowLeft, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';

/**
 * Workout detail view page
 * 
 * Features:
 * - Full workout information display
 * - Completion toggle for students
 * - Edit button for coaches (own workouts only)
 * - Back navigation to workouts list
 * 
 * Data validation:
 * - Checks user permissions for edit access
 * - Handles non-existent workouts gracefully
 * - Loading states during fetch
 */
export default function WorkoutDetailPage() {
  const router = useRouter();
  const params = useParams();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    async function loadWorkout() {
      if (!params.id || typeof params.id !== 'string') return;
      
      setDataLoading(true);
      const data = await getWorkout(params.id);
      
      if (!data) {
        toast.error('Workout not found');
        router.push('/workouts');
        return;
      }
      
      setWorkout(data);
      setDataLoading(false);
    }

    if (user) {
      loadWorkout();
    }
  }, [user, loading, router, params.id]);

  const handleToggleComplete = async () => {
    if (!workout) return;

    try {
      await toggleWorkoutCompletion(workout.id, !workout.completed);
      setWorkout({ ...workout, completed: !workout.completed });
      toast.success(
        !workout.completed ? 'Workout marked as complete' : 'Workout marked as incomplete'
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workout');
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !workout) return null;

  const canEdit = user.role === 'coach' && workout.createdBy === user.uid;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/workouts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workouts
          </Link>
        </Button>

        {canEdit && (
          <Button asChild>
            <Link href={`/workouts/${workout.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-3xl">{workout.name}</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline" className="capitalize">
                  {workout.type}
                </Badge>
                {workout.completed ? (
                  <Badge className="bg-green-500">Completed</Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Date</p>
                <p className="font-medium">
                  {format(workout.date.toDate(), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>

            {workout.duration && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{workout.duration} minutes</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {workout.description}
            </p>
          </div>

          {user.role === 'student' && (
            <Button
              onClick={handleToggleComplete}
              className="w-full"
              variant={workout.completed ? 'outline' : 'default'}
            >
              {workout.completed ? 'Mark as Incomplete' : 'Mark as Complete'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
