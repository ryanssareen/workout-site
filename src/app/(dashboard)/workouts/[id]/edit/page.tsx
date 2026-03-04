'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getWorkout, updateWorkout, getCoachStudents } from '@/lib/firebase/firestore';
import { WorkoutForm } from '@/components/workouts/WorkoutForm';
import { WorkoutSchema } from '@/lib/schemas/workout';
import { Workout } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

// Ensure type-specific data from Firestore has valid enum values for Zod.
// Also creates a minimal valid object if the workout type matches but no sub-object exists.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureTypeData(workout: any): Record<string, any> {
  const type = workout.type as string;
  const result: Record<string, any> = {};

  if (type === 'run') {
    const raw = workout.run || {};
    result.run = {
      distance: raw.distance ?? 0,
      distanceUnit: ['km', 'miles'].includes(raw.distanceUnit) ? raw.distanceUnit : 'km',
      time: raw.time ?? 0,
      ...(raw.pace ? { pace: raw.pace } : {}),
      ...(raw.elevationGain ? { elevationGain: raw.elevationGain } : {}),
      ...(raw.avgHeartRate ? { avgHeartRate: raw.avgHeartRate } : {}),
      ...(['road', 'trail', 'track', 'treadmill'].includes(raw.terrain) ? { terrain: raw.terrain } : {}),
    };
  } else if (type === 'bike') {
    const raw = workout.bike || {};
    result.bike = {
      distance: raw.distance ?? 0,
      distanceUnit: ['km', 'miles'].includes(raw.distanceUnit) ? raw.distanceUnit : 'km',
      time: raw.time ?? 0,
      ...(raw.avgPower ? { avgPower: raw.avgPower } : {}),
      ...(raw.avgCadence ? { avgCadence: raw.avgCadence } : {}),
      ...(raw.elevationGain ? { elevationGain: raw.elevationGain } : {}),
    };
  } else if (type === 'swim') {
    const raw = workout.swim || {};
    result.swim = {
      distance: raw.distance ?? 0,
      distanceUnit: ['meters', 'yards'].includes(raw.distanceUnit) ? raw.distanceUnit : 'meters',
      time: raw.time ?? 0,
      ...(raw.strokes ? { strokes: raw.strokes } : {}),
      ...(['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'mixed'].includes(raw.strokeType)
        ? { strokeType: raw.strokeType } : {}),
      ...(raw.poolLength ? { poolLength: raw.poolLength } : {}),
    };
  } else if (type === 'strength' && workout.strength) {
    result.strength = workout.strength;
  } else if (type === 'other' && workout.other) {
    result.other = workout.other;
  }

  return result;
}

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
  const searchParams = useSearchParams();
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
      const ownerUsername = searchParams.get('owner') || user!.username;
      const workoutData = await getWorkout(ownerUsername, params.id);

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
      const studentsList = await getCoachStudents(user.username);
      setStudents(studentsList);
      
      setDataLoading(false);
    }

    if (user?.role === 'coach') {
      loadData();
    }
  }, [user, loading, router, params.id, searchParams]);

  const handleSubmit = async (data: WorkoutSchema) => {
    if (!params.id || typeof params.id !== 'string') return;

    setSubmitting(true);
    try {
      const ownerUsername = workout?.ownerUsername || searchParams.get('owner') || user!.username;
      await updateWorkout(ownerUsername, params.id, data);
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
        <h1 className="text-2xl sm:text-3xl font-bold">Edit Workout</h1>
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
          tags: (workout as any).tags,
          // Build valid type-specific data (creates defaults if missing from Firestore)
          ...ensureTypeData(workout),
        }}
        athletes={students}
        loading={submitting}
        isEditing
      />
    </div>
  );
}
