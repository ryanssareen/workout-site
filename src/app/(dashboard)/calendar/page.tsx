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
  Send,
  Clock,
  Route,
  Timer,
} from 'lucide-react';
import {
  format,
  startOfWeek,
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
  run: { emoji: '🏃', color: 'text-red-500', border: 'border-l-red-500', bg: 'bg-red-500/8' },
  bike: { emoji: '🚴', color: 'text-amber-500', border: 'border-l-amber-500', bg: 'bg-amber-500/8' },
  swim: { emoji: '🏊', color: 'text-cyan-500', border: 'border-l-cyan-500', bg: 'bg-cyan-500/8' },
  strength: { emoji: '💪', color: 'text-purple-500', border: 'border-l-purple-500', bg: 'bg-purple-500/8' },
  other: { emoji: '📋', color: 'text-gray-400', border: 'border-l-gray-400', bg: 'bg-gray-500/8' },
};

function getTypeData(w: Workout) {
  const d: Record<string, any> = {};
  if (w.type === 'run' && w.run) {
    if (w.run.distance) d.distance = `${w.run.distance} ${w.run.distanceUnit || 'km'}`;
    if (w.run.time) d.duration = formatDur(w.run.time);
    if (w.run.elevationGain) d.elev = `${w.run.elevationGain}m`;
    if (w.run.avgHeartRate) d.hr = `${w.run.avgHeartRate} bpm`;
  } else if (w.type === 'bike' && w.bike) {
    if (w.bike.distance) d.distance = `${w.bike.distance} ${w.bike.distanceUnit || 'km'}`;
    if (w.bike.time) d.duration = formatDur(w.bike.time);
    if (w.bike.elevationGain) d.elev = `${w.bike.elevationGain}m`;
    if (w.bike.avgHeartRate) d.hr = `${w.bike.avgHeartRate} bpm`;
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
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function formatDurLong(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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
      else if (w.swim?.distance) dist = w.swim.distance / 1000;
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

  const completionPct = weekSummary.total > 0 ? Math.round((weekSummary.completed / weekSummary.total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekStart(subWeeks(weekStart, 1))}
            className="p-2.5 rounded-xl border hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center min-w-[220px]">
            <h1 className="text-xl font-bold tracking-tight">
              {format(weekStart, 'MMM d')} — {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your weekly training plan</p>
          </div>
          <button onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            className="p-2.5 rounded-xl border hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
          >Today</button>
        </div>
        <div className="flex items-center gap-2">
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
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                    active ? `${cfg.bg} ${cfg.color} border-current/20` : 'border-border text-muted-foreground/40'
                  )}
                >{cfg.emoji} {type}</button>
              );
            })}
          </div>
          <button onClick={generateICS}
            className="p-2.5 rounded-xl border hover:bg-muted transition-colors" title="Export week">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={handleSendReport} disabled={sendingReport}
            className="p-2.5 rounded-xl border hover:bg-muted transition-colors" title="Email report">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekly Summary Bar */}
      <div className="flex items-center gap-6 px-5 py-3 rounded-xl border bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
              <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3"
                className="text-green-500" strokeDasharray={`${completionPct * 1.005} 100.5`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{completionPct}%</span>
          </div>
          <div>
            <div className="text-xs font-bold">{weekSummary.completed}/{weekSummary.total}</div>
            <div className="text-[10px] text-muted-foreground">completed</div>
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <div className="text-xs font-bold flex items-center gap-1"><Timer className="h-3 w-3 opacity-50" />{formatDurLong(weekSummary.totalDuration)}</div>
          <div className="text-[10px] text-muted-foreground">total time</div>
        </div>
        {weekSummary.totalDistance > 0 && (
          <>
            <div className="h-8 w-px bg-border" />
            <div>
              <div className="text-xs font-bold flex items-center gap-1"><Route className="h-3 w-3 opacity-50" />{weekSummary.totalDistance.toFixed(1)} km</div>
              <div className="text-[10px] text-muted-foreground">distance</div>
            </div>
          </>
        )}
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-3">
          {Object.entries(weekSummary.byType)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([type, data]) => {
              const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.other;
              return (
                <div key={type} className="flex items-center gap-1">
                  <span className="text-sm">{cfg.emoji}</span>
                  <span className="text-xs font-bold">{data.count}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{type}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Full-width Weekly Grid */}
      <div className="flex gap-0 border rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 210px)' }}>
        {weekDays.map((date) => {
          const dayWorkouts = getWorkoutsForDate(date);
          const today = isToday(date);
          const past = isPast(date) && !today;

          let dayDuration = 0;
          dayWorkouts.forEach(w => { dayDuration += w.duration || 0; });

          return (
            <div key={date.toISOString()}
              className={cn(
                'flex-1 min-w-0 flex flex-col border-r last:border-r-0',
                today && 'bg-red-500/[0.03]',
              )}
            >
              {/* Day Header */}
              <div className={cn(
                'px-2 py-4 border-b text-center shrink-0',
                today ? 'bg-red-600 text-white' : 'bg-muted/30',
              )}>
                <div className={cn('text-[11px] font-semibold uppercase tracking-widest', today ? 'text-white/70' : 'opacity-50')}>
                  {format(date, 'EEE')}
                </div>
                <div className={cn('text-3xl font-black mt-0.5', !today && 'text-foreground')}>
                  {format(date, 'd')}
                </div>
                {dayWorkouts.length > 0 && (
                  <div className={cn('mt-1 space-y-0.5', today ? 'text-white/60' : 'text-muted-foreground')}>
                    <div className="text-[10px] font-semibold">
                      {dayWorkouts.filter(w => w.completed).length}/{dayWorkouts.length} done
                    </div>
                    {dayDuration > 0 && (
                      <div className="text-[10px]">{formatDurLong(dayDuration)}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Workout Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {dayWorkouts.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full opacity-15 gap-1">
                    <div className="text-2xl">🌿</div>
                    <span className="text-[11px] text-muted-foreground font-medium">Rest</span>
                  </div>
                )}

                {dayWorkouts.map(workout => {
                  const cfg = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
                  const typeData = getTypeData(workout);
                  const isMissed = past && !workout.completed;

                  return (
                    <Link key={workout.id} href={`/workouts/${workout.id}`}
                      className={cn(
                        'block rounded-xl border-l-4 p-3.5 transition-all hover:shadow-lg hover:scale-[1.01]',
                        'border bg-card',
                        cfg.border,
                        isMissed && 'border-red-400/40 bg-red-500/5',
                      )}
                    >
                      {/* Header: type badge + complete toggle */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider', cfg.bg, cfg.color)}>
                          <span>{cfg.emoji}</span>
                          {workout.type}
                        </div>
                        <button
                          onClick={(e) => handleToggleComplete(e, workout)}
                          className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                          title={workout.completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                          {workout.completed
                            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                            : <Circle className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </div>

                      {/* Workout name */}
                      <h3 className="text-[13px] font-bold leading-snug line-clamp-2">{workout.name}</h3>

                      {/* Duration + Distance */}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0 opacity-50" />
                          <span className="font-semibold text-foreground/80">{typeData.duration || '0:00'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Route className="h-3 w-3 shrink-0 opacity-50" />
                          <span className="font-semibold text-foreground/80">{typeData.distance || '0 km'}</span>
                        </div>
                      </div>

                      {/* Status */}
                      {(isMissed || workout.completed) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {isMissed && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-red-600 bg-red-500/10">Missed</span>
                          )}
                          {workout.completed && workout.completedLate && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-600 bg-amber-500/10">Late</span>
                          )}
                          {workout.completed && !workout.completedLate && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-green-600 bg-green-500/10">✓ Done</span>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
