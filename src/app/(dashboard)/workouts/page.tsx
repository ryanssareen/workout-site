'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, deleteWorkout, completeWorkout } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { WorkoutList } from '@/components/workouts/WorkoutList';
import { AIWorkoutSuggestions } from '@/components/workouts/AIWorkoutSuggestions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, ListChecks, Loader2 } from 'lucide-react';
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

  useEffect(() => { loadWorkouts(); }, [user]);

  const handleEdit = (id: string) => router.push(`/workouts/${id}/edit`);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workout?')) return;
    try {
      await deleteWorkout(id);
      toast.success('Workout deleted');
      await loadWorkouts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workout');
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean, notes?: string) => {
    try {
      await completeWorkout(id, completed, notes);
      toast.success(completed ? 'Workout completed!' : 'Marked incomplete');
      await loadWorkouts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workout');
    }
  };

  const handleViewDetails = (id: string) => router.push(`/workouts/${id}`);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading workouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
            <ListChecks className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {user?.role === 'coach' ? 'My Workouts' : 'Assigned Workouts'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.role === 'coach' ? 'Manage workouts you\'ve created' : 'Track your training sessions'}
            </p>
          </div>
        </div>
        {user?.role === 'coach' && (
          <Button asChild className="shadow-lg shadow-primary/20">
            <Link href="/workouts/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Workout
            </Link>
          </Button>
        )}
      </div>

      {/* Workout List */}
      <WorkoutList
        workouts={workouts}
        onEdit={user?.role === 'coach' ? handleEdit : undefined}
        onDelete={user?.role === 'coach' ? handleDelete : undefined}
        onToggleComplete={handleToggleComplete}
        onViewDetails={handleViewDetails}
        isCoach={user?.role === 'coach'}
      />

      {/* AI Suggestions */}
      {user && <AIWorkoutSuggestions userId={user.uid} recentWorkouts={workouts} />}
    </div>
  );
}
