'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { GitMerge, Plus, Activity, Calendar, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DuplicateWorkout {
  stravaActivityId: string;
  stravaName: string;
  stravaType: string;
  stravaDate: string;
  stravaDistance: number;
  stravaDuration: number;
  existingWorkouts: {
    id: string;
    name: string;
    date: string;
    completed: boolean;
    confidence?: number;
  }[];
}

interface DuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateWorkout[];
  onConfirm: (decisions: Record<string, { action: 'merge' | 'new'; workoutId?: string }>) => void;
  isLoading?: boolean;
}

export function StravaDuplicateDialog({
  open,
  onOpenChange,
  duplicates,
  onConfirm,
  isLoading = false,
}: DuplicateDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, { action: 'merge' | 'new'; workoutId?: string }>>({});

  const currentDuplicate = duplicates[currentIndex];
  const isLastDuplicate = currentIndex === duplicates.length - 1;
  const currentDecision = currentDuplicate ? decisions[currentDuplicate.stravaActivityId] : null;

  useEffect(() => {
    if (!currentDuplicate) return;
    if (decisions[currentDuplicate.stravaActivityId]) return;
    const topCandidate = currentDuplicate.existingWorkouts[0];
    if (!topCandidate) return;
    setDecisions((prev) => ({
      ...prev,
      [currentDuplicate.stravaActivityId]: { action: 'merge', workoutId: topCandidate.id },
    }));
  }, [currentDuplicate, decisions]);

  const handleMerge = (workoutId: string) => {
    if (!currentDuplicate) return;
    setDecisions(prev => ({
      ...prev,
      [currentDuplicate.stravaActivityId]: { action: 'merge', workoutId }
    }));
  };

  const handleAddNew = () => {
    if (!currentDuplicate) return;
    setDecisions(prev => ({
      ...prev,
      [currentDuplicate.stravaActivityId]: { action: 'new' }
    }));
  };

  const handleNext = () => {
    if (isLastDuplicate) {
      onConfirm(decisions);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleClose = () => {
    setCurrentIndex(0);
    setDecisions({});
    onOpenChange(false);
  };

  if (!currentDuplicate) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#FC4C02]" />
            Potential Duplicate Found
          </DialogTitle>
          <DialogDescription>
            {currentIndex + 1} of {duplicates.length} - A Strava activity matches an existing workout
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Strava Activity Info */}
          <div className="p-4 rounded-lg bg-[#FC4C02]/10 border border-[#FC4C02]/20">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-4 w-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
              </svg>
              <span className="text-sm font-medium text-[#FC4C02]">From Strava</span>
            </div>
            <h4 className="font-semibold text-lg">{currentDuplicate.stravaName}</h4>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="capitalize">{currentDuplicate.stravaType}</Badge>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(currentDuplicate.stravaDate), 'MMM d, yyyy')}
              </span>
              {currentDuplicate.stravaDistance > 0 && (
                <span>{(currentDuplicate.stravaDistance / 1000).toFixed(2)} km</span>
              )}
              {currentDuplicate.stravaDuration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {Math.round(currentDuplicate.stravaDuration / 60)} min
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Existing Workout Options */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Best candidate matches:</p>
            {currentDuplicate.existingWorkouts.map((workout) => (
              <button
                key={workout.id}
                onClick={() => handleMerge(workout.id)}
                className={cn(
                  'w-full p-4 rounded-lg border text-left transition-all',
                  currentDecision?.action === 'merge' && currentDecision.workoutId === workout.id
                    ? 'border-primary bg-primary/10 ring-2 ring-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{workout.name}</h4>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {workout.date ? format(new Date(workout.date), 'MMM d, yyyy') : 'No date'}
                      {workout.completed && (
                        <Badge variant="secondary" className="text-xs">Completed</Badge>
                      )}
                      {typeof workout.confidence === 'number' && (
                        <Badge variant="outline" className="text-xs">{workout.confidence}%</Badge>
                      )}
                    </div>
                  </div>
                  <GitMerge className={cn(
                    'h-5 w-5',
                    currentDecision?.action === 'merge' && currentDecision.workoutId === workout.id
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  )} />
                </div>
              </button>
            ))}

            {/* Add as New Option */}
            <button
              onClick={handleAddNew}
              className={cn(
                'w-full p-4 rounded-lg border text-left transition-all',
                currentDecision?.action === 'new'
                  ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500'
                  : 'border-border hover:border-green-500/50 hover:bg-muted/50'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Add as separate workout</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Keep both workouts independently
                  </p>
                </div>
                <Plus className={cn(
                  'h-5 w-5',
                  currentDecision?.action === 'new' ? 'text-green-500' : 'text-muted-foreground'
                )} />
              </div>
            </button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            {currentIndex > 0 && (
              <Button variant="outline" onClick={handleBack} disabled={isLoading}>
                Back
              </Button>
            )}
            <Button variant="outline" onClick={handleClose} disabled={isLoading} className="flex-1 sm:flex-none">
              Cancel
            </Button>
          </div>
          <Button
            onClick={handleNext}
            disabled={!currentDecision || isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Syncing...' : isLastDuplicate ? 'Finish & Sync' : 'Next'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
