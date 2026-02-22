'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, completeWorkout } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
  Circle,
  Activity,
  Filter,
  Send,
  Dumbbell,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isPast,
  addDays,
} from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<string, { emoji: string; color: string; border: string; bg: string }> = {
  run: { emoji: '🏃', color: 'text-red-500', border: 'border-l-red-500', bg: 'bg-red-500/10' },
  bike: { emoji: '🚴', color: 'text-amber-500', border: 'border-l-amber-500', bg: 'bg-amber-500/10' },
  swim: { emoji: '🏊', color: 'text-cyan-500', border: 'border-l-cyan-500', bg: 'bg-cyan-500/10' },
  strength: { emoji: '💪', color: 'text-purple-500', border: 'border-l-purple-500', bg: 'bg-purple-500/10' },
  other: { emoji: '📋', color: 'text-gray-400', border: 'border-l-gray-400', bg: 'bg-gray-500/10' },
};

function getTypeData(w: Workout) {
  const d: Record<string, any> = {};
  if (w.type === 'run' && w.run) {
    if (w.run.distance) d.distance = `${w.run.distance} ${w.run.distanceUnit || 'km'}`;
    if (w.run.time) d.duration = formatDur(w.run.time);
    if (w.run.elevationGain) d.elev = `${w.run.elevationGain}m`;
  } else if (w.type === 'bike' && w.bike) {
    if (w.bike.distance) d.distance = `${w.bike.distance} ${w.bike.distanceUnit || 'km'}`;
    if (w.bike.time) d.duration = formatDur(w.bike.time);
    if (w.bike.elevationGain) d.elev = `${w.bike.elevationGain}m`;
  } else if (w.type === 'swim' && w.swim) {
    if (w.swim.distance) d.distance = `${w.swim.distance} ${w.swim.distanceUnit || 'm'}`;
    if (w.swim.time) d.duration = formatDur(w.swim.time);
  } else if (w.type === 'strength' && w.strength) {
    d.exercises = `${w.strength.exercises?.length || 0} exercises`;
  }
  if (!d.duration && w.duration) d.duration = formatDur(w.duration);
  return d;
}

function formatDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export default function CalendarPage() {
  const user = useAuthStore((s) => s.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(['swim', 'bike', 'run', 'strength', 'other']));
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserWorkouts(user.uid, user.role).then(data => {
      setWorkouts(data);
      setLoading(false);
    });
  }, [user]);

  const weekDays = useMemo(() =>
    eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }),
    [weekStart]
  );

  const getWorkoutsForDate = (date: Date) =>
    workouts.filter(w => activeTypes.has(w.type) && isSameDay(w.date.toDate(), date));

  // Weekly summary
  const weekSummary = useMemo(() => {
    const weekEnd = addDays(weekStart, 6);
    const weekWorkouts = workouts.filter(w => {
      const d = w.date.toDate();
      return d >= weekStart && d <= weekEnd && activeTypes.has(w.type);
    });
    const completed = weekWorkouts.filter(w => w.completed).length;
    const total = weekWorkouts.length;
    let totalDuration = 0;
    let totalDistance = 0;
    const byType: Record<string, { count: number; duration: number; distance: number }> = {};

    weekWorkouts.forEach(w => {
      const dur = w.duration || 0;
      totalDuration += dur;
      let dist = 0;
      if (w.run?.distance) dist = w.run.distance;
      else if (w.bike?.distance) dist = w.bike.distance;
      else if (w.swim?.distance) dist = w.swim.distance / 1000; // m → km
      totalDistance += dist;

      if (!byType[w.type]) byType[w.type] = { count: 0, duration: 0, distance: 0 };
      byType[w.type].count++;
      byType[w.type].duration += dur;
      byType[w.type].distance += dist;
    });

    return { completed, total, totalDuration, totalDistance, byType };
  }, [workouts, weekStart, activeTypes]);

  const handleToggleComplete = async (e: React.MouseEvent, workout: Workout) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await completeWorkout(workout.id, !workout.completed);
      const data = await getUserWorkouts(user!.uid, user!.role);
      setWorkouts(data);
      toast.success(workout.completed ? 'Marked incomplete' : 'Marked complete!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
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
    const weekEnd = addDays(weekStart, 6);
    const weekWorkouts = workouts.filter(w => {
      const d = w.date.toDate();
      return d >= weekStart && d <= weekEnd;
    });
    const icsLines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TheDailyAthlete//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ];
    weekWorkouts.forEach(w => {
      const d = w.date.toDate();
      const dateStr = format(d, "yyyyMMdd'T'HHmmss");
      const end = new Date(d); end.setMinutes(end.getMinutes() + (w.duration || 60));
      icsLines.push('BEGIN:VEVENT', `UID:${w.id}@tda`, `DTSTART:${dateStr}`,
        `DTEND:${format(end, "yyyyMMdd'T'HHmmss")}`, `SUMMARY:${w.name} (${w.type})`,
        `DESCRIPTION:${(w.description || '').replace(/\n/g, '\\n')}`,
        `STATUS:${w.completed ? 'COMPLETED' : 'CONFIRMED'}`, 'END:VEVENT');
    });
    icsLines.push('END:VCALENDAR');
    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `week-${format(weekStart, 'yyyy-MM-dd')}.ics`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Week exported!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekStart(subWeeks(weekStart, 1))}
            className="p-2 rounded-xl border hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center min-w-[200px]">
            <h1 className="text-xl font-bold">
              {format(weekStart, 'MMM d')} — {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </h1>
          </div>
          <button onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            className="p-2 rounded-xl border hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
          >Today</button>
        </div>
        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="hidden md:flex items-center gap-1.5 mr-2">
            {(['run', 'bike', 'swim', 'strength', 'other'] as const).map(type => {
              const active = activeTypes.has(type);
              const cfg = TYPE_CONFIG[type];
              return (
                <button key={type} onClick={() => {
                  const next = new Set(activeTypes);
                  if (active && activeTypes.size > 1) next.delete(type);
                  else next.add(type);
                  setActiveTypes(next);
                }}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    active ? `${cfg.bg} ${cfg.color} border-current/20` : 'border-border text-muted-foreground/50'
                  )}
                >{cfg.emoji} {type}</button>
              );
            })}
          </div>
          <button onClick={generateICS}
            className="p-2 rounded-xl border hover:bg-muted transition-colors" title="Export week">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={handleSendReport} disabled={sendingReport}
            className="p-2 rounded-xl border hover:bg-muted transition-colors" title="Email report">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekly Grid */}
      <div className="flex gap-0 border rounded-2xl overflow-hidden min-h-[calc(100vh-180px)]">
        {/* Day Columns */}
        {weekDays.map((date) => {
          const dayWorkouts = getWorkoutsForDate(date);
          const today = isToday(date);
          const past = isPast(date) && !today;

          return (
            <div key={date.toISOString()}
              className={cn(
                'flex-1 min-w-0 flex flex-col border-r last:border-r-0',
                today && 'bg-red-500/[0.03]',
              )}
            >
              {/* Day Header */}
              <div className={cn(
                'px-3 py-3 border-b text-center sticky top-0 z-10 bg-background',
                today && 'bg-red-600 text-white',
              )}>
                <div className="text-xs font-medium uppercase tracking-wider opacity-70">
                  {format(date, 'EEE')}
                </div>
                <div className={cn('text-2xl font-bold', !today && 'text-foreground')}>
                  {format(date, 'd')}
                </div>
                {dayWorkouts.length > 0 && (
                  <div className={cn(
                    'text-[10px] font-medium mt-0.5',
                    today ? 'text-white/70' : 'text-muted-foreground'
                  )}>
                    {dayWorkouts.filter(w => w.completed).length}/{dayWorkouts.length} done
                  </div>
                )}
              </div>

              {/* Workout Cards */}
              <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
                {dayWorkouts.length === 0 && (
                  <div className="flex items-center justify-center h-full opacity-20">
                    <span className="text-xs text-muted-foreground">Rest day</span>
                  </div>
                )}

                {dayWorkouts.map(workout => {
                  const cfg = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
                  const typeData = getTypeData(workout);
                  const isMissed = past && !workout.completed;
                  const isStrava = workout.source === 'strava';
                  const isImported = workout.source === 'import';

                  return (
                    <Link key={workout.id} href={`/workouts/${workout.id}`}
                      className={cn(
                        'block rounded-lg border-l-[3px] p-2.5 transition-all hover:shadow-md hover:scale-[1.02] group',
                        'border border-l-[3px] bg-card',
                        cfg.border,
                        workout.completed && 'opacity-80',
                        isMissed && 'border-red-500/30 bg-red-500/5',
                      )}
                    >
                      {/* Type icon + name */}
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm shrink-0">{cfg.emoji}</span>
                          <span className="text-xs font-semibold truncate">{workout.name}</span>
                        </div>
                        <button
                          onClick={(e) => handleToggleComplete(e, workout)}
                          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                          title={workout.completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {workout.completed
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      </div>

                      {/* Athlete name (coach view) */}
                      {workout.assignedToName && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {workout.assignedToName}
                        </p>
                      )}

                      {/* Stats grid */}
                      <div className="mt-1.5 space-y-0.5">
                        {typeData.duration && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            ⏱ {typeData.duration}
                          </div>
                        )}
                        {typeData.distance && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            📏 {typeData.distance}
                          </div>
                        )}
                        {typeData.elev && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            ⛰️ {typeData.elev}
                          </div>
                        )}
                        {typeData.exercises && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            🏋️ {typeData.exercises}
                          </div>
                        )}
                      </div>

                      {/* Status badges */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {isStrava && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-orange-500">
                            <Activity className="h-2.5 w-2.5" /> Strava
                          </span>
                        )}
                        {isImported && (
                          <span className="text-[9px] font-semibold text-blue-500">📥 Import</span>
                        )}
                        {isMissed && (
                          <span className="text-[9px] font-semibold text-red-500">Missed</span>
                        )}
                        {workout.completed && workout.completedLate && (
                          <span className="text-[9px] font-semibold text-amber-500">Late</span>
                        )}
                      </div>

                      {/* Tags */}
                      {workout.tags && workout.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          {workout.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Weekly Summary Sidebar */}
        <div className="w-[200px] shrink-0 border-l bg-muted/30 flex flex-col">
          <div className="px-3 py-3 border-b text-center bg-background">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Summary</div>
            <div className="text-lg font-bold mt-0.5">Week {format(weekStart, 'w')}</div>
          </div>
          <div className="p-3 space-y-4 text-sm">
            {/* Completion */}
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Completion</div>
              <div className="text-2xl font-bold">
                {weekSummary.total > 0 ? Math.round((weekSummary.completed / weekSummary.total) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">
                {weekSummary.completed} of {weekSummary.total} done
              </div>
              {weekSummary.total > 0 && (
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${(weekSummary.completed / weekSummary.total) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {/* Duration */}
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Duration</div>
              <div className="text-lg font-bold">{formatDur(weekSummary.totalDuration)}</div>
            </div>

            {/* Distance */}
            {weekSummary.totalDistance > 0 && (
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Distance</div>
                <div className="text-lg font-bold">{weekSummary.totalDistance.toFixed(1)} km</div>
              </div>
            )}

            {/* By Type breakdown */}
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">By Type</div>
              <div className="space-y-2">
                {Object.entries(weekSummary.byType)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([type, data]) => {
                    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.other;
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <span className="text-sm">{cfg.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium capitalize">{type}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {data.count}× · {formatDur(data.duration)}
                            {data.distance > 0 ? ` · ${data.distance.toFixed(1)}km` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {Object.keys(weekSummary.byType).length === 0 && (
                  <div className="text-xs text-muted-foreground">No workouts</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
