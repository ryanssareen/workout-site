'use client';

/**
 * Droppable wrapper for a calendar day cell.
 *
 * Registers the day as a drop target keyed by `dateKey` (yyyy-MM-dd). The
 * drag handler on the calendar page resolves `event.over?.id` back to a
 * date via this key. Highlights the cell while a valid pickup is hovering.
 */

import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface DroppableDayCellProps {
  /** yyyy-MM-dd — must match the source pill's dateKey for same-day detection. */
  dateKey: string;
  children: ReactNode;
  className?: string;
}

export function DroppableDayCell({ dateKey, children, className }: DroppableDayCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && 'ring-2 ring-inset ring-primary/60 bg-primary/10',
      )}
    >
      {children}
    </div>
  );
}
