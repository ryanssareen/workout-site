'use client';

/**
 * Draggable wrapper around an existing calendar workout pill.
 *
 * Eligibility = planned (future, uncompleted) + missed (past, uncompleted),
 * excluding anything Strava-synced. Ineligible workouts render children
 * pass-through with no drag listeners and no wrapper overhead.
 *
 * The inner pill stays a regular `<button>` / `<Link>` — activation distance
 * on the PointerSensor (configured in `CalendarDndContext`) lets tap/click
 * pass through unchanged.
 */

import type { ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Workout } from '@/types';
import { cn } from '@/lib/utils';

export function isDraggableWorkout(workout: Workout): boolean {
  if (workout.completed) return false;
  if (workout.source === 'strava') return false;
  if (workout.completedBy === 'strava') return false;
  return true;
}

interface DraggableWorkoutCardProps {
  workout: Workout;
  /** Source day key (yyyy-MM-dd) — used by the drop handler to detect same-day drops. */
  dateKey: string;
  children: ReactNode;
}

export function DraggableWorkoutCard({ workout, dateKey, children }: DraggableWorkoutCardProps) {
  const eligible = isDraggableWorkout(workout);

  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: workout.id,
    data: { workout, dateKey },
    disabled: !eligible,
  });

  if (!eligible) {
    return <>{children}</>;
  }

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn('cursor-grab active:cursor-grabbing', isDragging && 'z-10')}
    >
      {children}
    </div>
  );
}
