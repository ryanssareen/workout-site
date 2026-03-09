'use client';

import { Workout } from '@/types';
import { TYPE_CONFIG, TYPE_LABELS, getTypeData, formatDur } from './types';
import { CheckCircle2, Circle, AlertCircle, StickyNote } from 'lucide-react';
import { isPast, isToday } from 'date-fns';
import { formatInTimezone } from '@/lib/dateUtils';
import { useAuthStore } from '@/lib/stores/authStore';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Note detection ──────────────────────────────────────────────────────
function isNote(workout: Workout): boolean {
  return workout.type === 'other' && workout.name === 'Note';
}

// Note-specific config overrides
const NOTE_CONFIG = {
  emoji: '📝',
  color: 'text-blue-500',
  border: 'border-l-blue-400',
  bg: 'bg-blue-500/8',
};

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
  const isMissed = past && !workout.completed && !isStravaStandalone && !isNote(workout);
  const isFuture = !workout.completed && !past && !isStravaStandalone;

  return { isStravaStandalone, isMatchedByStrava, isLate, isCompletedManual, isMissed, isFuture, past, today };
}

// ── Status-driven border + fill styles ──────────────────────────────────
function getStatusStyles(status: ReturnType<typeof getWorkoutStatus>, noteMode: boolean) {
  if (noteMode) {
    return {
      border: 'border-blue-400/50 dark:border-blue-500/50',
      bg: 'bg-blue-100/80 dark:bg-blue-500/15',
      opacity: '',
    };
  }
  if (status.isCompletedManual || status.isMatchedByStrava) {
    return {
      border: 'border-green-400 dark:border-green-500/70',
      bg: 'bg-green-100/80 dark:bg-green-500/15',
      opacity: '',
    };
  }
  if (status.isStravaStandalone) {
    return {
      border: 'border-orange-400 dark:border-orange-500/70',
      bg: 'bg-orange-100/80 dark:bg-orange-500/15',
      opacity: '',
    };
  }
  if (status.isLate) {
    return {
      border: 'border-amber-400 dark:border-amber-500/70',
      bg: 'bg-amber-100/80 dark:bg-amber-500/15',
      opacity: '',
    };
  }
  if (status.isMissed) {
    return {
      border: 'border-red-400 dark:border-red-500/70',
      bg: 'bg-red-100/80 dark:bg-red-500/15',
      opacity: 'opacity-60',
    };
  }
  if (status.isFuture) {
    return {
      border: 'border-blue-400/60 dark:border-blue-500/50 border-dashed',
      bg: 'bg-blue-50/60 dark:bg-blue-500/10',
      opacity: '',
    };
  }
  return {
    border: 'border-border/40',
    bg: 'bg-card/60',
    opacity: '',
  };
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
  const noteMode = isNote(workout);
  const cfg = noteMode ? NOTE_CONFIG : (TYPE_CONFIG[workout.type] || TYPE_CONFIG.other);
  const stats = getTypeData(workout);
  const workoutDate = workout.date.toDate();
  const userTimezone = useAuthStore((s) => s.user?.timezone);
  const timeStr = formatInTimezone(workoutDate, 'h:mma', userTimezone).toLowerCase();
  const status = getWorkoutStatus(workout);
  const statusStyles = getStatusStyles(status, noteMode);

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
        'w-full text-left rounded-lg px-2 py-1.5 transition-all duration-200',
        'hover:shadow-sm cursor-pointer',
        'border border-l-4',
        statusStyles.border,
        cfg.border,
        statusStyles.bg,
        statusStyles.opacity,
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {noteMode ? (
          <StickyNote className="h-3 w-3 text-blue-500 shrink-0" />
        ) : (
          <span className="text-xs shrink-0">{cfg.emoji}</span>
        )}
        <span
          className={cn(
            'text-[11px] font-semibold truncate flex-1',
            noteMode && 'italic text-blue-600 dark:text-blue-400',
            status.isMissed && 'line-through text-muted-foreground',
          )}
        >
          {noteMode ? (workout.description || 'Note') : workout.name}
        </span>

        {/* Status icons */}
        {!noteMode && (status.isCompletedManual || status.isLate || status.isMatchedByStrava) && (
          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
        )}
        {(status.isStravaStandalone || status.isMatchedByStrava) && (
          <StravaIcon className="h-3 w-3 text-[#FC4C02] shrink-0" />
        )}
        {status.isMissed && !noteMode && (
          <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
        )}
      </div>
      {noteMode ? (
        /* Notes: no stats, just a subtle "Note" label */
        <div className="text-[10px] text-blue-500/60 mt-0.5 italic">Note</div>
      ) : (
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
      )}
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
  const noteMode = isNote(workout);
  const cfg = noteMode ? NOTE_CONFIG : (TYPE_CONFIG[workout.type] || TYPE_CONFIG.other);
  const stats = getTypeData(workout);
  const workoutDate = workout.date.toDate();
  const userTimezone = useAuthStore((s) => s.user?.timezone);
  const timeStr = formatInTimezone(workoutDate, 'h:mm a', userTimezone);
  const status = getWorkoutStatus(workout);
  const statusStyles = getStatusStyles(status, noteMode);

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className={cn(
        'block rounded-2xl border transition-all duration-200',
        'shadow-sm hover:shadow-md hover:shadow-black/5',
        'hover:scale-[1.01] active:scale-[0.99]',
        statusStyles.border,
        statusStyles.bg,
        statusStyles.opacity,
      )}
    >
      <div className="flex overflow-hidden rounded-2xl">
        {/* Left color accent */}
        <div className={cn('w-1.5 shrink-0', cfg.border.replace('border-l-', 'bg-'))} />
        <div className="flex items-start gap-3 p-3.5 flex-1 min-w-0">
        {/* Emoji / Note icon */}
        {noteMode ? (
          <StickyNote className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        ) : (
          <span className="text-xl mt-0.5 shrink-0">{cfg.emoji}</span>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn(
              'text-sm font-bold leading-tight truncate',
              noteMode && 'italic text-blue-600 dark:text-blue-400',
            )}>
              {noteMode ? (workout.description || 'Note') : workout.name}
            </h3>
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
      </div>
    </Link>
  );
}

/**
 * MicroPill: Ultra-compact pill for full-month view.
 * Shows only emoji + truncated name + status icon. No second line.
 */
function MicroPillCard({ workout, onSelect }: { workout: Workout; onSelect?: (id: string) => void }) {
  const noteMode = isNote(workout);
  const cfg = noteMode ? NOTE_CONFIG : (TYPE_CONFIG[workout.type] || TYPE_CONFIG.other);
  const status = getWorkoutStatus(workout);
  const statusStyles = getStatusStyles(status, noteMode);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(workout.id);
      }}
      className={cn(
        'w-full text-left rounded-md px-1.5 py-0.5 transition-all duration-200',
        'hover:bg-muted/50 cursor-pointer',
        'border border-l-[3px]',
        statusStyles.border,
        cfg.border,
        statusStyles.bg,
        statusStyles.opacity,
      )}
    >
      <div className="flex items-center gap-1 min-w-0">
        {noteMode ? (
          <StickyNote className="h-2.5 w-2.5 text-blue-500 shrink-0" />
        ) : (
          <span className="text-[10px] shrink-0">{cfg.emoji}</span>
        )}
        <span
          className={cn(
            'text-[10px] font-semibold truncate flex-1',
            noteMode && 'italic text-blue-600 dark:text-blue-400',
            status.isMissed && 'line-through text-muted-foreground',
          )}
        >
          {noteMode ? (workout.description?.slice(0, 30) || 'Note') : workout.name}
        </span>
        {!noteMode && (status.isCompletedManual || status.isMatchedByStrava) && (
          <CheckCircle2 className="h-2.5 w-2.5 text-green-500 shrink-0" />
        )}
        {!noteMode && status.isStravaStandalone && (
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
