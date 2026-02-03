'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, deleteWorkout, completeWorkout } from '@/lib/firebase/firestore';
import { Workout, WorkoutType } from '@/types';
import { WorkoutList } from '@/components/workouts/WorkoutList';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { Plus, ListChecks, Loader2, Waves, Footprints, Bike, Dumbbell, MoreHorizontal, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const WORKOUT_CATEGORIES: { type: WorkoutType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
  { type: 'swim', label: 'Swim', icon: <Waves className="h-6 w-6" />, color: 'bg-blue-500', bgColor: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20' },
  { type: 'run', label: 'Run', icon: <Footprints className="h-6 w-6" />, color: 'bg-green-500', bgColor: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20' },
  { type: 'bike', label: 'Bike', icon: <Bike className="h-6 w-6" />, color: 'bg-orange-500', bgColor: 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20' },
  { type: 'strength', label: 'Strength', icon: <Dumbbell className="h-6 w-6" />, color: 'bg-purple-500', bgColor: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20' },
  { type: 'other', label: 'Other', icon: <MoreHorizontal className="h-6 w-6" />, color: 'bg-gray-500', bgColor: 'bg-gray-500/10 hover:bg-gray-500/20 border-gray-500/20' },
];

function WorkoutsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  // Get category from URL params
  const selectedCategory = searchParams.get('category') as WorkoutType | null;

  const loadWorkouts = useCallback(async () => {
    if (!user) return;
    const data = await getUserWorkouts(user.uid, user.role);
    setWorkouts(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadWorkouts(); }, [loadWorkouts]);

  // Filter workouts by selected category
  const filteredWorkouts = selectedCategory
    ? workouts.filter(w => w.type === selectedCategory)
    : [];

  // Get workout counts per category
  const workoutCounts = WORKOUT_CATEGORIES.reduce((acc, cat) => {
    acc[cat.type] = workouts.filter(w => w.type === cat.type).length;
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

  const canManageWorkouts = user?.role === 'coach' || ((user?.role === 'athlete' || user?.role === 'student') && !user?.coachId);

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

  // If a category is selected, show the workout list for that category
  if (selectedCategory) {
    const categoryConfig = WORKOUT_CATEGORIES.find(c => c.type === selectedCategory);

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/workouts')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className={cn('p-2.5 rounded-xl', categoryConfig?.color)}>
              {categoryConfig?.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{categoryConfig?.label} Workouts</h1>
              <p className="text-sm text-muted-foreground">
                {filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {canManageWorkouts && (
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
          workouts={filteredWorkouts}
          onEdit={canManageWorkouts ? handleEdit : undefined}
          onDelete={canManageWorkouts ? handleDelete : undefined}
          onToggleComplete={handleToggleComplete}
          onViewDetails={handleViewDetails}
          isCoach={user?.role === 'coach'}
          emptyMessage={`No ${selectedCategory} workouts found`}
        />
      </div>
    );
  }

  // Main page: show category cards
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
              {user?.role === 'coach' ? 'My Workouts' : 'Workouts'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.role === 'coach' ? 'Manage workouts you\'ve created' : 'Select a category to view workouts'}
            </p>
          </div>
        </div>
        {canManageWorkouts && (
          <Button asChild className="shadow-lg shadow-primary/20">
            <Link href="/workouts/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Workout
            </Link>
          </Button>
        )}
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {WORKOUT_CATEGORIES.map((cat) => (
          <Card
            key={cat.type}
            className={cn(
              'p-4 cursor-pointer transition-all border-2',
              cat.bgColor
            )}
            onClick={() => router.push(`/workouts?category=${cat.type}`)}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className={cn('p-3 rounded-xl text-white', cat.color)}>
                {cat.icon}
              </div>
              <div>
                <h3 className="font-semibold">{cat.label}</h3>
                <p className="text-sm text-muted-foreground">
                  {workoutCounts[cat.type]} workout{workoutCounts[cat.type] !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function WorkoutsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading workouts...</p>
        </div>
      </div>
    }>
      <WorkoutsContent />
    </Suspense>
  );
}
