'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSearchParams } from 'next/navigation';
import { completeWorkout, deleteWorkout, rescheduleWorkout } from '@/lib/firebase/firestore';
import { useCoachFilter } from '@/hooks/useCoachFilter';
import { AthleteSelector } from '@/components/dashboard/AthleteSelector';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { Workout, PlanWorkoutMeta } from '@/types';
import { CalendarViewMode } from '@/components/calendar/types';
import { useStravaAutoSync, SYNC_COOLDOWN_UNTIL_KEY } from '@/hooks/useStravaAutoSync';
import { Loader2 } from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfMonth,
  endOfMonth,
  isToday,
  isPast,
} from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatInTimezone, safeToDate } from '@/lib/dateUtils';
import { parseLocalDate, getDayKey } from '@/lib/dayKey';
import { computePlanWeekNumber } from '@/lib/training/weekNumber';
import { getAuthInstance } from '@/lib/firebase/config';
import { track } from '@/lib/posthog';
import { toast } from 'sonner';
import type { DragEndEvent } from '@dnd-kit/core';
import { CalendarDndContext } from '@/components/calendar/CalendarDndContext';

// Calendar components
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CalendarWeekView } from '@/components/calendar/CalendarWeekView';
import { CalendarFullMonthView } from '@/components/calendar/CalendarFullMonthView';
import { CalendarYearView } from '@/components/calendar/CalendarYearView';
import { MobileWeekStrip } from '@/components/calendar/MobileWeekStrip';
import { CalendarDayWorkouts } from '@/components/calendar/CalendarDayWorkouts';
import { WorkoutDetailPanel } from '@/components/calendar/WorkoutDetailPanel';

export default function CalendarPage() {
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');

  // Navigation anchor date (drives all views)
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  // Mobile: week navigation
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  // Selected day (both mobile + desktop)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // Selected workout for detail panel (desktop)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  // Coach features
  const isCoach = user?.role === 'coach';
  const { selectedAthlete, selectAthlete, athletes } = useCoachFilter(
    isCoach ? user?.username : undefined
  );

  // Report
  const [sendingReport, setSendingReport] = useState(false);

  // Late completion prompt — shown when completing a past workout
  const [latePromptWorkout, setLatePromptWorkout] = useState<Workout | null>(null);

  // ── Strava sync ──────────────────────────────────────────────────────
  const fromStrava = searchParams.get('strava') === 'connected';
  const shouldBypassCooldown = useMemo(() => {
    if (!fromStrava) return false;
    try {
      const cooldownUntilRaw = sessionStorage.getItem(SYNC_COOLDOWN_UNTIL_KEY);
      const cooldownUntil = cooldownUntilRaw ? Number(cooldownUntilRaw) : 0;
      return !(Number.isFinite(cooldownUntil) && cooldownUntil > Date.now());
    } catch {
      return true;
    }
  }, [fromStrava]);

  const { getWorkouts, invalidate: invalidateWorkouts } = useWorkoutStore();

  const refreshWorkouts = useCallback(async () => {
    if (!user) return;
    const data = await invalidateWorkouts(user.username, user.role);
    setWorkouts(data);
    setLoading(false);
  }, [user, invalidateWorkouts]);

  const { syncing, syncPhaseLabel } = useStravaAutoSync(
    fromStrava ? user : null,
    refreshWorkouts,
    shouldBypassCooldown,
  );

  // ── Data loading ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getWorkouts(user.username, user.role).then((data) => {
      setWorkouts(data);
      setLoading(false);
    });
  }, [user, isCoach]);

  // ── Active training plan (for drag-reschedule weekNumber recompute) ──
  const [activePlan, setActivePlan] = useState<{
    id: string;
    startDate: string;
    timezoneAtCreation: string;
  } | null>(null);
  useEffect(() => {
    if (!user?.activePlanId) {
      setActivePlan(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const auth = getAuthInstance();
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;
        const res = await fetch(`/api/plans/${user.activePlanId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        setActivePlan({
          id: body.plan.id,
          startDate: body.plan.startDate,
          timezoneAtCreation: body.plan.timezoneAtCreation,
        });
      } catch {
        // Silent — plan context is optional for drag reschedule.
      }
    })();
    return () => { cancelled = true; };
  }, [user?.activePlanId]);

  // ── Pre-computed workout lookup ──────────────────────────────────────
  const userTimezone = user?.timezone;
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, Workout[]>();
    workouts.forEach((w) => {
      // Apply athlete filter (coaches only)
      if (isCoach && selectedAthlete && w.assignedTo !== selectedAthlete && w.ownerUsername !== selectedAthlete) return;

      // Use user timezone so workouts land on the correct calendar day
      const key = formatInTimezone(safeToDate(w), 'yyyy-MM-dd', userTimezone);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    });
    return map;
  }, [workouts, isCoach, selectedAthlete, userTimezone]);

  // ── Navigation handlers ──────────────────────────────────────────────
  const handlePrev = () => {
    switch (viewMode) {
      case 'day':
        setCurrentMonth((prev) => subDays(prev, 1));
        setSelectedDate((prev) => subDays(prev, 1));
        break;
      case 'week':
        setCurrentMonth((prev) => subWeeks(prev, 1));
        setWeekStart((prev) => subWeeks(prev, 1));
        break;
      case 'month':
        setCurrentMonth((prev) => subMonths(prev, 1));
        break;
      case 'year':
        setCurrentMonth((prev) => subYears(prev, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case 'day':
        setCurrentMonth((prev) => addDays(prev, 1));
        setSelectedDate((prev) => addDays(prev, 1));
        break;
      case 'week':
        setCurrentMonth((prev) => addWeeks(prev, 1));
        setWeekStart((prev) => addWeeks(prev, 1));
        break;
      case 'month':
        setCurrentMonth((prev) => addMonths(prev, 1));
        break;
      case 'year':
        setCurrentMonth((prev) => addYears(prev, 1));
        break;
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentMonth(now);
    setWeekStart(startOfWeek(now, { weekStartsOn: 1 }));
    setSelectedDate(now);
  };

  const handleToggleComplete = async (e: React.MouseEvent, workout: Workout) => {
    e.preventDefault();
    e.stopPropagation();
    const newCompleted = !workout.completed;

    // When marking a past workout as complete, prompt the athlete first
    if (newCompleted) {
      const workoutDate = safeToDate(workout);
      if (!isToday(workoutDate) && isPast(workoutDate)) {
        setLatePromptWorkout(workout);
        return;
      }
    }

    await doCompleteWorkout(workout, newCompleted);
  };

  const doCompleteWorkout = async (workout: Workout, newCompleted: boolean, overrideDate?: Date) => {
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== workout.id) return w;
        const update: Partial<Workout> = { completed: newCompleted, completedBy: newCompleted ? 'manual' : undefined };
        if (overrideDate) update.date = Timestamp.fromDate(overrideDate) as any;
        return { ...w, ...update } as Workout;
      })
    );
    toast.success(newCompleted ? 'Marked complete!' : 'Marked incomplete');
    try {
      await completeWorkout(workout.ownerUsername, workout.id, newCompleted, undefined, undefined, overrideDate);
      invalidateWorkouts(user!.username, user!.role);
    } catch (err: any) {
      setWorkouts((prev) =>
        prev.map((w) => w.id === workout.id ? { ...w, completed: !newCompleted, completedBy: !newCompleted ? 'manual' : undefined } as Workout : w)
      );
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleLatePromptKeep = async () => {
    if (!latePromptWorkout) return;
    const workout = latePromptWorkout;
    setLatePromptWorkout(null);
    track('late_completion_prompt_choice', { choice: 'keep', workout_id: workout.id });
    await doCompleteWorkout(workout, true);
  };

  const handleLatePromptMoveToday = async () => {
    if (!latePromptWorkout) return;
    const workout = latePromptWorkout;
    setLatePromptWorkout(null);
    track('late_completion_prompt_choice', { choice: 'move_to_today', workout_id: workout.id });
    await doCompleteWorkout(workout, true, new Date());
  };

  // ── Drag-to-reschedule (desktop, md+) ────────────────────────────────
  const draggingIdRef = useRef<string | null>(null);

  const performReschedule = useCallback(
    async (
      workout: Workout,
      newDate: Date,
      planMetaPatch: PlanWorkoutMeta | undefined,
      prevDate: Timestamp,
      prevPlanMeta: PlanWorkoutMeta | undefined,
    ) => {
      try {
        await rescheduleWorkout(workout.ownerUsername, workout.id, newDate, planMetaPatch);
        // Only invalidate if this drag is still the active one (rapid-drag guard).
        if (draggingIdRef.current !== workout.id) {
          invalidateWorkouts(user!.username, user!.role);
        } else {
          invalidateWorkouts(user!.username, user!.role);
        }
      } catch (err: any) {
        // Rollback local state.
        setWorkouts((prev) =>
          prev.map((w) =>
            w.id === workout.id ? { ...w, date: prevDate, planMeta: prevPlanMeta } : w,
          ),
        );
        toast.error(err?.message || "Couldn't move workout — try again.");
      }
    },
    [user, invalidateWorkouts],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      draggingIdRef.current = null;
      if (!over || !user) return;

      const sourceDateKey = active.data.current?.dateKey as string | undefined;
      const newDateKey = String(over.id);
      if (!sourceDateKey || sourceDateKey === newDateKey) return;

      const workout = active.data.current?.workout as Workout | undefined;
      if (!workout) return;

      // Rebuild newDate preserving the original wall-clock time-of-day in the
      // user's timezone (mirrors the #86 fix for Strava's start_date_local).
      const originalDate = safeToDate(workout);
      const tz = userTimezone || 'UTC';
      const timeOfDay = formatInTimezone(originalDate, 'HH:mm:ss', tz);
      const newDate = parseLocalDate(`${newDateKey}T${timeOfDay}`, tz);

      // Recompute planMeta.weekNumber when this workout belongs to the active plan.
      // Phase is preserved (R21). Requires the cached active plan's startDate + TZ.
      let planMetaPatch: PlanWorkoutMeta | undefined;
      if (workout.planMeta && workout.planId && activePlan && workout.planId === activePlan.id) {
        const newWeek = computePlanWeekNumber(
          newDate,
          activePlan.startDate,
          activePlan.timezoneAtCreation,
        );
        planMetaPatch = { ...workout.planMeta, weekNumber: newWeek };
      }

      const prevDate = workout.date;
      const prevPlanMeta = workout.planMeta;
      const newTimestamp = Timestamp.fromDate(newDate);

      // Optimistic update.
      setWorkouts((prev) =>
        prev.map((w) =>
          w.id === workout.id
            ? { ...w, date: newTimestamp, planMeta: planMetaPatch ?? w.planMeta }
            : w,
        ),
      );

      // Toast with Undo (5 s TTL). Plan-aware description.
      const movedLabel = formatInTimezone(newDate, 'MMM d', tz);
      toast.success(`Moved to ${movedLabel}`, {
        duration: 5000,
        description: planMetaPatch
          ? `Part of your training plan, week ${planMetaPatch.weekNumber}.`
          : undefined,
        action: {
          label: 'Undo',
          onClick: () => {
            // Optimistic revert, then write.
            setWorkouts((prev) =>
              prev.map((w) =>
                w.id === workout.id ? { ...w, date: prevDate, planMeta: prevPlanMeta } : w,
              ),
            );
            rescheduleWorkout(
              workout.ownerUsername,
              workout.id,
              prevDate.toDate(),
              prevPlanMeta,
            ).catch((err) => {
              toast.error(err?.message || "Undo failed — try dragging back.");
            });
          },
        },
      });

      track('reschedule_drag_desktop', {
        workoutId: workout.id,
        oldDate: getDayKey(prevDate.toDate(), tz),
        newDate: newDateKey,
        type: workout.type,
        hadPlanMeta: !!planMetaPatch,
      });

      performReschedule(workout, newDate, planMetaPatch, prevDate, prevPlanMeta);
    },
    [user, userTimezone, activePlan, performReschedule],
  );

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    draggingIdRef.current = String(event.active.id);
  }, []);

  const handleDeleteWorkout = async (workout: Workout) => {
    if (!user) return;
    if (!confirm(`Delete this note?`)) return;
    try {
      await deleteWorkout(user.username, workout.id);
      setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
      setSelectedWorkoutId(null);
      toast.success('Note deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleSendReport = async () => {
    if (!user) return;
    setSendingReport(true);
    try {
      const res = await fetch('/api/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, periodDays: 7 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      toast.success('Report sent!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSendingReport(false);
    }
  };

  const generateICS = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const monthWorkouts = workouts.filter((w) => {
      const d = safeToDate(w);
      return d >= monthStart && d <= monthEnd;
    });

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TheDailyAthlete//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];
    monthWorkouts.forEach((w) => {
      const d = safeToDate(w);
      const dateStr = format(d, "yyyyMMdd'T'HHmmss");
      const end = new Date(d);
      end.setMinutes(end.getMinutes() + (w.duration || 60));
      icsLines.push(
        'BEGIN:VEVENT',
        `UID:${w.id}@tda`,
        `DTSTART:${dateStr}`,
        `DTEND:${format(end, "yyyyMMdd'T'HHmmss")}`,
        `SUMMARY:${w.name} (${w.type})`,
        `DESCRIPTION:${(w.description || '').replace(/\n/g, '\\n')}`,
        `STATUS:${w.completed ? 'COMPLETED' : 'CONFIRMED'}`,
        'END:VEVENT',
      );
    });
    icsLines.push('END:VCALENDAR');

    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar-${format(currentMonth, 'yyyy-MM')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Calendar exported!');
  };

  // Find selected workout for detail panel
  const selectedWorkout = selectedWorkoutId
    ? workouts.find((w) => w.id === selectedWorkoutId) || null
    : null;

  // Workouts for selected date (day view / mobile)
  const selectedDateWorkouts = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    return workoutsByDate.get(key) || [];
  }, [selectedDate, workoutsByDate]);

  // ── Shared header props ────────────────────────────────────────────────
  const headerProps = {
    currentMonth,
    onPrev: handlePrev,
    onNext: handleNext,
    onToday: handleToday,
    viewMode,
    onViewModeChange: setViewMode,
    isCoach,
    athletes,
    selectedAthlete,
    onSelectAthlete: selectAthlete,
    onExport: generateICS,
    onSendReport: handleSendReport,
    sendingReport,
  };

  // ── Strava sync indicator ──────────────────────────────────────────────
  const syncIndicator = syncing && (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-orange-500/20 bg-orange-500/5">
      <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />
      <p className="text-sm text-orange-600 dark:text-orange-400">
        Syncing Strava workouts{syncPhaseLabel ? ` — ${syncPhaseLabel}` : ''}...
      </p>
    </div>
  );

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  // ── Render desktop view based on viewMode ────────────────────────────
  const renderDesktopView = () => {
    switch (viewMode) {
      case 'day':
        return (
          <div className="max-w-2xl">
            <CalendarDayWorkouts
              date={selectedDate}
              workouts={selectedDateWorkouts}
              onToggleComplete={handleToggleComplete}
            />
          </div>
        );
      case 'week':
        return (
          <CalendarWeekView
            currentMonth={currentMonth}
            workoutsByDate={workoutsByDate}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              const key = format(date, 'yyyy-MM-dd');
              const dayWorkouts = workoutsByDate.get(key) || [];
              if (dayWorkouts.length === 1) {
                setSelectedWorkoutId(dayWorkouts[0].id);
              } else {
                setSelectedWorkoutId(null);
              }
            }}
            onSelectWorkout={(id) => setSelectedWorkoutId(id)}
            activeTypes={new Set(['swim', 'bike', 'run', 'strength', 'other'])}
            onNoteAdded={refreshWorkouts}
          />
        );
      case 'month':
        return (
          <CalendarFullMonthView
            currentMonth={currentMonth}
            workoutsByDate={workoutsByDate}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              const key = format(date, 'yyyy-MM-dd');
              const dayWorkouts = workoutsByDate.get(key) || [];
              if (dayWorkouts.length === 1) {
                setSelectedWorkoutId(dayWorkouts[0].id);
              } else {
                setSelectedWorkoutId(null);
              }
            }}
            onSelectWorkout={(id) => setSelectedWorkoutId(id)}
            activeTypes={new Set(['swim', 'bike', 'run', 'strength', 'other'])}
            onNoteAdded={refreshWorkouts}
          />
        );
      case 'year':
        return (
          <CalendarYearView
            currentMonth={currentMonth}
            workoutsByDate={workoutsByDate}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setCurrentMonth(date);
            }}
            onViewModeChange={setViewMode}
          />
        );
    }
  };

  // ── Render mobile view based on viewMode ─────────────────────────────
  const renderMobileView = () => {
    switch (viewMode) {
      case 'day':
        return (
          <CalendarDayWorkouts
            date={selectedDate}
            workouts={selectedDateWorkouts}
            onToggleComplete={handleToggleComplete}
          />
        );
      case 'week': {
        const weekEnd = addDays(weekStart, 6);
        const weekDays: Date[] = [];
        for (let d = new Date(weekStart); d <= weekEnd; d = addDays(d, 1)) {
          weekDays.push(new Date(d));
        }
        return (
          <>
            <MobileWeekStrip
              weekStart={weekStart}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onWeekChange={setWeekStart}
              workoutsByDate={workoutsByDate}
            />
            <div className="mt-3 space-y-3">
              {weekDays.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const dayWorkouts = workoutsByDate.get(key) || [];
                return (
                  <CalendarDayWorkouts
                    key={key}
                    date={day}
                    workouts={dayWorkouts}
                    onToggleComplete={handleToggleComplete}
                  />
                );
              })}
            </div>
          </>
        );
      }
      case 'month':
        return (
          <CalendarFullMonthView
            currentMonth={currentMonth}
            workoutsByDate={workoutsByDate}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setViewMode('day');
              setCurrentMonth(date);
            }}
            onSelectWorkout={() => {}}
            activeTypes={new Set(['swim', 'bike', 'run', 'strength', 'other'])}
            onNoteAdded={refreshWorkouts}
          />
        );
      case 'year':
        return (
          <CalendarYearView
            currentMonth={currentMonth}
            workoutsByDate={workoutsByDate}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setCurrentMonth(date);
            }}
            onViewModeChange={setViewMode}
          />
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* ═══ MOBILE LAYOUT (below md:) ═══ */}
      <div className="md:hidden space-y-3">
        <CalendarHeader {...headerProps} />
        {syncIndicator}
        {renderMobileView()}
      </div>

      {/* ═══ DESKTOP LAYOUT (md: and above) ═══ */}
      <div className="hidden md:block">
        <div className="space-y-3">
          <CalendarHeader {...headerProps} />
          {syncIndicator}
        </div>

        {/* View + detail panel side by side */}
        <div className="flex gap-0 mt-3">
          <div className="flex-1 min-w-0">
            <CalendarDndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {renderDesktopView()}
            </CalendarDndContext>
          </div>

          {/* Detail panel (not shown in year view) */}
          {selectedWorkout && viewMode !== 'year' && (
            <WorkoutDetailPanel
              workout={selectedWorkout}
              onClose={() => setSelectedWorkoutId(null)}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteWorkout}
              allWorkouts={workouts}
              onMergeComplete={(deletedStravaId) => {
                setSelectedWorkoutId(null);
                setWorkouts((prev) => prev.filter((w) => w.id !== deletedStravaId));
                refreshWorkouts();
              }}
            />
          )}
        </div>
      </div>

      {/* Late completion prompt */}
      <Dialog open={!!latePromptWorkout} onOpenChange={(open) => { if (!open) setLatePromptWorkout(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete this workout?</DialogTitle>
            <DialogDescription>
              {latePromptWorkout && (
                <>
                  <strong>{latePromptWorkout.name}</strong> was scheduled for{' '}
                  <strong>{format(safeToDate(latePromptWorkout), 'MMM d')}</strong>. How would you like to log it?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleLatePromptKeep} variant="outline" className="w-full justify-start">
              ✓ Keep on {latePromptWorkout ? format(safeToDate(latePromptWorkout), 'MMM d') : '…'}
            </Button>
            <Button onClick={handleLatePromptMoveToday} className="w-full justify-start">
              📅 Move to today
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
