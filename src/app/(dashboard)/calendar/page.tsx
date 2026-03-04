'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSearchParams } from 'next/navigation';
import { getUserWorkouts, completeWorkout, getCoachStudents } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { useStravaAutoSync } from '@/hooks/useStravaAutoSync';
import { Loader2 } from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  isSameDay,
} from 'date-fns';
import { toast } from 'sonner';

// Calendar components
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CalendarMonthView } from '@/components/calendar/CalendarMonthView';
import { MobileWeekStrip } from '@/components/calendar/MobileWeekStrip';
import { CalendarDayWorkouts } from '@/components/calendar/CalendarDayWorkouts';
import { WorkoutDetailPanel } from '@/components/calendar/WorkoutDetailPanel';
import { CalendarSummary } from '@/components/calendar/CalendarSummary';

export default function CalendarPage() {
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  // Desktop: month navigation
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  // Mobile: week navigation
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  // Selected day (both mobile + desktop)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  // Selected workout for detail panel (desktop)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  // Filters
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(['swim', 'bike', 'run', 'strength', 'other']),
  );

  // Coach features
  const [athletes, setAthletes] = useState<{ uid: string; displayName: string }[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<string>('all');
  const isCoach = user?.role === 'coach';

  // Report
  const [sendingReport, setSendingReport] = useState(false);

  // ── Strava sync ──────────────────────────────────────────────────────
  const fromStrava = searchParams.get('strava') === 'connected';

  const refreshWorkouts = useCallback(async () => {
    if (!user) return;
    const data = await getUserWorkouts(user.username, user.role);
    setWorkouts(data);
    setLoading(false);
  }, [user]);

  const { syncing, syncPhaseLabel } = useStravaAutoSync(
    fromStrava ? user : null,
    refreshWorkouts,
    fromStrava,
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
      // Apply type filter
      if (!activeTypes.has(w.type)) return;
      // Apply athlete filter
      if (isCoach && selectedAthlete !== 'all' && w.assignedTo !== selectedAthlete) return;

      const key = format(w.date.toDate(), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    });
    return map;
  }, [workouts, activeTypes, isCoach, selectedAthlete]);

  // ── Summary computation ──────────────────────────────────────────────
  const summary = useMemo(() => {
    // For desktop: compute for entire visible month
    // For mobile: compute for current week
    // We'll compute for the current week for the summary bar (consistent with previous behavior)
    const weekEnd = addDays(weekStart, 6);
    const weekWorkouts = workouts.filter((w) => {
      const d = w.date.toDate();
      if (!(d >= weekStart && d <= weekEnd && activeTypes.has(w.type))) return false;
      if (isCoach && selectedAthlete !== 'all' && w.assignedTo !== selectedAthlete) return false;
      return true;
    });

    const completed = weekWorkouts.filter((w) => w.completed).length;
    const total = weekWorkouts.length;
    let totalDuration = 0;
    let totalDistance = 0;
    const byType: Record<string, { count: number; duration: number; distance: number }> = {};

    weekWorkouts.forEach((w) => {
      const dur = w.duration || 0;
      totalDuration += dur;
      let dist = 0;
      if (w.run?.distance) dist = w.run.distance;
      else if (w.bike?.distance) dist = w.bike.distance;
      else if (w.swim?.distance) dist = w.swim.distance / 1000;
      totalDistance += dist;

      if (!byType[w.type]) byType[w.type] = { count: 0, duration: 0, distance: 0 };
      byType[w.type].count++;
      byType[w.type].duration += dur;
      byType[w.type].distance += dist;
    });

    return { completed, total, totalDuration, totalDistance, byType };
  }, [workouts, weekStart, activeTypes, selectedAthlete, isCoach]);

  // ── Handlers ─────────────────────────────────────────────────────────
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

  const handleToggleType = (type: string) => {
    const next = new Set(activeTypes);
    if (activeTypes.has(type) && activeTypes.size > 1) next.delete(type);
    else next.add(type);
    setActiveTypes(next);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentMonth(now);
    setWeekStart(startOfWeek(now, { weekStartsOn: 1 }));
    setSelectedDate(now);
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
    // Export current month's workouts
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

  // Workouts for selected date (mobile)
  const selectedDateWorkouts = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    return workoutsByDate.get(key) || [];
  }, [selectedDate, workoutsByDate]);

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ═══ MOBILE LAYOUT (below md:) ═══ */}
      <div className="md:hidden space-y-3">
        <CalendarHeader
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onToday={handleToday}
          activeTypes={activeTypes}
          onToggleType={handleToggleType}
          isCoach={isCoach}
          athletes={athletes}
          selectedAthlete={selectedAthlete}
          onSelectAthlete={setSelectedAthlete}
          onExport={generateICS}
          onSendReport={handleSendReport}
          sendingReport={sendingReport}
        />

        <MobileWeekStrip
          weekStart={weekStart}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onWeekChange={setWeekStart}
          workoutsByDate={workoutsByDate}
        />

        <CalendarSummary {...summary} />

        {/* Strava sync indicator */}
        {syncing && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-orange-500/20 bg-orange-500/5">
            <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />
            <p className="text-sm text-orange-600 dark:text-orange-400">
              Syncing Strava workouts{syncPhaseLabel ? ` — ${syncPhaseLabel}` : ''}...
            </p>
          </div>
        )}

        <CalendarDayWorkouts
          date={selectedDate}
          workouts={selectedDateWorkouts}
          onToggleComplete={handleToggleComplete}
        />
      </div>

      {/* ═══ DESKTOP LAYOUT (md: and above) ═══ */}
      <div className="hidden md:block">
        <div className="space-y-3">
          <CalendarHeader
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onToday={handleToday}
            activeTypes={activeTypes}
            onToggleType={handleToggleType}
            isCoach={isCoach}
            athletes={athletes}
            selectedAthlete={selectedAthlete}
            onSelectAthlete={setSelectedAthlete}
            onExport={generateICS}
            onSendReport={handleSendReport}
            sendingReport={sendingReport}
          />

          <CalendarSummary {...summary} />

          {/* Strava sync indicator */}
          {syncing && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-orange-500/20 bg-orange-500/5">
              <Loader2 className="h-4 w-4 animate-spin text-orange-500 shrink-0" />
              <p className="text-sm text-orange-600 dark:text-orange-400">
                Syncing Strava workouts{syncPhaseLabel ? ` — ${syncPhaseLabel}` : ''}...
              </p>
            </div>
          )}
        </div>

        {/* Month grid + detail panel side by side */}
        <div className="flex gap-0 mt-3">
          <div className="flex-1 min-w-0">
            <CalendarMonthView
              currentMonth={currentMonth}
              workoutsByDate={workoutsByDate}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(date);
                // If there's only one workout on that day, auto-select it
                const key = format(date, 'yyyy-MM-dd');
                const dayWorkouts = workoutsByDate.get(key) || [];
                if (dayWorkouts.length === 1) {
                  setSelectedWorkoutId(dayWorkouts[0].id);
                } else {
                  setSelectedWorkoutId(null);
                }
              }}
              onSelectWorkout={(id) => setSelectedWorkoutId(id)}
              activeTypes={activeTypes}
            />
          </div>

          {/* Detail panel */}
          {selectedWorkout && (
            <WorkoutDetailPanel
              workout={selectedWorkout}
              onClose={() => setSelectedWorkoutId(null)}
              onToggleComplete={handleToggleComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
