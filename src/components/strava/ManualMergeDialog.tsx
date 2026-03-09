'use client';

import { useState } from 'react';
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
import { GitMerge, Activity, Calendar, Clock, ArrowDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Workout } from '@/types';

interface ManualMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plannedWorkout: Workout;
  candidates: Workout[];
  onMerge: (stravaWorkoutId: string) => Promise<void>;
  isLoading?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  run: 'Run',
  bike: 'Ride',
  swim: 'Swim',
  strength: 'Strength',
  other: 'Other',
};

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function getPlannedSummary(w: Workout): string {
  const parts: string[] = [];
  const dist =
    w.run?.distance ?? w.bike?.distance ?? w.swim?.distance;
  const unit =
    w.run?.distanceUnit ?? w.bike?.distanceUnit ?? w.swim?.distanceUnit;
  if (dist) parts.push(`${dist} ${unit || 'km'}`);
  if (w.duration) parts.push(formatDuration(w.duration));
  return parts.join(' \u00b7 ') || 'No details';
}

function getStravaSummary(w: Workout): { distance: string; duration: string } {
  const distM = w.actualStats?.distance;
  const durS = w.actualStats?.duration;
  return {
    distance: distM ? `${(distM / 1000).toFixed(1)} km` : '--',
    duration: durS ? formatDuration(Math.round(durS / 60)) : w.duration ? formatDuration(w.duration) : '--',
  };
}

export function ManualMergeDialog({
  open,
  onOpenChange,
  plannedWorkout,
  candidates,
  onMerge,
  isLoading = false,
}: ManualMergeDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleClose = () => {
    setSelectedId(null);
    onOpenChange(false);
  };

  const handleMerge = async () => {
    if (!selectedId) return;
    await onMerge(selectedId);
    setSelectedId(null);
  };

  const plannedDate = plannedWorkout.date?.toDate?.()
    ?? new Date(plannedWorkout.date as unknown as string);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-[#FC4C02]" />
            Link to Strava Activity
          </DialogTitle>
          <DialogDescription>
            Match this planned workout with a completed Strava activity
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          {/* Planned workout card */}
          <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 mb-1">
              Planned
            </p>
            <h4 className="font-semibold text-sm">{plannedWorkout.name}</h4>
            <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="capitalize text-[10px]">
                {TYPE_LABELS[plannedWorkout.type] || plannedWorkout.type}
              </Badge>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(plannedDate, 'MMM d, yyyy')}
              </span>
              <span>{getPlannedSummary(plannedWorkout)}</span>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Strava candidates */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Select a Strava activity to link:
            </p>

            {candidates.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed text-center">
                <p className="text-sm text-muted-foreground">
                  No matching Strava workouts found
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Looking for {TYPE_LABELS[plannedWorkout.type] || plannedWorkout.type} activities within \u00b11 day
                </p>
              </div>
            ) : (
              candidates.map((c) => {
                const cDate = c.date?.toDate?.() ?? new Date(c.date as unknown as string);
                const summary = getStravaSummary(c);
                const isSelected = selectedId === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left transition-all',
                      isSelected
                        ? 'border-[#FC4C02] bg-[#FC4C02]/10 ring-2 ring-[#FC4C02]'
                        : 'border-border hover:border-[#FC4C02]/50 hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <svg
                            className="h-3.5 w-3.5 text-[#FC4C02] shrink-0"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                          </svg>
                          <h4 className="font-medium text-sm truncate">{c.name}</h4>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(cDate, 'MMM d')}
                          </span>
                          {summary.distance !== '--' && (
                            <span>{summary.distance}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {summary.duration}
                          </span>
                        </div>
                      </div>
                      <Activity
                        className={cn(
                          'h-4 w-4 shrink-0 ml-2',
                          isSelected ? 'text-[#FC4C02]' : 'text-muted-foreground/40',
                        )}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!selectedId || isLoading}
            className="bg-[#FC4C02] hover:bg-[#FC4C02]/90 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4 mr-1.5" />
                Link Workouts
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
