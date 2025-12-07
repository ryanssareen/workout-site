'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, deleteWorkout, toggleWorkoutCompletion } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { WorkoutList } from '@/components/workouts/WorkoutList';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

/**
 * Workouts list page
 * 
 * Features:
 * - Display all workouts for current user (role-filtered)
 * - Edit/delete controls for coaches
 * - Completion toggle for students
 * - Realtime UI updates on mutations
 * 
 * Data flow:
 * 1. Load workouts from Firestore filtered by user role
 * 2. Render WorkoutList with role-based actions
 * 3. Handle CRUD operations with optimistic UI updates
 * 4. Show success/error toasts for user feedback
 */
export default function WorkoutsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

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

  const handleEdit = (id: string) => {
    router.push(`/workouts/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workout?')) return;

    try {
      await deleteWorkout(id);
      setWorkouts(workouts.filter(w => w.id !== id));
      toast.success('Workout deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workout');
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    try {
      await toggleWorkoutCompletion(id, completed);
      setWorkouts(workouts.map(w => 
        w.id === id ? { ...w, completed } : w
      ));
      toast.success(completed ? 'Workout marked as complete' : 'Workout marked as incomplete');
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

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Workouts</h1>
          <p className="text-muted-foreground mt-1">
            {user.role === 'coach' 
              ? 'Manage workouts you\'ve created for your students'
              : 'View and track your assigned workouts'
            }
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

      <WorkoutList
        workouts={workouts}
        onEdit={user.role === 'coach' ? handleEdit : undefined}
        onDelete={user.role === 'coach' ? handleDelete : undefined}
        onToggleComplete={user.role === 'student' ? handleToggleComplete : undefined}
        isCoach={user.role === 'coach'}
      />
    </div>
  );
}
