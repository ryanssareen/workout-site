'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Dumbbell, Flag, StickyNote, Loader2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/authStore';
import { createWorkoutViaApi } from '@/lib/api-client';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { createPortal } from 'react-dom';

const EVENT_TYPES = [
  { value: 'run', label: 'Run', emoji: '🏃' },
  { value: 'bike', label: 'Bike', emoji: '🚴' },
  { value: 'swim', label: 'Swim', emoji: '🏊' },
  { value: 'strength', label: 'Strength', emoji: '💪' },
  { value: 'other', label: 'Other', emoji: '📋' },
];

interface CalendarAddDropdownProps {
  date: Date;
  className?: string;
  onNoteAdded?: () => void;
}

type DropdownView = 'menu' | 'note' | 'event';

export function CalendarAddDropdown({ date, className, onNoteAdded }: CalendarAddDropdownProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DropdownView>('menu');
  const [noteText, setNoteText] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('run');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventNameRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);


  // Auto-focus textarea when note input opens
  useEffect(() => {
    if (view === 'note' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [view]);

  // Auto-focus event name input when event input opens
  useEffect(() => {
    if (view === 'event' && eventNameRef.current) {
      eventNameRef.current.focus();
    }
  }, [view]);

  const dateStr = format(date, 'yyyy-MM-dd');

  const handleSaveNote = async () => {
    if (!noteText.trim() || !user?.username) return;

    setSaving(true);
    try {
      const noteDate = new Date(dateStr + 'T12:00:00');
      await createWorkoutViaApi(
        {
          name: 'Note',
          type: 'other',
          date: noteDate,
          description: noteText.trim(),
          tags: ['note'],
          assignedTo: user.username,
        } as any,
        user.username,
      );

      useWorkoutStore.getState().clearCache();
      toast.success('Note added');
      setNoteText('');
      setView('menu');
      setOpen(false);
      onNoteAdded?.();
    } catch (err: any) {
      console.error('Failed to save note:', err);
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEvent = async () => {
    if (!eventName.trim() || !user?.username) return;

    setSaving(true);
    try {
      const eventDate = new Date(dateStr + 'T08:00:00');
      await createWorkoutViaApi(
        {
          name: eventName.trim(),
          type: eventType,
          date: eventDate,
          assignedTo: user.username,
          tags: ['race'],
        } as any,
        user.username,
      );

      useWorkoutStore.getState().clearCache();
      toast.success('Event added');
      setEventName('');
      setEventType('run');
      setView('menu');
      setOpen(false);
      onNoteAdded?.();
    } catch (err: any) {
      console.error('Failed to save event:', err);
      toast.error('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  // Compute position for the portal-rendered dropdown
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownW = view !== 'menu' ? 256 : 160; // w-64 = 256px, w-40 = 160px
    const dropdownH = view === 'note' ? 180 : view === 'event' ? 220 : 120;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer below the button, flip above if clipped
    let top = rect.bottom + 4;
    if (top + dropdownH > vh - 16) {
      top = rect.top - dropdownH - 4;
    }

    // Prefer aligned to right edge of button, shift left if clipped
    let left = rect.right - dropdownW;
    if (left < 8) left = 8;
    if (left + dropdownW > vw - 8) left = vw - dropdownW - 8;

    setPos({ top, left });
  }, [view]);

  useEffect(() => {
    if (open) updatePosition();
  }, [open, view, updatePosition]);

  // Combine both refs for outside-click detection
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setView('menu');
        setNoteText('');
        setEventName('');
        setEventType('run');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
          if (open) {
            setView('menu');
            setNoteText('');
            setEventName('');
            setEventType('run');
          }
        }}
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center transition-all',
          'text-muted-foreground/40 hover:text-primary hover:bg-primary/10',
          open && 'text-primary bg-primary/10',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          className={cn(
            'fixed z-[100] rounded-lg border bg-popover shadow-lg animate-in fade-in slide-in-from-top-1 duration-150',
            view !== 'menu' ? 'w-64 p-3' : 'w-40 py-1',
          )}
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {view === 'note' ? (
            /* Note input view */
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <StickyNote className="h-3 w-3 text-blue-500" />
                Note for {format(date, 'MMM d')}
              </div>
              <textarea
                ref={textareaRef}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSaveNote();
                  }
                }}
                placeholder="Add a note..."
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">⌘+Enter to save</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setView('menu'); setNoteText(''); }}
                    className="px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={!noteText.trim() || saving}
                    className="px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : view === 'event' ? (
            /* Event input view */
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Flag className="h-3 w-3 text-amber-500" />
                Event on {format(date, 'MMM d')}
              </div>
              <input
                ref={eventNameRef}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && eventName.trim()) {
                    handleSaveEvent();
                  }
                }}
                placeholder="Event name (e.g. 10K Race)"
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex gap-1 flex-wrap">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setEventType(t.value)}
                    className={cn(
                      'px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                      eventType === t.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground',
                    )}
                  >
                    <span className="text-[10px]">{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Enter to save</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setView('menu'); setEventName(''); setEventType('run'); }}
                    className="px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEvent}
                    disabled={!eventName.trim() || saving}
                    className="px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Menu view */
            <>
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
                onClick={() => setView('event')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
              >
                <Flag className="h-3.5 w-3.5 text-amber-500" />
                <span>Add Event</span>
              </button>
              <button
                onClick={() => setView('note')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
              >
                <StickyNote className="h-3.5 w-3.5 text-blue-500" />
                <span>Add Note</span>
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
