'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, deleteWorkout, completeWorkout } from '@/lib/firebase/firestore';
import { Workout, WorkoutType } from '@/types';
import { WorkoutList } from '@/components/workouts/WorkoutList';
import { AIWorkoutSuggestions } from '@/components/workouts/AIWorkoutSuggestions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, ListChecks, Loader2, Waves, Footprints, Bike, Dumbbell, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const WORKOUT_CATEGORIES: { type: WorkoutType | 'all'; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'all', label: 'All', icon: <ListChecks className="h-4 w-4" />, color: 'bg-gray-500' },
  { type: 'swim', label: 'Swim', icon: <Waves className="h-4 w-4" />, color: 'bg-blue-500' },
  { type: 'run', label: 'Run', icon: <Footprints className="h-4 w-4" />, color: 'bg-green-500' },
  { type: 'bike', label: 'Bike', icon: <Bike className="h-4 w-4" />, color: 'bg-orange-500' },
  { type: 'strength', label: 'Strength', icon: <Dumbbell className="h-4 w-4" />, color: 'bg-purple-500' },
  { type: 'other', label: 'Other', icon: <MoreHorizontal className="h-4 w-4" />, color: 'bg-gray-500' },
];

export default function WorkoutsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<WorkoutType | 'all'>('all');

  const loadWorkouts = async () => {
    if (!user) return;
    const data = await getUserWorkouts(user.uid, user.role);
    setWorkouts(data);
    setLoading(false);
  };

  useEffect(() => { loadWorkouts(); }, [user]);

  // Filter workouts by selected category
  const filteredWorkouts = selectedCategory === 'all'
    ? workouts
    : workouts.filter(w => w.type === selectedCategory);

  // Get workout counts per category
  const workoutCounts = WORKOUT_CATEGORIES.reduce((acc, cat) => {
    acc[cat.type] = cat.type === 'all'
      ? workouts.length
      : workouts.filter(w => w.type === cat.type).length;
    return acc;
  }, {} as Record<string, number>);

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

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {WORKOUT_CATEGORIES.map((cat) => (
          <button
            key={cat.type}
            onClick={() => setSelectedCategory(cat.type)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
              selectedCategory === cat.type
                ? `${cat.color} text-white shadow-lg`
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            )}
          >
            {cat.icon}
            <span>{cat.label}</span>
            <span className={cn(
              'ml-1 px-1.5 py-0.5 rounded-full text-xs',
              selectedCategory === cat.type
                ? 'bg-white/20 text-white'
                : 'bg-background text-muted-foreground'
            )}>
              {workoutCounts[cat.type]}
            </span>
          </button>
        ))}
      </div>

      {/* Workout List */}
      <WorkoutList
        workouts={filteredWorkouts}
        onEdit={user?.role === 'coach' ? handleEdit : undefined}
        onDelete={user?.role === 'coach' ? handleDelete : undefined}
        onToggleComplete={handleToggleComplete}
        onViewDetails={handleViewDetails}
        isCoach={user?.role === 'coach'}
        emptyMessage={selectedCategory === 'all'
          ? 'No workouts found'
          : `No ${selectedCategory} workouts found`
        }
      />

      {/* AI Suggestions */}
      {user && <AIWorkoutSuggestions userId={user.uid} recentWorkouts={workouts} />}
    </div>
  );
}
