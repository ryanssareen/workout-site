'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, deleteWorkout, toggleWorkoutCompletion } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { WorkoutList } from '@/components/workouts/WorkoutList';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkoutsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkouts = async () => {
    if (!user) return;
    const data = await getUserWorkouts(user.uid, user.role);
    setWorkouts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadWorkouts();
  }, [user]);

  const handleEdit = (id: string) => {
    router.push(`/workouts/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workout?')) return;
    
    try {
      await deleteWorkout(id);
      toast.success('Workout deleted successfully');
      await loadWorkouts(); // Refresh list
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workout');
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    try {
      await toggleWorkoutCompletion(id, completed);
      toast.success(completed ? 'Workout marked as complete' : 'Workout marked as incomplete');
      await loadWorkouts(); // Refresh list
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workout');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading workouts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {user?.role === 'coach' ? 'My Workouts' : 'Assigned Workouts'}
          </h1>
          <p className="text-muted-foreground">
            {user?.role === 'coach' 
              ? 'Manage all workouts you\'ve created' 
              : 'View and track your assigned training sessions'}
          </p>
        </div>
        {user?.role === 'coach' && (
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
        onEdit={user?.role === 'coach' ? handleEdit : undefined}
        onDelete={user?.role === 'coach' ? handleDelete : undefined}
        onToggleComplete={handleToggleComplete}
        isCoach={user?.role === 'coach'}
      />
    </div>
  );
}
