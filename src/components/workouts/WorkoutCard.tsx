'use client';

import { useState } from 'react';
import { Workout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Calendar, Clock, Edit, Trash2, CheckCircle2, Circle, Activity, MessageSquare } from 'lucide-react';
import { CompletionDialog, UncompletionDialog } from './CompletionDialog';
import { cn } from '@/lib/utils';

interface WorkoutCardProps {
  workout: Workout;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleComplete?: (id: string, completed: boolean, notes?: string) => void;
  onViewDetails?: (id: string) => void;
  commentCount?: number;
}

export function WorkoutCard({
  workout,
  onEdit,
  onDelete,
  onToggleComplete,
  onViewDetails,
  commentCount = 0,
}: WorkoutCardProps) {
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showUncompletionDialog, setShowUncompletionDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hasActions = onEdit || onDelete || onToggleComplete;
  const isPastWorkout = workout.date.toDate() < new Date();
  const isUpcoming = !isPastWorkout && !workout.completed;
  const isMissed = isPastWorkout && !workout.completed;
  const isCompletedLate = workout.completed && workout.completedLate;
  
  // Debug logging
  if (workout.completed) {
    console.log('🎨 WorkoutCard color check:', {
      name: workout.name,
      completed: workout.completed,
      completedLate: workout.completedLate,
      isCompletedLate,
      isPastWorkout
    });
  }

  const handleCompletionClick = () => {
    if (workout.completed) {
      setShowUncompletionDialog(true);
    } else {
      setShowCompletionDialog(true);
    }
  };

  const handleComplete = async (notes?: string) => {
    if (!onToggleComplete) return;
    setIsLoading(true);
    try {
      await onToggleComplete(workout.id, true, notes);
      setShowCompletionDialog(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUncomplete = async () => {
    if (!onToggleComplete) return;
    setIsLoading(true);
    try {
      await onToggleComplete(workout.id, false);
      setShowUncompletionDialog(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'swim': return 'default';
      case 'run': return 'secondary';
      case 'bike': return 'outline';
      case 'strength': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <>
      <Card
        className={cn(
          'relative transition-all duration-200',
          workout.completed && !isCompletedLate && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
          isCompletedLate && 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900',
          isUpcoming && 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900',
          isMissed && 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
        )}
      >
        {/* Completion indicator overlay */}
        {workout.completed && (
          <div className="absolute top-3 right-3">
            <CheckCircle2 className={cn(
              'h-6 w-6',
              isCompletedLate ? 'text-orange-500' : 'text-green-500'
            )} />
          </div>
        )}

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between pr-8">
            <CardTitle className={cn(
              'text-lg',
              workout.completed && !isCompletedLate && 'text-green-700 dark:text-green-400',
              isCompletedLate && 'text-orange-700 dark:text-orange-400'
            )}>
              {workout.name}
            </CardTitle>
            <Badge
              variant={getTypeBadgeVariant(workout.type)}
              className="capitalize"
            >
              {workout.type}
            </Badge>
          </div>
          <CardDescription className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(workout.date.toDate(), 'MMM d, yyyy')}
            </span>
            {workout.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {workout.duration} min
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className={cn(
            'text-sm text-muted-foreground line-clamp-3',
            workout.completed && 'line-through opacity-70'
          )}>
            {workout.description}
          </p>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {workout.completed && !isCompletedLate && (
              <Badge className="bg-green-500 hover:bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            )}
            {isCompletedLate && (
              <Badge className="bg-orange-500 hover:bg-orange-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed Late
              </Badge>
            )}
            {isUpcoming && (
              <Badge variant="outline" className="border-blue-500 text-blue-600">
                <Clock className="h-3 w-3 mr-1" />
                Upcoming
              </Badge>
            )}
            {workout.completedBy === 'strava' && (
              <Badge variant="outline" className="border-orange-500 text-orange-600">
                <Activity className="h-3 w-3 mr-1" />
                via Strava
              </Badge>
            )}
            {workout.completedBy === 'manual' && workout.completed && !isCompletedLate && (
              <Badge variant="outline">Manual</Badge>
            )}
            {isMissed && (
              <Badge variant="destructive">
                Missed
              </Badge>
            )}
            {commentCount > 0 && (
              <Badge variant="secondary">
                <MessageSquare className="h-3 w-3 mr-1" />
                {commentCount}
              </Badge>
            )}
          </div>

          {/* Strava stats if available */}
          {workout.actualStats && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 space-y-1">
              <div className="flex gap-4 flex-wrap">
                {workout.actualStats.distance && (
                  <span>Distance: {(workout.actualStats.distance / 1000).toFixed(2)} km</span>
                )}
                {workout.actualStats.duration && (
                  <span>Time: {Math.round(workout.actualStats.duration / 60)} min</span>
                )}
                {workout.actualStats.calories && (
                  <span>Calories: {workout.actualStats.calories}</span>
                )}
              </div>
            </div>
          )}

          {/* Completion notes */}
          {workout.completionNotes && (
            <div className="text-sm bg-muted/50 rounded-md p-2 italic">
              &quot;{workout.completionNotes}&quot;
            </div>
          )}

          {/* Actions */}
          {hasActions && (
            <div className="flex items-center gap-2 pt-2">
              {onToggleComplete && (
                <Button
                  variant={workout.completed ? 'outline' : 'default'}
                  size="sm"
                  onClick={handleCompletionClick}
                  className={cn(
                    'flex-1',
                    !workout.completed && 'bg-green-600 hover:bg-green-700'
                  )}
                >
                  {workout.completed ? (
                    <>
                      <Circle className="h-4 w-4 mr-1" />
                      Mark Incomplete
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Mark Complete
                    </>
                  )}
                </Button>
              )}
              {onViewDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails(workout.id)}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(workout.id)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(workout.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion dialogs */}
      <CompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        workoutName={workout.name}
        onConfirm={handleComplete}
        isLoading={isLoading}
      />
      <UncompletionDialog
        open={showUncompletionDialog}
        onOpenChange={setShowUncompletionDialog}
        workoutName={workout.name}
        onConfirm={handleUncomplete}
        isLoading={isLoading}
      />
    </>
  );
}
