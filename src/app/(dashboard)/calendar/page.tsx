'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSearchParams } from 'next/navigation';
import { getUserWorkouts, completeWorkout, deleteWorkout, getCoachStudents } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
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
} from 'date-fns';
import { toast } from 'sonner';

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
  const [athletes, setAthletes] = useState<{ uid: string; displayName: string }[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<string>('all');
  const isCoach = user?.role === 'coach';

  // Report
  const [sendingReport, setSendingReport] = useState(false);

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

  const refreshWorkouts = useCallback(async () => {
    if (!user) return;
    const data = await getUserWorkouts(user.username, user.role);
    setWorkouts(data);
    setLoading(false);
  }, [user]);

  const { syncing, syncPhaseLabel } = useStravaAutoSync(
    fromStrava ? user : null,
    refreshWorkouts,
    shouldBypassCooldown,
  );

  // ── Data loading ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getUserWorkouts(user.username, user.role).then((data) => {
      setWorkouts(data);
      setLoading(false);
    });
    if (isCoach) {
      getCoachStudents(user.username).then((data) => {
        setAthletes(
          data.map((a: any) => ({
            uid: a.uid,
            displayName: a.displayName || a.email || 'Unknown',
          })),
        );
      });
    }
  }, [user, isCoach]);

  // ── Pre-computed workout lookup ──────────────────────────────────────
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, Workout[]>();
    workouts.forEach((w) => {
      // Apply athlete filter (coaches only)
      if (isCoach && selectedAthlete !== 'all' && w.assignedTo !== selectedAthlete) return;

      const key = format(w.date.toDate(), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    });
    return map;
  }, [workouts, isCoach, selectedAthlete]);

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
    try {
      await completeWorkout(workout.ownerUsername, workout.id, !workout.completed);
      const data = await getUserWorkouts(user!.username, user!.role);
      setWorkouts(data);
      toast.success(workout.completed ? 'Marked incomplete' : 'Marked complete!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

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
      const d = w.date.toDate();
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
      const d = w.date.toDate();
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
    onSelectAthlete: setSelectedAthlete,
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
      case 'week':
        return (
          <>
            <MobileWeekStrip
              weekStart={weekStart}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onWeekChange={setWeekStart}
              workoutsByDate={workoutsByDate}
            />
            <div className="mt-2">
              <CalendarDayWorkouts
                date={selectedDate}
                workouts={selectedDateWorkouts}
                onToggleComplete={handleToggleComplete}
              />
            </div>
          </>
        );
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
            {renderDesktopView()}
          </div>

          {/* Detail panel (not shown in year view) */}
          {selectedWorkout && viewMode !== 'year' && (
            <WorkoutDetailPanel
              workout={selectedWorkout}
              onClose={() => setSelectedWorkoutId(null)}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteWorkout}
            />
          )}
        </div>
      </div>
    </div>
  );
}
