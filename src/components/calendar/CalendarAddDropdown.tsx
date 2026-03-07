'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Dumbbell, Flag, StickyNote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CalendarAddDropdownProps {
  date: Date;
  className?: string;
}

export function CalendarAddDropdown({ date, className }: CalendarAddDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const dateStr = format(date, 'yyyy-MM-dd');

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center transition-all',
          'text-muted-foreground/40 hover:text-primary hover:bg-primary/10',
          open && 'text-primary bg-primary/10',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-6 z-50 w-40 rounded-lg border bg-popover shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              router.push(`/workouts/new?date=${dateStr}`);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
          >
            <Dumbbell className="h-3.5 w-3.5 text-primary" />
            <span>Add Workout</span>
          </button>
          <button
            onClick={() => {
              router.push(`/workouts/new?date=${dateStr}&tag=race`);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
          >
            <Flag className="h-3.5 w-3.5 text-amber-500" />
            <span>Add Event</span>
          </button>
          <button
            onClick={() => {
              router.push(`/workouts/new?date=${dateStr}&note=true`);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
          >
            <StickyNote className="h-3.5 w-3.5 text-blue-500" />
            <span>Add Note</span>
          </button>
        </div>
      )}
    </div>
  );
}
