'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getWorkout, completeWorkout } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit, ArrowLeft, Calendar, Clock, CheckCircle2, Circle, Activity } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CommentSection } from '@/components/workouts/comments';
import { CompletionDialog, UncompletionDialog } from '@/components/workouts/CompletionDialog';
import { cn } from '@/lib/utils';

export default function WorkoutDetailPage() {
  const router = useRouter();
  const params = useParams();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showUncompletionDialog, setShowUncompletionDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleComplete = async (notes?: string) => {
    if (!workout) return;

    setIsUpdating(true);
    try {
      await completeWorkout(workout.id, true, notes);
      setWorkout({
        ...workout,
        completed: true,
        completedBy: 'manual',
        completionNotes: notes,
      });
      setShowCompletionDialog(false);
      toast.success('Workout marked as complete!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workout');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUncomplete = async () => {
    if (!workout) return;

    setIsUpdating(true);
    try {
      await completeWorkout(workout.id, false);
      setWorkout({
        ...workout,
        completed: false,
        completedBy: undefined,
        completionNotes: undefined,
      });
      setShowUncompletionDialog(false);
      toast.success('Workout marked as incomplete');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workout');
    } finally {
      setIsUpdating(false);
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
  const isPastWorkout = workout.date.toDate() < new Date();
  const isMissed = isPastWorkout && !workout.completed;

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

      <Card
        className={cn(
          workout.completed && 'border-green-200 dark:border-green-900',
          isMissed && 'border-red-200 dark:border-red-900'
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-3xl">{workout.name}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="capitalize">
                  {workout.type}
                </Badge>
                {workout.completed ? (
                  <Badge className="bg-green-500 hover:bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                ) : isMissed ? (
                  <Badge variant="destructive">Missed</Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
                {workout.completedBy === 'strava' && (
                  <Badge variant="outline" className="border-orange-500 text-orange-600">
                    <Activity className="h-3 w-3 mr-1" />
                    via Strava
                  </Badge>
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

          {/* Strava stats if available */}
          {workout.actualStats && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Strava Stats
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {workout.actualStats.distance && (
                  <div>
                    <p className="text-sm text-muted-foreground">Distance</p>
                    <p className="font-medium">
                      {(workout.actualStats.distance / 1000).toFixed(2)} km
                    </p>
                  </div>
                )}
                {workout.actualStats.duration && (
                  <div>
                    <p className="text-sm text-muted-foreground">Moving Time</p>
                    <p className="font-medium">
                      {Math.round(workout.actualStats.duration / 60)} min
                    </p>
                  </div>
                )}
                {workout.actualStats.calories && (
                  <div>
                    <p className="text-sm text-muted-foreground">Calories</p>
                    <p className="font-medium">{workout.actualStats.calories}</p>
                  </div>
                )}
                {workout.actualStats.avgHeartRate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Avg HR</p>
                    <p className="font-medium">{workout.actualStats.avgHeartRate} bpm</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {workout.description}
            </p>
          </div>

          {/* Completion notes */}
          {workout.completionNotes && (
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-green-700 dark:text-green-400">
                Completion Notes
              </h3>
              <p className="text-muted-foreground italic">
                &quot;{workout.completionNotes}&quot;
              </p>
            </div>
          )}

          {/* Completion button */}
          <Button
            onClick={() =>
              workout.completed
                ? setShowUncompletionDialog(true)
                : setShowCompletionDialog(true)
            }
            className={cn(
              'w-full',
              !workout.completed && 'bg-green-600 hover:bg-green-700'
            )}
            variant={workout.completed ? 'outline' : 'default'}
          >
            {workout.completed ? (
              <>
                <Circle className="h-4 w-4 mr-2" />
                Mark as Incomplete
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Complete
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Comments section */}
      <CommentSection
        workoutId={workout.id}
        workoutName={workout.name}
        currentUserId={user.uid}
        currentUserName={user.displayName}
        currentUserRole={user.role}
        coachId={workout.createdBy}
      />

      {/* Completion dialogs */}
      <CompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        workoutName={workout.name}
        onConfirm={handleComplete}
        isLoading={isUpdating}
      />
      <UncompletionDialog
        open={showUncompletionDialog}
        onOpenChange={setShowUncompletionDialog}
        workoutName={workout.name}
        onConfirm={handleUncomplete}
        isLoading={isUpdating}
      />
    </div>
  );
}
