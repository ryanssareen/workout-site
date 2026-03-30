'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { deleteWorkout, completeWorkout } from '@/lib/firebase/firestore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { Workout, WorkoutType } from '@/types';
import { useCoachFilter } from '@/hooks/useCoachFilter';
import { AthleteSelector } from '@/components/dashboard/AthleteSelector';
import { AIWorkoutSuggestions } from '@/components/workouts/AIWorkoutSuggestions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Plus, Loader2, CheckCircle2, Circle, AlertCircle, Heart, Mountain, Flame, Gauge, Zap, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TYPE_CONFIG, getTypeData, formatDur } from '@/components/calendar/types';
import { isPast, isToday, isFuture, startOfDay, addDays } from 'date-fns';
import { formatInTimezone } from '@/lib/dateUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type TimeFilter = 'all' | 'planned' | 'past';

const FILTER_OPTIONS: { value: WorkoutType | 'all'; label: string; emoji?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'run', label: 'Run', emoji: '🏃' },
  { value: 'bike', label: 'Bike', emoji: '🚴' },
  { value: 'swim', label: 'Swim', emoji: '🏊' },
  { value: 'walk', label: 'Walk', emoji: '🚶' },
  { value: 'strength', label: 'Strength', emoji: '💪' },
  { value: 'other', label: 'Other', emoji: '📋' },
];

/** Build extra stats chips from Strava actualStats or type-specific data */
function getExtraStats(workout: Workout): { icon: React.ReactNode; value: string; label: string }[] {
  const chips: { icon: React.ReactNode; value: string; label: string }[] = [];
  const as = workout.actualStats;

  // Heart rate
  const hr = as?.avgHeartRate || workout.run?.avgHeartRate || workout.bike?.avgHeartRate || workout.stravaData?.avgHeartRate;
  if (hr) chips.push({ icon: <Heart className="h-3 w-3 text-red-400" />, value: `${Math.round(hr)}`, label: 'bpm' });

  // Elevation
  const elev = as?.elevationGain || workout.stravaData?.elevationGain || workout.run?.elevationGain || workout.bike?.elevationGain;
  if (elev && elev > 0) chips.push({ icon: <Mountain className="h-3 w-3 text-emerald-400" />, value: `${Math.round(elev)}`, label: 'm' });

  // Calories
  const cal = as?.calories;
  if (cal && cal > 0) chips.push({ icon: <Flame className="h-3 w-3 text-orange-400" />, value: `${Math.round(cal)}`, label: 'cal' });

  // Pace (runs)
  if (workout.type === 'run' && workout.run?.pace) {
    chips.push({ icon: <Gauge className="h-3 w-3 text-blue-400" />, value: workout.run.pace, label: '' });
  } else if (workout.type === 'run' && as?.distance && as?.duration && as.distance > 0 && as.duration > 0) {
    const paceMinPerKm = (as.duration / 60) / (as.distance / 1000);
    const pMin = Math.floor(paceMinPerKm);
    const pSec = Math.round((paceMinPerKm - pMin) * 60);
    chips.push({ icon: <Gauge className="h-3 w-3 text-blue-400" />, value: `${pMin}:${pSec.toString().padStart(2, '0')}`, label: '/km' });
  }

  // Power (bikes)
  const power = workout.stravaData?.avgPower || workout.bike?.avgPower;
  if (power && power > 0) chips.push({ icon: <Zap className="h-3 w-3 text-yellow-400" />, value: `${Math.round(power)}`, label: 'W' });

  // Max speed (runs & bikes)
  const maxSpeed = as?.maxSpeed;
  if (maxSpeed && maxSpeed > 0) {
    chips.push({ icon: <Gauge className="h-3 w-3 text-sky-400" />, value: `${(maxSpeed * 3.6).toFixed(1)}`, label: 'km/h' });
  }

  // Strength extras
  if (workout.type === 'strength' && workout.strength?.exercises?.length) {
    const totalSets = workout.strength.exercises.reduce((s, e) => s + (e.sets || 0), 0);
    if (totalSets > 0) chips.push({ icon: <span className="text-[10px]">🏋️</span>, value: `${totalSets}`, label: 'sets' });
    chips.push({ icon: <span className="text-[10px]">💪</span>, value: `${workout.strength.exercises.length}`, label: 'exercises' });
  }

  return chips;
}

function WorkoutRow({ workout, onDelete }: { workout: Workout; onDelete?: (workout: Workout) => void }) {
  const cfg = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
  const stats = getTypeData(workout);
  const workoutDate = workout.date?.toDate?.() ?? new Date(workout.date as any);
  const userTimezone = useAuthStore((s) => s.user?.timezone);
  const dateStr = formatInTimezone(workoutDate, 'MMM d', userTimezone);
  const past = isPast(workoutDate) && !isToday(workoutDate);
  const isNote = workout.type === 'other' && workout.name === 'Note';
  const isMissed = past && !workout.completed && workout.source !== 'strava' && !isNote;
  const isLate = workout.completedLate === true;
  const extraStats = getExtraStats(workout);
  const isPlanned = !workout.completed && (isFuture(workoutDate) || isToday(workoutDate));

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 rounded-xl border bg-card transition-all hover:shadow-sm hover:border-primary/20',
        isMissed && 'opacity-50',
      )}
    >
      {/* Type icon */}
      <span className="text-xl shrink-0 w-7 text-center">{cfg.emoji}</span>

      {/* Name + date/distance/time */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-[13px] font-semibold truncate',
            isMissed && 'line-through text-muted-foreground',
          )}>{workout.name}</span>
          {isLate && (
            <Badge variant="secondary" className="text-[9px] shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0">
              Late
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
          <span>{dateStr}</span>
          {stats.primary !== '--' && (
            <>
              <span className="opacity-30">·</span>
              <span>{stats.primary}</span>
            </>
          )}
          {stats.time && stats.time !== '0:00' && (
            <>
              <span className="opacity-30">·</span>
              <span>{stats.time}</span>
            </>
          )}
          {workout.assignedToName && (
            <>
              <span className="opacity-30">·</span>
              <span className="truncate">For {workout.assignedToName}</span>
            </>
          )}
        </div>
      </div>

      {/* Stat columns — Garmin style: uniform text, icon + value + unit */}
      {extraStats.length > 0 && (
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          {extraStats.map((chip, i) => (
            <div key={i} className="flex items-center gap-1 text-[11px]">
              <span className="shrink-0 opacity-70">{chip.icon}</span>
              <span className="font-medium text-foreground/80 tabular-nums">{chip.value}</span>
              {chip.label && <span className="text-muted-foreground/50">{chip.label}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Delete button for planned workouts — visible on hover */}
      {isPlanned && onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(workout); }}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
          title="Delete workout"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Completion status */}
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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showAI, setShowAI] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState<Workout | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { getWorkouts, invalidate: invalidateWorkouts } = useWorkoutStore();
  const isCoach = user?.role === 'coach';
  const { selectedAthlete, selectAthlete, athletes: coachAthletes } = useCoachFilter(
    isCoach ? user?.username : undefined
  );

  const loadWorkouts = useCallback(async () => {
    if (!user) return;
    const data = await getWorkouts(user.username, user.role);
    setWorkouts(data);
    setLoading(false);
    setReady(true);
  }, [user, getWorkouts]);

  useEffect(() => { loadWorkouts(); }, [loadWorkouts]);

  const handleDeleteWorkout = async () => {
    if (!workoutToDelete || !user?.username) return;
    setDeleting(true);
    try {
      await deleteWorkout(user.username, workoutToDelete.id);
      setWorkouts(prev => prev.filter(w => w.id !== workoutToDelete.id));
      invalidateWorkouts(user.username, user.role); // refresh cache for other pages
      toast.success('Workout deleted');
      setWorkoutToDelete(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workout');
    } finally {
      setDeleting(false);
    }
  };

  // Helper: get workout date
  const getDate = (w: Workout) => {
    try { return w.date?.toDate?.() ?? new Date(w.date as any); }
    catch { return new Date(); }
  };

  // Exclude calendar notes
  const nonNotes = workouts.filter(w =>
    !(w.tags?.includes('note') || (w.name === 'Note' && w.type === 'other'))
  );

  // Coach athlete filter
  const athleteFiltered = isCoach && selectedAthlete
    ? nonNotes.filter(w => w.ownerUsername === selectedAthlete || w.assignedTo === selectedAthlete)
    : nonNotes;

  // Time filter
  const today = startOfDay(new Date());
  const now = new Date();
  const recurringHorizon = addDays(today, 7);
  const nonRecurringHorizon = addDays(now, 1);
  const isAthlete = user?.role === 'athlete' || user?.role === 'student';
  const timeFiltered = athleteFiltered.filter(w => {
    if (timeFilter === 'all') return true;
    const d = getDate(w);
    if (timeFilter === 'planned') {
      if (d < today || w.completed) return false;
      // Recurring workouts only show within the next 7 days
      if ((w as any).isRecurring && d > recurringHorizon) return false;
      // Non-recurring workouts only show within 24 hours for athletes
      if (isAthlete && !(w as any).isRecurring && d > nonRecurringHorizon) return false;
      return true;
    }
    return d < today || w.completed; // past
  });

  // Type filter
  const filteredWorkouts = activeFilter === 'all'
    ? timeFiltered
    : timeFiltered.filter(w => w.type === activeFilter);

  // Sorted: planned = ascending (soonest first), past/all = descending (newest first)
  const sortedWorkouts = [...filteredWorkouts].sort((a, b) => {
    const da = getDate(a);
    const db = getDate(b);
    return timeFilter === 'planned'
      ? da.getTime() - db.getTime()
      : db.getTime() - da.getTime();
  });

  // Counts per type (based on time-filtered set)
  const workoutCounts: Record<string, number> = { all: timeFiltered.length };
  for (const cat of FILTER_OPTIONS) {
    if (cat.value !== 'all') {
      workoutCounts[cat.value] = timeFiltered.filter(w => w.type === cat.value).length;
    }
  }

  // Counts per time filter
  const timeCounts: Record<TimeFilter, number> = {
    all: athleteFiltered.length,
    planned: athleteFiltered.filter(w => {
      const d = getDate(w);
      if (d < today || w.completed) return false;
      if ((w as any).isRecurring && d > recurringHorizon) return false;
      if (isAthlete && !(w as any).isRecurring && d > nonRecurringHorizon) return false;
      return true;
    }).length,
    past: athleteFiltered.filter(w => getDate(w) < today || w.completed).length,
  };

  // Athletes can always manage their own workouts, even if they have a coach
  const canManageWorkouts = user?.role === 'coach' || user?.role === 'athlete' || user?.role === 'student';

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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            {isCoach ? 'Athlete Workouts' : 'Workouts'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCoach && (
            <AthleteSelector
              selectedAthlete={selectedAthlete}
              onSelect={selectAthlete}
              athletes={coachAthletes}
            />
          )}
        {canManageWorkouts && (
          <Button size="sm" asChild>
            <Link href="/workouts/new">
              <Plus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Create Workout</span>
            </Link>
          </Button>
        )}
        </div>
      </div>

      {/* AI Workout Suggestions — collapsed by default */}
      {user && (user.role === 'coach' || !user.coachUsername) && (
        showAI ? (
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
        ) : (
          <button
            onClick={() => setShowAI(true)}
            className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-orange-500" />
              <span className="font-medium">AI Workout Suggestions</span>
            </div>
            <span className="text-xs text-muted-foreground">Generate →</span>
          </button>
        )
      )}

      {/* Filters */}
      <div className="space-y-2">
        {/* Time Filter Tabs */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50 w-fit">
          {([
            { value: 'planned' as TimeFilter, label: 'Planned' },
            { value: 'past' as TimeFilter, label: 'Past' },
            { value: 'all' as TimeFilter, label: 'All' },
          ]).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setTimeFilter(tab.value)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-all',
                timeFilter === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              <span className={cn(
                'ml-1 tabular-nums',
                timeFilter === tab.value ? 'text-foreground/50' : 'text-muted-foreground/50',
              )}>
                {timeCounts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Type Filter Tags */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActiveFilter(opt.value)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border shrink-0',
                activeFilter === opt.value
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
              )}
            >
              {opt.emoji && <span className="text-[11px]">{opt.emoji}</span>}
              {opt.label}
              <span className={cn(
                'tabular-nums',
                activeFilter === opt.value ? 'text-background/60' : 'text-muted-foreground/50',
              )}>
                {workoutCounts[opt.value] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Workout List */}
      <div className="space-y-1.5">
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
            <WorkoutRow key={workout.id} workout={workout} onDelete={canManageWorkouts ? setWorkoutToDelete : undefined} />
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!workoutToDelete} onOpenChange={(open) => { if (!open) setWorkoutToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{workoutToDelete?.name}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkout}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
