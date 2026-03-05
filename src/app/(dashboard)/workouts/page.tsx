'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, deleteWorkout, completeWorkout } from '@/lib/firebase/firestore';
import { Workout, WorkoutType } from '@/types';
import { AIWorkoutSuggestions } from '@/components/workouts/AIWorkoutSuggestions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Plus, ListChecks, Loader2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TYPE_CONFIG, getTypeData } from '@/components/calendar/types';
import { format, isPast, isToday } from 'date-fns';

const FILTER_OPTIONS: { value: WorkoutType | 'all'; label: string; emoji?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'run', label: 'Run', emoji: '🏃' },
  { value: 'bike', label: 'Bike', emoji: '🚴' },
  { value: 'swim', label: 'Swim', emoji: '🏊' },
  { value: 'strength', label: 'Strength', emoji: '💪' },
  { value: 'other', label: 'Other', emoji: '📋' },
];

function WorkoutRow({ workout }: { workout: Workout }) {
  const cfg = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
  const stats = getTypeData(workout);
  const workoutDate = workout.date?.toDate?.() ?? new Date(workout.date as any);
  const dateStr = format(workoutDate, 'MMM d');
  const past = isPast(workoutDate) && !isToday(workoutDate);
  const isMissed = past && !workout.completed && workout.source !== 'strava';
  const isLate = workout.completedLate === true;

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className={cn(
        'flex items-center gap-3 p-3.5 rounded-xl border bg-card transition-all hover:shadow-sm hover:border-primary/20',
        isMissed && 'opacity-50',
      )}
    >
      <span className="text-lg shrink-0">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-sm font-semibold truncate',
            isMissed && 'line-through text-muted-foreground',
          )}>{workout.name}</span>
          <Badge variant="secondary" className={cn('text-[10px] capitalize shrink-0', cfg.color)}>
            {workout.type}
          </Badge>
          {isLate && (
            <Badge variant="secondary" className="text-[10px] shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Late
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <span>{dateStr}</span>
          {stats.primary !== '--' && (
            <>
              <span className="opacity-40">·</span>
              <span>{stats.primary}</span>
            </>
          )}
          {stats.time && stats.time !== '0:00' && (
            <>
              <span className="opacity-40">·</span>
              <span>{stats.time}</span>
            </>
          )}
          {workout.assignedToName && (
            <>
              <span className="opacity-40">·</span>
              <span className="truncate">For {workout.assignedToName}</span>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {workout.completed ? (
          <CheckCircle2 className={cn('h-4.5 w-4.5', isLate ? 'text-amber-500' : 'text-green-500')} />
        ) : isMissed ? (
          <AlertCircle className="h-4.5 w-4.5 text-red-500" />
        ) : (
          <Circle className="h-4.5 w-4.5 text-muted-foreground/30" />
        )}
      </div>
    </Link>
  );
}

function WorkoutsContent() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [activeFilter, setActiveFilter] = useState<WorkoutType | 'all'>('all');

  const loadWorkouts = useCallback(async () => {
    if (!user) return;
    const data = await getUserWorkouts(user.username, user.role);
    // Filter out future workouts — those only show in calendar
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    setWorkouts(data.filter(w => {
      try {
        const d = w.date?.toDate?.() ?? new Date(w.date as any);
        return d <= now;
      } catch {
        return true; // Show workouts with invalid dates rather than hiding them
      }
    }));
    setLoading(false);
    setTimeout(() => setReady(true), 120);
  }, [user]);

  useEffect(() => { loadWorkouts(); }, [loadWorkouts]);

  // Filtered workouts
  const filteredWorkouts = activeFilter === 'all'
    ? workouts
    : workouts.filter(w => w.type === activeFilter);

  // Sorted by date descending
  const sortedWorkouts = [...filteredWorkouts].sort(
    (a, b) => {
      const da = a.date?.toDate?.() ?? new Date(a.date as any);
      const db = b.date?.toDate?.() ?? new Date(b.date as any);
      return db.getTime() - da.getTime();
    }
  );

  // Counts per type
  const workoutCounts: Record<string, number> = { all: workouts.length };
  for (const cat of FILTER_OPTIONS) {
    if (cat.value !== 'all') {
      workoutCounts[cat.value] = workouts.filter(w => w.type === cat.value).length;
    }
  }

  const canManageWorkouts = user?.role === 'coach' || ((user?.role === 'athlete' || user?.role === 'student') && !user?.coachUsername);

  if (loading || !ready) {
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
              {user?.role === 'coach' ? 'My Workouts' : 'Workouts'}
            </h1>
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

      {/* Filter Tags */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActiveFilter(opt.value)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border shrink-0',
              activeFilter === opt.value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {opt.emoji && <span className="text-xs">{opt.emoji}</span>}
            {opt.label}
            <span className={cn(
              'text-xs tabular-nums ml-0.5',
              activeFilter === opt.value ? 'text-primary-foreground/70' : 'text-muted-foreground/50',
            )}>
              {workoutCounts[opt.value] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Workout List */}
      <div className="space-y-2">
        {sortedWorkouts.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-muted-foreground">
              {activeFilter === 'all' ? 'No workouts yet' : `No ${activeFilter} workouts found`}
            </p>
            {canManageWorkouts && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/workouts/new">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create your first workout
                </Link>
              </Button>
            )}
          </div>
        ) : (
          sortedWorkouts.map((workout) => (
            <WorkoutRow key={workout.id} workout={workout} />
          ))
        )}
      </div>

      {/* AI Workout Suggestions - coaches and self-training athletes (no coach) */}
      {user && (user.role === 'coach' || !user.coachUsername) && (
        <AIWorkoutSuggestions
          userId={user.uid}
          recentWorkouts={workouts}
          athleteProfile={{
            sportPreferences: user.sportPreferences,
            fitnessGoals: user.fitnessGoals,
            trainingFor: user.trainingFor,
            experienceLevel: user.experienceLevel,
            ageRange: user.ageRange,
            eventDate: user.eventDate,
            weeklyAvailability: user.weeklyAvailability,
            bio: user.bio,
            timezone: user.timezone,
          }}
        />
      )}
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
