'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const WORKOUT_TYPES = [
  { type: 'run', emoji: '🏃', label: 'Run', color: 'bg-green-500' },
  { type: 'bike', emoji: '🚴', label: 'Bike', color: 'bg-orange-500' },
  { type: 'swim', emoji: '🏊', label: 'Swim', color: 'bg-blue-500' },
  { type: 'walk', emoji: '🚶', label: 'Walk', color: 'bg-emerald-500' },
  { type: 'strength', emoji: '💪', label: 'Strength', color: 'bg-purple-500' },
  { type: 'other', emoji: '🏋️', label: 'Other', color: 'bg-gray-500' },
];

export function QuickLogFAB() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSelect = (type: string) => {
    setOpen(false);
    router.push(`/workouts/new?type=${type}`);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* FAB container — only visible on mobile (lg screens have the sidebar + button) */}
      <div className="fixed bottom-20 right-4 z-50 lg:hidden">
        {/* Type options — fan out upward when open */}
        <div className={cn('flex flex-col-reverse gap-2 mb-3 transition-all duration-300', open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none')}>
          {WORKOUT_TYPES.map((wt, i) => (
            <button
              key={wt.type}
              onClick={() => handleSelect(wt.type)}
              className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full bg-card border border-border shadow-xl text-sm font-medium text-foreground hover:bg-muted transition-all"
              style={{
                transitionDelay: open ? `${i * 40}ms` : '0ms',
                transform: open ? 'scale(1)' : 'scale(0.8)',
                opacity: open ? 1 : 0,
              }}
            >
              <span className="text-lg">{wt.emoji}</span>
              <span>{wt.label}</span>
            </button>
          ))}
        </div>

        {/* Main FAB button */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close quick log menu' : 'Quick log workout'}
          className={cn(
            'h-14 w-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-90',
            open
              ? 'bg-muted text-foreground rotate-45 shadow-lg'
              : 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/30 hover:shadow-red-500/50',
          )}
        >
          {open ? <X className="h-6 w-6 rotate-[-45deg]" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
}
