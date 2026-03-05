'use client';

import { Workout } from '@/types';
import { TYPE_CONFIG, TYPE_LABELS, getTypeData, formatDur } from './types';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Strava Logo SVG ──────────────────────────────────────────────────────
function StravaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

// ── Workout status derivation ────────────────────────────────────────────
function getWorkoutStatus(workout: Workout) {
  const workoutDate = workout.date.toDate();
  const today = isToday(workoutDate);
  const past = isPast(workoutDate) && !today;

  // 6 states (evaluated in priority order)
  const isStravaStandalone = workout.source === 'strava';
  const isMatchedByStrava = !isStravaStandalone && workout.completed && workout.completedBy === 'strava';
  const isLate = workout.completedLate === true;
  const isCompletedManual = workout.completed && !isStravaStandalone && !isMatchedByStrava && !isLate;
  const isMissed = past && !workout.completed && !isStravaStandalone;
  const isFuture = !workout.completed && !past && !isStravaStandalone;

  return { isStravaStandalone, isMatchedByStrava, isLate, isCompletedManual, isMissed, isFuture, past, today };
}

interface CalendarWorkoutCardProps {
  workout: Workout;
  /** true = mobile compact list card, false = month grid mini-pill */
  compact?: boolean;
  /** true = ultra-compact pill for month view (emoji + name only, no stats line) */
  micro?: boolean;
  onToggleComplete?: (e: React.MouseEvent, workout: Workout) => void;
  /** Called when the pill is clicked in month view */
  onSelect?: (workoutId: string) => void;
}

/**
 * Month grid mini-pill: small colored pill with emoji + name + key stat.
 * Used inside CalendarMonthView cells.
 * Shows 6 distinct workout states with visual differentiation.
 */
function MiniPill({ workout, onSelect }: { workout: Workout; onSelect?: (id: string) => void }) {
  const cfg = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
  const stats = getTypeData(workout);
  const workoutDate = workout.date.toDate();
  const timeStr = format(workoutDate, 'h:mma').toLowerCase();
  const status = getWorkoutStatus(workout);

  // Background tint based on status
  const bgTint = status.isCompletedManual
    ? 'bg-green-500/5'
    : status.isMatchedByStrava
      ? 'bg-green-500/5'
      : status.isStravaStandalone
        ? 'bg-orange-500/5'
        : status.isLate
          ? 'bg-amber-500/5'
          : status.isMissed
            ? 'bg-red-500/5'
            : '';

  // Status label for second line
  const statusLabel = status.isCompletedManual
    ? 'Done'
    : status.isMatchedByStrava
      ? 'Matched'
      : status.isStravaStandalone
        ? 'Strava'
        : status.isLate
          ? 'Late'
          : status.isMissed
            ? 'Missed'
            : null;

  const statusLabelColor = status.isCompletedManual
    ? 'text-green-600 dark:text-green-400'
    : status.isMatchedByStrava
      ? 'text-green-600 dark:text-green-400'
      : status.isStravaStandalone
        ? 'text-orange-600 dark:text-orange-400'
        : status.isLate
          ? 'text-amber-600 dark:text-amber-400'
          : status.isMissed
            ? 'text-red-600 dark:text-red-400'
            : '';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(workout.id);
      }}
      className={cn(
        'w-full text-left rounded-md border-l-[3px] px-2 py-1 transition-all',
        'hover:bg-muted/60 cursor-pointer',
        bgTint || 'bg-card/80',
        cfg.border,
        status.isMissed && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs shrink-0">{cfg.emoji}</span>
        <span
          className={cn(
            'text-[11px] font-semibold truncate flex-1',
            status.isMissed && 'line-through text-muted-foreground',
          )}
        >
          {workout.name}
        </span>

        {/* Status icons */}
        {(status.isCompletedManual || status.isLate || status.isMatchedByStrava) && (
          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
        )}
        {(status.isStravaStandalone || status.isMatchedByStrava) && (
          <StravaIcon className="h-3 w-3 text-[#FC4C02] shrink-0" />
        )}
        {status.isMissed && (
          <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
        {!status.isMissed && <span>{timeStr}</span>}
        {!status.isMissed && stats.primary !== '--' && (
          <>
            <span className="opacity-40">·</span>
            <span className="truncate">{stats.primary}</span>
          </>
        )}
        {statusLabel && (
          <>
            {!status.isMissed && <span className="opacity-40">·</span>}
            <span className={cn('font-semibold', statusLabelColor)}>{statusLabel}</span>
          </>
        )}
      </div>
    </button>
  );
}

/**
 * Compact card: for mobile day workout list.
 * Shows emoji + name + badges + stats in a tappable card.
 * Supports 6 workout states with distinct badges.
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
  const status = getWorkoutStatus(workout);

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className={cn(
        'block rounded-xl border transition-all hover:shadow-sm',
        'bg-card',
        status.isMissed && 'opacity-60',
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
            {status.isFuture && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Planned
              </span>
            )}
            {status.isCompletedManual && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                Done
              </span>
            )}
            {status.isLate && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Late
              </span>
            )}
            {status.isMissed && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                Missed
              </span>
            )}
            {status.isStravaStandalone && (
              <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/10 text-[#FC4C02] border border-orange-500/20">
                <StravaIcon className="h-2.5 w-2.5" />
                Strava
              </span>
            )}
            {status.isMatchedByStrava && (
              <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                <CheckCircle2 className="h-2.5 w-2.5" />
                <StravaIcon className="h-2.5 w-2.5 text-[#FC4C02]" />
                Matched
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
          {(status.isStravaStandalone || status.isMatchedByStrava) && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-[#FC4C02] border border-orange-500/20">
              <StravaIcon className="h-3 w-3" />
            </span>
          )}
          {onToggleComplete && workout.source !== 'strava' && !status.isMatchedByStrava && (
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
 * MicroPill: Ultra-compact pill for full-month view.
 * Shows only emoji + truncated name + status icon. No second line.
 */
function MicroPillCard({ workout, onSelect }: { workout: Workout; onSelect?: (id: string) => void }) {
  const cfg = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
  const status = getWorkoutStatus(workout);

  const bgTint = status.isCompletedManual || status.isMatchedByStrava
    ? 'bg-green-500/5'
    : status.isStravaStandalone
      ? 'bg-orange-500/5'
      : status.isMissed
        ? 'bg-red-500/5'
        : '';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(workout.id);
      }}
      className={cn(
        'w-full text-left rounded border-l-2 px-1.5 py-0.5 transition-all',
        'hover:bg-muted/60 cursor-pointer',
        bgTint || 'bg-card/80',
        cfg.border,
        status.isMissed && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-[10px] shrink-0">{cfg.emoji}</span>
        <span
          className={cn(
            'text-[10px] font-semibold truncate flex-1',
            status.isMissed && 'line-through text-muted-foreground',
          )}
        >
          {workout.name}
        </span>
        {(status.isCompletedManual || status.isMatchedByStrava) && (
          <CheckCircle2 className="h-2.5 w-2.5 text-green-500 shrink-0" />
        )}
        {status.isStravaStandalone && (
          <StravaIcon className="h-2.5 w-2.5 text-[#FC4C02] shrink-0" />
        )}
      </div>
    </button>
  );
}

/**
 * CalendarWorkoutCard — renders as micro-pill, mini-pill, or compact card.
 */
export function CalendarWorkoutCard({
  workout,
  compact = false,
  micro = false,
  onToggleComplete,
  onSelect,
}: CalendarWorkoutCardProps) {
  if (compact) {
    return <CompactCard workout={workout} onToggleComplete={onToggleComplete} />;
  }
  if (micro) {
    return <MicroPillCard workout={workout} onSelect={onSelect} />;
  }
  return <MiniPill workout={workout} onSelect={onSelect} />;
}
