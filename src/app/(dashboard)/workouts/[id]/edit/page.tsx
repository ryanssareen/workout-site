'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getWorkout, updateWorkout, getCoachStudents } from '@/lib/firebase/firestore';
import { WorkoutForm } from '@/components/workouts/WorkoutForm';
import { WorkoutSchema } from '@/lib/schemas/workout';
import { Workout } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

/**
 * Workout edit page
 * 
 * Features:
 * - Pre-populated form with existing workout data
 * - Update functionality
 * - Coach-only access (own workouts)
 * - Navigation back to workout detail
 * 
 * Security:
 * - Verifies user is coach
 * - Checks ownership before allowing edits
 * - Redirects unauthorized users
 */
export default function EditWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [students, setStudents] = useState<Array<{ uid: string; displayName: string; email: string }>>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (!loading && user?.role !== 'coach') {
      toast.error('Only coaches can edit workouts');
      router.push('/dashboard');
      return;
    }

    async function loadData() {
      if (!params.id || typeof params.id !== 'string' || !user) return;
      
      setDataLoading(true);
      
      // Load workout
      const workoutData = await getWorkout(params.id);
      
      if (!workoutData) {
        toast.error('Workout not found');
        router.push('/workouts');
        return;
      }
      
      // Verify ownership
      if (workoutData.createdBy !== user.uid) {
        toast.error('You can only edit your own workouts');
        router.push('/workouts');
        return;
      }
      
      setWorkout(workoutData);
      
      // Load students
      const studentsList = await getCoachStudents(user.uid);
      setStudents(studentsList);
      
      setDataLoading(false);
    }

    if (user?.role === 'coach') {
      loadData();
    }
  }, [user, loading, router, params.id]);

  const handleSubmit = async (data: WorkoutSchema) => {
    if (!params.id || typeof params.id !== 'string') return;

    setSubmitting(true);
    try {
      await updateWorkout(params.id, data);
      toast.success('Workout updated successfully');
      router.push(`/workouts/${params.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workout');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'coach' || !workout) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href={`/workouts/${params.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Edit Workout</h1>
        <p className="text-muted-foreground mt-1">
          Update workout details
        </p>
      </div>

      <WorkoutForm
        onSubmit={handleSubmit}
        defaultValues={{
          name: workout.name,
          type: workout.type,
          description: workout.description,
          date: workout.date.toDate(),
          duration: workout.duration,
          assignedTo: workout.assignedTo,
        }}
        athletes={students}
        loading={submitting}
      />
    </div>
  );
}
