'use client';

/**
 * Calendar drag-and-drop context for desktop reschedule.
 *
 * Gated to md+ viewports — below that we render children pass-through so the
 * future mobile long-press flow isn't interfered with. Activation distance
 * of 8 px lets taps/clicks pass through as regular card selects; only an
 * intentional drag picks the pill up.
 *
 * `DragOverlay` renders the ghost via a portal so it escapes the cells'
 * `overflow-hidden` and the dashboard layout's `overflow-x-hidden`. Without
 * this the ghost visibly clips when dragging across the tablet two-week layout.
 */

import { useEffect, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Workout } from '@/types';
import { CalendarWorkoutCard } from './CalendarWorkoutCard';

interface CalendarDndContextProps {
  onDragEnd: (event: DragEndEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  children: ReactNode;
}

export function CalendarDndContext({ onDragStart, onDragEnd, children }: CalendarDndContextProps) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  if (!isDesktop) {
    return <>{children}</>;
  }

  const handleDragStart = (event: DragStartEvent) => {
    const workout = event.active.data.current?.workout as Workout | undefined;
    if (workout) setActiveWorkout(workout);
    onDragStart?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveWorkout(null);
    onDragEnd(event);
  };

  const handleDragCancel = () => {
    setActiveWorkout(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={{ duration: 200 }}>
        {activeWorkout ? (
          <div className="scale-[1.03] shadow-xl shadow-black/20 rounded-lg">
            <CalendarWorkoutCard workout={activeWorkout} compact={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
