'use client';

import { Workout } from '@/types';
import { TYPE_CONFIG, TYPE_LABELS, getTypeData, formatDur } from './types';
import { CheckCircle2, Circle, Activity } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CalendarWorkoutCardProps {
  workout: Workout;
  /** true = mobile compact list card, false = month grid mini-pill */
  compact?: boolean;
  onToggleComplete?: (e: React.MouseEvent, workout: Workout) => void;
  /** Called when the pill is clicked in month view */
  onSelect?: (workoutId: string) => void;
}

/**
 * Month grid mini-pill: small colored pill with emoji + name + key stat.
 * Used inside CalendarMonthView cells.
 */
function MiniPill({ workout, onSelect }: { workout: Workout; onSelect?: (id: string) => void }) {
  const cfg = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
  const stats = getTypeData(workout);
  const workoutDate = workout.date.toDate();
  const timeStr = format(workoutDate, 'h:mma').toLowerCase();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(workout.id);
      }}
      className={cn(
        'w-full text-left rounded-md border-l-[3px] px-2 py-1 transition-all',
        'hover:bg-muted/60 cursor-pointer',
        'bg-card/80',
        cfg.border,
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs shrink-0">{cfg.emoji}</span>
        <span className="text-[11px] font-semibold truncate flex-1">{workout.name}</span>
        {workout.completed && (
          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
        )}
        {workout.source === 'strava' && !workout.completed && (
          <Activity className="h-3 w-3 text-orange-500 shrink-0" />
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
        <span>{timeStr}</span>
        {stats.primary !== '--' && (
          <>
            <span className="opacity-40">·</span>
            <span className="truncate">{stats.primary}</span>
          </>
        )}
      </div>
    </button>
  );
}

/**
 * Compact card: for mobile day workout list.
 * Shows emoji + name + badges + stats in a tappable card.
 */
function CompactCard({
  workout,
  onToggleComplete,
}: {
  workout: Workout;
  onToggleComplete?: (e: React.MouseEvent, workout: Workout) => void;
}) {
  const cfg = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
  const stats = getTypeData(workout);
  const workoutDate = workout.date.toDate();
  const timeStr = format(workoutDate, 'h:mm a');
  const today = isToday(workoutDate);
  const past = isPast(workoutDate) && !today;
  const isMissed = past && !workout.completed;
  const isPlanned = !workout.completed && !past;
  const isStrava = workout.source === 'strava' || workout.completedBy === 'strava';

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className={cn(
        'block rounded-xl border transition-all hover:shadow-sm',
        'bg-card',
        isMissed && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3 p-3.5">
        {/* Emoji */}
        <span className="text-xl mt-0.5 shrink-0">{cfg.emoji}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold leading-tight truncate">{workout.name}</h3>
            {/* Status badge */}
            {isPlanned && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Planned
              </span>
            )}
            {workout.completed && !workout.completedLate && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                Done
              </span>
            )}
            {workout.completedLate && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Late
              </span>
            )}
            {isMissed && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                Missed
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <span>{timeStr}</span>
            <span className="opacity-40">·</span>
            <span>{stats.time}</span>
            {stats.primary !== '--' && (
              <>
                <span className="opacity-40">·</span>
                <span>{stats.primary}</span>
              </>
            )}
            {workout.tags && workout.tags.length > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span className="capitalize">{workout.tags[0]}</span>
              </>
            )}
          </div>
        </div>

        {/* Source badge + completion toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {isStrava && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20">
              <Activity className="h-3 w-3" />S
            </span>
          )}
          {onToggleComplete && (
            <button
              onClick={(e) => onToggleComplete(e, workout)}
              className="opacity-40 hover:opacity-100 transition-opacity"
            >
              {workout.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * CalendarWorkoutCard — renders as mini-pill (month grid) or compact card (mobile list).
 */
export function CalendarWorkoutCard({
  workout,
  compact = false,
  onToggleComplete,
  onSelect,
}: CalendarWorkoutCardProps) {
  if (compact) {
    return <CompactCard workout={workout} onToggleComplete={onToggleComplete} />;
  }
  return <MiniPill workout={workout} onSelect={onSelect} />;
}
