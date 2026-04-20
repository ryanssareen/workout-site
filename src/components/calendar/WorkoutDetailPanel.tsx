'use client';

import { useState, useMemo } from 'react';
import { Workout } from '@/types';
import { TYPE_CONFIG, TYPE_LABELS, getTypeData, formatDurLong } from './types';
import { MiniRoutePreview } from '@/components/workouts/MiniRoutePreview';
import { WorkoutPhotos } from '@/components/workouts/WorkoutPhotos';
import { ManualMergeDialog } from '@/components/strava/ManualMergeDialog';
import {
  X,
  CheckCircle2,
  Circle,
  Activity,
  ExternalLink,
  Clock,
  MapPin,
  Mountain,
  Heart,
  Zap,
  Gauge,
  Trash2,
  GitMerge,
} from 'lucide-react';
import { isPast, isToday, differenceInCalendarDays } from 'date-fns';
import { formatInTimezone, safeToDate } from '@/lib/dateUtils';
import { useAuthStore } from '@/lib/stores/authStore';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WorkoutDetailPanelProps {
  workout: Workout;
  onClose: () => void;
  onToggleComplete?: (e: React.MouseEvent, workout: Workout) => void;
  onDelete?: (workout: Workout) => void;
  allWorkouts?: Workout[];
  onMergeComplete?: (deletedStravaId: string) => void;
}

export function WorkoutDetailPanel({
  workout,
  onClose,
  onToggleComplete,
  onDelete,
  allWorkouts,
  onMergeComplete,
}: WorkoutDetailPanelProps) {
  const cfg = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
  const stats = getTypeData(workout);
  const workoutDate = safeToDate(workout);
  const userTimezone = useAuthStore((s) => s.user?.timezone);
  const today = isToday(workoutDate);
  const past = isPast(workoutDate) && !today;
  const isNote = workout.type === 'other' && workout.name === 'Note';
  const isMissed = past && !workout.completed && !isNote;
  const isStrava = workout.source === 'strava' || workout.completedBy === 'strava';
  const hasRoute = !!(workout.routeData?.polyline);
  const canManualMerge = !workout.completed && workout.source !== 'strava' && !isNote;

  // Extract detailed stats for the grid
  const duration = workout.duration ? formatDurLong(workout.duration) : '--';
  const distance =
    workout.run?.distance
      ? `${workout.run.distance} ${workout.run.distanceUnit || 'km'}`
      : workout.bike?.distance
        ? `${workout.bike.distance} ${workout.bike.distanceUnit || 'km'}`
        : workout.swim?.distance
          ? `${workout.swim.distance} ${workout.swim.distanceUnit || 'm'}`
          : '--';
  const elevation =
    workout.run?.elevationGain
      ? `${workout.run.elevationGain}m`
      : workout.bike?.elevationGain
        ? `${workout.bike.elevationGain}m`
        : workout.stravaData?.elevationGain
          ? `${workout.stravaData.elevationGain}m`
          : '--';
  const avgHR =
    workout.run?.avgHeartRate
      ? `${workout.run.avgHeartRate}`
      : workout.bike?.avgHeartRate
        ? `${workout.bike.avgHeartRate}`
        : workout.stravaData?.avgHeartRate
          ? `${workout.stravaData.avgHeartRate}`
          : '--';
  const maxHR = workout.stravaData?.maxHeartRate
    ? `${workout.stravaData.maxHeartRate}`
    : '--';
  const maxSpeedMs = workout.actualStats?.maxSpeed;
  const maxSpeedKmh = maxSpeedMs && maxSpeedMs > 0 ? (maxSpeedMs * 3.6).toFixed(1) : null;

  // Manual merge state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [merging, setMerging] = useState(false);

  // Find Strava candidates for manual merge (same type, same day, standalone Strava)
  const mergeCandidates = useMemo(() => {
    if (!canManualMerge || !allWorkouts) return [];
    return allWorkouts.filter((w) => {
      if (w.source !== 'strava') return false;
      if (w.type !== workout.type) return false;
      if (!w.completed) return false;
      const wDate = w.date?.toDate?.() ?? new Date(w.date as unknown as string);
      return differenceInCalendarDays(wDate, workoutDate) === 0;
    });
  }, [canManualMerge, allWorkouts, workout.type, workoutDate]);

  const handleManualMerge = async (stravaWorkoutId: string) => {
    setMerging(true);
    try {
      const res = await fetch('/api/workouts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUsername: workout.ownerUsername,
          plannedWorkoutId: workout.id,
          stravaWorkoutId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Merge failed');
      toast.success('Linked with Strava activity!');
      setShowMergeDialog(false);
      onMergeComplete?.(stravaWorkoutId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to link workouts';
      toast.error(message);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="w-[380px] shrink-0 border-l bg-card overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b px-4 py-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {formatInTimezone(workoutDate, 'EEE, MMM d', userTimezone)} | {TYPE_LABELS[workout.type] || workout.type}
          </p>
          <h2 className="text-base font-bold truncate mt-0.5">{workout.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Source badge */}
        {isStrava && (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20">
              <Activity className="h-3.5 w-3.5" />
              STRAVA
            </span>
          </div>
        )}

        {/* Route map */}
        {hasRoute && (
          <MiniRoutePreview
            polyline={workout.routeData!.polyline!}
            width={350}
            height={180}
            strokeWidth={2.5}
            className="rounded-xl"
          />
        )}

        {/* Key stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatBlock icon={<Clock className="h-4 w-4" />} label="Duration" value={duration} />
          <StatBlock icon={<MapPin className="h-4 w-4" />} label="Distance" value={distance} />
          <StatBlock icon={<Mountain className="h-4 w-4" />} label="Elevation Gain" value={elevation} />
          <StatBlock icon={<Heart className="h-4 w-4" />} label="Avg HR" value={avgHR !== '--' ? `${avgHR} bpm` : '--'} />
          {maxHR !== '--' && (
            <StatBlock icon={<Zap className="h-4 w-4" />} label="Max HR" value={`${maxHR} bpm`} />
          )}
          {workout.bike?.avgPower && (
            <StatBlock icon={<Zap className="h-4 w-4" />} label="Avg Power" value={`${workout.bike.avgPower}W`} />
          )}
          {maxSpeedKmh && (
            <StatBlock icon={<Gauge className="h-4 w-4" />} label="Max Speed" value={`${maxSpeedKmh} km/h`} />
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          {workout.completed && (
            <span className="flex items-center gap-1.5 text-green-600 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Completed
            </span>
          )}
          {isMissed && (
            <span className="flex items-center gap-1.5 text-red-500 font-semibold">
              <Circle className="h-4 w-4" /> Missed
            </span>
          )}
          {!workout.completed && !isMissed && (
            <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
              <Circle className="h-4 w-4" /> Planned
            </span>
          )}
        </div>

        {/* Tags */}
        {workout.tags && workout.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {workout.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-xs font-medium capitalize bg-muted border"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {workout.description && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Description
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {workout.description}
            </p>
          </div>
        )}

        {/* Completion notes */}
        {workout.completionNotes && (
          <div className="bg-muted/40 rounded-lg p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Notes
            </h4>
            <p className="text-sm italic text-muted-foreground">
              &ldquo;{workout.completionNotes}&rdquo;
            </p>
          </div>
        )}

        {/* Photos */}
        {workout.photos && workout.photos.length > 0 && (
          <WorkoutPhotos photos={workout.photos} className="mt-2" />
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {onToggleComplete && workout.source !== 'strava' && !isNote && (
            <button
              onClick={(e) => onToggleComplete(e, workout)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                workout.completed
                  ? 'border hover:bg-muted'
                  : 'bg-green-600 text-white hover:bg-green-700',
              )}
            >
              {workout.completed ? (
                <>
                  <Circle className="h-4 w-4" /> Undo
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </>
              )}
            </button>
          )}
          {canManualMerge && mergeCandidates.length > 0 && (
            <button
              onClick={() => setShowMergeDialog(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#FC4C02]/10 text-[#FC4C02] border border-[#FC4C02]/20 hover:bg-[#FC4C02]/20 transition-colors"
            >
              <GitMerge className="h-4 w-4" /> Link to Strava
            </button>
          )}
          {isNote && onDelete && (
            <button
              onClick={() => onDelete(workout)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          <Link
            href={`/workouts/${workout.id}?from=calendar`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Details
          </Link>
        </div>
      </div>

      {/* Manual merge dialog */}
      <ManualMergeDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        plannedWorkout={workout}
        candidates={mergeCandidates}
        onMerge={handleManualMerge}
        isLoading={merging}
      />
    </div>
  );
}

function StatBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/30 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}
