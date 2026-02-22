'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Workout } from '@/types';
import { WorkoutTag, getWorkoutSummary } from '@/types/workout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Calendar, Clock, Edit, Trash2, CheckCircle2, Circle, Activity, MessageSquare, MapPin } from 'lucide-react';
import { CompletionDialog, UncompletionDialog } from './CompletionDialog';
import { MiniRoutePreview } from './MiniRoutePreview';
import { cn } from '@/lib/utils';

const TAG_COLORS: Record<WorkoutTag, string> = {
  easy: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  moderate: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  hard: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  recovery: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  speed: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  endurance: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  intervals: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  tempo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  long: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  strength: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  technique: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  race: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

interface WorkoutCardProps {
  workout: Workout;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleComplete?: (id: string, completed: boolean, notes?: string) => void;
  onViewDetails?: (id: string) => void;
  commentCount?: number;
  isCoach?: boolean;
}

export function WorkoutCard({ workout, onEdit, onDelete, onToggleComplete, onViewDetails, commentCount = 0, isCoach = false }: WorkoutCardProps) {
  const router = useRouter();
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showUncompletionDialog, setShowUncompletionDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hasActions = onEdit || onDelete || onToggleComplete;
  const isPastWorkout = workout.date.toDate() < new Date();
  const isUpcoming = !isPastWorkout && !workout.completed;
  const isMissed = isPastWorkout && !workout.completed;
  const isCompletedLate = workout.completed && workout.completedLate;
  const tags = (workout as any).tags as WorkoutTag[] | undefined;
  const plannedSummary = getWorkoutSummary(workout);
  const hasRoute = !!(workout.routeData?.polyline);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking a button or interactive element
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) return;
    router.push(`/workouts/${workout.id}`);
  };

  const handleCompletionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCoach) { alert('Workout is to be completed by the Student'); return; }
    const workoutDate = workout.date.toDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    workoutDate.setHours(0, 0, 0, 0);
    if (!workout.completed && workoutDate > today) {
      alert(`This workout is scheduled for ${format(workout.date.toDate(), 'MMM d, yyyy')}. You can only complete it on or after that date.`);
      return;
    }
    workout.completed ? setShowUncompletionDialog(true) : setShowCompletionDialog(true);
  };

  const handleComplete = async (notes?: string) => {
    if (!onToggleComplete) return;
    setIsLoading(true);
    try { await onToggleComplete(workout.id, true, notes); setShowCompletionDialog(false); } 
    finally { setIsLoading(false); }
  };

  const handleUncomplete = async () => {
    if (!onToggleComplete) return;
    setIsLoading(true);
    try { await onToggleComplete(workout.id, false); setShowUncompletionDialog(false); } 
    finally { setIsLoading(false); }
  };

  const plannedStats = (() => {
    const parts: string[] = [];
    if (workout.run) {
      parts.push(`${workout.run.distance}${workout.run.distanceUnit}`);
      if (workout.run.time) parts.push(`${workout.run.time} min`);
    } else if (workout.bike) {
      parts.push(`${workout.bike.distance}${workout.bike.distanceUnit}`);
      if (workout.bike.time) parts.push(`${workout.bike.time} min`);
    } else if (workout.swim) {
      parts.push(`${workout.swim.distance}${workout.swim.distanceUnit}`);
      if (workout.swim.time) parts.push(`${workout.swim.time} min`);
    } else if (workout.strength) {
      const exercises = workout.strength.exercises?.length || 0;
      parts.push(`${exercises} exercises`);
      if (workout.strength.totalTime) parts.push(`${workout.strength.totalTime} min`);
    }
    if (parts.length === 0 && workout.duration) {
      parts.push(`${workout.duration} min`);
    }
    return parts.join(' • ');
  })();

  const getCardStyle = () => {
    if (workout.completed && !isCompletedLate) return 'border-l-4 border-l-green-500 bg-green-500/5';
    if (isCompletedLate) return 'border-l-4 border-l-orange-500 bg-orange-500/5';
    if (isUpcoming) return 'border-l-4 border-l-blue-500 bg-blue-500/5';
    if (isMissed) return 'border-l-4 border-l-red-500 bg-red-500/5';
    return '';
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      swim: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      run: 'bg-green-500/10 text-green-600 dark:text-green-400',
      bike: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      strength: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    };
    return styles[type] || 'bg-muted text-muted-foreground';
  };

  return (
    <>
      <Card
        className={cn(
          'relative transition-all hover:shadow-md dark:hover:shadow-none dark:hover:border-white/20 cursor-pointer',
          getCardStyle()
        )}
        onClick={handleCardClick}
      >
        {workout.completed && (
          <div className="absolute top-4 right-4">
            <CheckCircle2 className={cn('h-5 w-5', isCompletedLate ? 'text-orange-500' : 'text-green-500')} />
          </div>
        )}

        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3 pr-6">
            <div className="space-y-1">
              <h3 className={cn('font-semibold', workout.completed && 'text-muted-foreground')}>{workout.name}</h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(workout.date.toDate(), 'MMM d')}</span>
                {workout.duration && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{workout.duration}min</span>}
              </div>
              {workout.assignedToName && (
                <p className="text-xs text-muted-foreground">For <span className="font-medium text-foreground/80">{workout.assignedToName}</span></p>
              )}
            </div>
            <Badge variant="secondary" className={cn('capitalize text-xs', getTypeBadge(workout.type))}>{workout.type}</Badge>
          </div>

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.map((tag) => <span key={tag} className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize border', TAG_COLORS[tag])}>{tag}</span>)}
            </div>
          )}

          <p className={cn('text-sm text-muted-foreground line-clamp-3 mb-3', workout.completed && 'line-through opacity-60')}>
            {workout.description || 'No description provided.'}
          </p>

          {(plannedSummary || plannedStats) && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5 mb-3 flex flex-col gap-1">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5" />
                Planned
              </div>
              {plannedSummary && <div>{plannedSummary}</div>}
              {plannedStats && plannedStats !== plannedSummary && (
                <div className="text-[11px]">{plannedStats}</div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mb-3">
            {workout.completed && !isCompletedLate && <Badge className="bg-green-500 hover:bg-green-600 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>}
            {isCompletedLate && <Badge className="bg-orange-500 hover:bg-orange-600 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Late</Badge>}
            {isUpcoming && <Badge variant="outline" className="border-blue-500/50 text-blue-600 dark:text-blue-400 text-xs"><Clock className="h-3 w-3 mr-1" />Upcoming</Badge>}
            {isMissed && <Badge variant="destructive" className="text-xs">Missed</Badge>}
            {workout.completedBy === 'strava' && <Badge variant="outline" className="border-orange-500/50 text-orange-600 dark:text-orange-400 text-xs"><Activity className="h-3 w-3 mr-1" />Strava</Badge>}
            {hasRoute && <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400 text-xs"><MapPin className="h-3 w-3 mr-1" />Route</Badge>}
            {commentCount > 0 && <Badge variant="secondary" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />{commentCount}</Badge>}
          </div>

          {workout.actualStats && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5 mb-3">
              <div className="flex gap-3 flex-wrap">
                {workout.actualStats.distance && <span>📏 {(workout.actualStats.distance / 1000).toFixed(2)} km</span>}
                {workout.actualStats.duration && <span>⏱️ {Math.round(workout.actualStats.duration / 60)} min</span>}
                {workout.actualStats.calories && <span>🔥 {workout.actualStats.calories} cal</span>}
              </div>
            </div>
          )}

          {/* Mini route preview */}
          {hasRoute && (
            <MiniRoutePreview
              polyline={workout.routeData!.polyline!}
              className="mb-3"
              width={280}
              height={70}
            />
          )}

          {workout.completionNotes && <div className="text-sm bg-muted/50 rounded-lg p-2.5 italic text-muted-foreground mb-3">&quot;{workout.completionNotes}&quot;</div>}

          {hasActions && (
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              {onToggleComplete && (
                <Button variant={workout.completed ? 'outline' : 'default'} size="sm" onClick={handleCompletionClick} className={cn('flex-1 h-9', !workout.completed && 'bg-green-600 hover:bg-green-700')}>
                  {workout.completed ? <><Circle className="h-4 w-4 mr-1.5" />Undo</> : <><CheckCircle2 className="h-4 w-4 mr-1.5" />Complete</>}
                </Button>
              )}
              {onEdit && <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(workout.id); }} className="h-9 w-9 p-0"><Edit className="h-4 w-4" /></Button>}
              {onDelete && <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(workout.id); }} className="h-9 w-9 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>}
            </div>
          )}
        </CardContent>
      </Card>

      <CompletionDialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog} workoutName={workout.name} onConfirm={handleComplete} isLoading={isLoading} />
      <UncompletionDialog open={showUncompletionDialog} onOpenChange={setShowUncompletionDialog} workoutName={workout.name} onConfirm={handleUncomplete} isLoading={isLoading} />
    </>
  );
}
