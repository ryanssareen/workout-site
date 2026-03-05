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
import { Plus, ListChecks, Loader2, CheckCircle2, Circle, AlertCircle, Heart, Mountain, Flame, Gauge, Zap, Calendar, History, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TYPE_CONFIG, getTypeData, formatDur } from '@/components/calendar/types';
import { format, isPast, isToday, isFuture, startOfDay } from 'date-fns';

type TimeFilter = 'all' | 'planned' | 'past';

const FILTER_OPTIONS: { value: WorkoutType | 'all'; label: string; emoji?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'run', label: 'Run', emoji: '🏃' },
  { value: 'bike', label: 'Bike', emoji: '🚴' },
  { value: 'swim', label: 'Swim', emoji: '🏊' },
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

  // Strength extras
  if (workout.type === 'strength' && workout.strength?.exercises?.length) {
    const totalSets = workout.strength.exercises.reduce((s, e) => s + (e.sets || 0), 0);
    if (totalSets > 0) chips.push({ icon: <span className="text-[10px]">🏋️</span>, value: `${totalSets}`, label: 'sets' });
    chips.push({ icon: <span className="text-[10px]">💪</span>, value: `${workout.strength.exercises.length}`, label: 'exercises' });
  }

  return chips;
}

function WorkoutRow({ workout }: { workout: Workout }) {
  const cfg = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
  const stats = getTypeData(workout);
  const workoutDate = workout.date?.toDate?.() ?? new Date(workout.date as any);
  const dateStr = format(workoutDate, 'MMM d');
  const past = isPast(workoutDate) && !isToday(workoutDate);
  const isMissed = past && !workout.completed && workout.source !== 'strava';
  const isLate = workout.completedLate === true;
  const extraStats = getExtraStats(workout);

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
              <span className="font-medium text-foreground/70">{stats.primary}</span>
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
      {/* Garmin-style extra stat chips — right side */}
      {extraStats.length > 0 && (
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {extraStats.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5"
            >
              {chip.icon}
              <span className="font-semibold text-foreground/60">{chip.value}</span>
              {chip.label && <span className="text-muted-foreground/60">{chip.label}</span>}
            </span>
          ))}
        </div>
      )}
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

  const loadWorkouts = useCallback(async () => {
    if (!user) return;
    const data = await getUserWorkouts(user.username, user.role);
    setWorkouts(data);
    setLoading(false);
    setTimeout(() => setReady(true), 120);
  }, [user]);

  useEffect(() => { loadWorkouts(); }, [loadWorkouts]);

  // Helper: get workout date
  const getDate = (w: Workout) => {
    try { return w.date?.toDate?.() ?? new Date(w.date as any); }
    catch { return new Date(); }
  };

  // Time filter
  const today = startOfDay(new Date());
  const timeFiltered = workouts.filter(w => {
    if (timeFilter === 'all') return true;
    const d = getDate(w);
    if (timeFilter === 'planned') return d >= today && !w.completed;
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
    all: workouts.length,
    planned: workouts.filter(w => getDate(w) >= today && !w.completed).length,
    past: workouts.filter(w => getDate(w) < today || w.completed).length,
  };

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

      {/* Time Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border w-fit">
        {([
          { value: 'planned' as TimeFilter, label: 'Planned', icon: <CalendarClock className="h-3.5 w-3.5" /> },
          { value: 'past' as TimeFilter, label: 'Past', icon: <History className="h-3.5 w-3.5" /> },
          { value: 'all' as TimeFilter, label: 'All', icon: <Calendar className="h-3.5 w-3.5" /> },
        ]).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setTimeFilter(tab.value)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all',
              timeFilter === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
            <span className={cn(
              'text-xs tabular-nums',
              timeFilter === tab.value ? 'text-foreground/50' : 'text-muted-foreground/50',
            )}>
              {timeCounts[tab.value]}
            </span>
          </button>
        ))}
      </div>

      {/* Type Filter Tags */}
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
