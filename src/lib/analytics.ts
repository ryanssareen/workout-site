import { Workout, WorkoutType } from '@/types';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subMonths, subWeeks, subDays, format, differenceInMinutes,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  isSameDay, getDay, isWithinInterval,
} from 'date-fns';

// ── Time range filter ──
export type TimeRange = 'ALL' | '1Y' | '6M' | '3M' | '1M' | 'MO' | 'WK';

export function getTimeRangeStart(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case 'ALL': return null;
    case '1Y': return subMonths(now, 12);
    case '6M': return subMonths(now, 6);
    case '3M': return subMonths(now, 3);
    case '1M': return subMonths(now, 1);
    case 'MO': return startOfMonth(now);
    case 'WK': return subWeeks(now, 1);
  }
}

export function filterByTimeRange(workouts: Workout[], range: TimeRange): Workout[] {
  const start = getTimeRangeStart(range);
  if (!start) return workouts;
  return workouts.filter(w => {
    try {
      const d = w.date?.toDate?.() ?? new Date(w.date as any);
      return !isNaN(d.getTime()) && d >= start;
    } catch { return false; }
  });
}

function toDate(w: Workout): Date {
  try {
    const d = w.date?.toDate?.() ?? new Date(w.date as any);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch { return new Date(0); }
}

// ── Summary stats ──
export interface SummaryStats {
  totalWorkouts: number;
  completedWorkouts: number;
  totalDistanceKm: number;
  totalHours: number;
  avgDurationMin: number;
  completionRate: number;
  totalCalories: number;
  currentStreak: number;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
}

export function computeSummary(workouts: Workout[]): SummaryStats {
  const completed = workouts.filter(w => w.completed);
  let totalDistanceM = 0;
  let totalDurationSec = 0;
  let totalCalories = 0;
  let totalVolumeKg = 0;
  let totalSets = 0;
  let totalReps = 0;

  for (const w of workouts) {
    if (w.actualStats?.distance) totalDistanceM += w.actualStats.distance;
    if (w.actualStats?.duration) totalDurationSec += w.actualStats.duration;
    else if (w.duration) totalDurationSec += w.duration * 60;
    if (w.actualStats?.calories) totalCalories += w.actualStats.calories;
    // Strength volume
    if (w.strength?.exercises) {
      for (const ex of w.strength.exercises) {
        const sets = ex.sets || 0;
        const reps = ex.reps || 0;
        const weight = ex.weight || 0;
        const weightKg = ex.weightUnit === 'lbs' ? weight * 0.453592 : weight;
        totalVolumeKg += sets * reps * weightKg;
        totalSets += sets;
        totalReps += sets * reps;
      }
    }
  }

  // Compute current streak (consecutive days with completed workouts going back from today)
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const completedDates = completed
    .map(w => toDate(w))
    .sort((a, b) => b.getTime() - a.getTime());

  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  // Allow today or yesterday as start
  const hasToday = completedDates.some(d => isSameDay(d, checkDate));
  if (!hasToday) {
    checkDate = subDays(checkDate, 1);
    const hasYesterday = completedDates.some(d => isSameDay(d, checkDate));
    if (!hasYesterday) return buildSummary(0);
  }

  while (completedDates.some(d => isSameDay(d, checkDate))) {
    streak++;
    checkDate = subDays(checkDate, 1);
  }

  function buildSummary(s: number): SummaryStats {
    return {
      totalWorkouts: workouts.length,
      completedWorkouts: completed.length,
      totalDistanceKm: totalDistanceM / 1000,
      totalHours: totalDurationSec / 3600,
      avgDurationMin: workouts.length > 0 ? totalDurationSec / 60 / workouts.length : 0,
      completionRate: workouts.length > 0 ? (completed.length / workouts.length) * 100 : 0,
      totalCalories,
      currentStreak: s,
      totalVolumeKg,
      totalSets,
      totalReps,
    };
  }

  return buildSummary(streak);
}

// ── Time series data ──
export interface TimePoint {
  label: string;
  date: Date;
  hours: number;
  distanceKm: number;
  workoutCount: number;
  calories: number;
  volumeKg: number;
  totalSets: number;
  totalReps: number;
}

export function computeTimeSeries(workouts: Workout[], range: TimeRange): TimePoint[] {
  if (workouts.length === 0) return [];

  const now = new Date();
  const start = getTimeRangeStart(range) ?? new Date(Math.min(...workouts.map(w => toDate(w).getTime())));

  // Choose bucketing: weekly for > 2 months, daily for <= 2 months
  const diffDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const useMonthly = diffDays > 180;
  const useWeekly = diffDays > 60;

  let intervals: { start: Date; end: Date; label: string }[];

  if (useMonthly) {
    const months = eachMonthOfInterval({ start, end: now });
    intervals = months.map(m => ({
      start: startOfMonth(m),
      end: endOfMonth(m),
      label: format(m, 'MMM yyyy'),
    }));
  } else if (useWeekly) {
    const weeks = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 });
    intervals = weeks.map(w => ({
      start: startOfWeek(w, { weekStartsOn: 1 }),
      end: endOfWeek(w, { weekStartsOn: 1 }),
      label: format(w, 'MMM d'),
    }));
  } else {
    const days = eachDayOfInterval({ start, end: now });
    intervals = days.map(d => ({
      start: new Date(d.setHours(0, 0, 0, 0)),
      end: new Date(new Date(d).setHours(23, 59, 59, 999)),
      label: format(d, 'MMM d'),
    }));
  }

  return intervals.map(interval => {
    const bucket = workouts.filter(w => {
      const d = toDate(w);
      return isWithinInterval(d, { start: interval.start, end: interval.end });
    });

    let hours = 0, distanceKm = 0, calories = 0, volumeKg = 0, totalSets = 0, totalReps = 0;
    for (const w of bucket) {
      if (w.actualStats?.duration) hours += w.actualStats.duration / 3600;
      else if (w.duration) hours += w.duration / 60;
      if (w.actualStats?.distance) distanceKm += w.actualStats.distance / 1000;
      if (w.actualStats?.calories) calories += w.actualStats.calories;
      if (w.strength?.exercises) {
        for (const ex of w.strength.exercises) {
          const s = ex.sets || 0;
          const r = ex.reps || 0;
          const wt = ex.weight || 0;
          const wtKg = ex.weightUnit === 'lbs' ? wt * 0.453592 : wt;
          volumeKg += s * r * wtKg;
          totalSets += s;
          totalReps += s * r;
        }
      }
    }

    return {
      label: interval.label,
      date: interval.start,
      hours: Math.round(hours * 100) / 100,
      distanceKm: Math.round(distanceKm * 100) / 100,
      workoutCount: bucket.length,
      calories: Math.round(calories),
      volumeKg: Math.round(volumeKg * 10) / 10,
      totalSets,
      totalReps,
    };
  });
}

// ── Type distribution ──
export interface TypeDistribution {
  type: WorkoutType;
  count: number;
  percentage: number;
  color: string;
}

const TYPE_COLORS: Record<string, string> = {
  swim: '#3b82f6',
  run: '#22c55e',
  walk: '#10b981',
  bike: '#f97316',
  strength: '#a855f7',
  other: '#6b7280',
};

export function computeTypeDistribution(workouts: Workout[]): TypeDistribution[] {
  const counts: Record<string, number> = {};
  for (const w of workouts) {
    counts[w.type] = (counts[w.type] || 0) + 1;
  }

  const total = workouts.length || 1;
  return Object.entries(counts)
    .map(([type, count]) => ({
      type: type as WorkoutType,
      count,
      percentage: Math.round((count / total) * 100),
      color: TYPE_COLORS[type] || '#6b7280',
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Weekly rhythm (radar data) ──
export interface WeekdayData {
  day: string;
  count: number;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function computeWeeklyRhythm(workouts: Workout[]): WeekdayData[] {
  const counts = new Array(7).fill(0);
  for (const w of workouts) {
    const dayIdx = getDay(toDate(w));
    counts[dayIdx]++;
  }
  return DAY_NAMES.map((day, i) => ({ day, count: counts[i] }));
}

// ── Monthly calendar heatmap ──
export interface CalendarDay {
  date: Date;
  count: number;
}

export function computeCalendarData(workouts: Workout[], months: number = 12): CalendarDay[] {
  const start = subMonths(new Date(), months);
  const days = eachDayOfInterval({ start, end: new Date() });

  const countMap = new Map<string, number>();
  for (const w of workouts) {
    const d = toDate(w);
    if (d >= start) {
      const key = format(d, 'yyyy-MM-dd');
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }
  }

  return days.map(d => ({
    date: d,
    count: countMap.get(format(d, 'yyyy-MM-dd')) || 0,
  }));
}

// ── Activity insights ──
export interface ActivityInsights {
  mostActiveType: { type: string; count: number } | null;
  longestWorkout: { name: string; durationMin: number; date: Date } | null;
  avgDistanceKm: number;
  totalElevationGain: number;
  avgHeartRate: number | null;
}

export function computeInsights(workouts: Workout[]): ActivityInsights {
  // Most active type
  const typeCounts: Record<string, number> = {};
  for (const w of workouts) {
    typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
  }
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const mostActiveType = sortedTypes.length > 0
    ? { type: sortedTypes[0][0], count: sortedTypes[0][1] }
    : null;

  // Longest workout
  let longest: { name: string; durationMin: number; date: Date } | null = null;
  for (const w of workouts) {
    const dur = w.actualStats?.duration
      ? w.actualStats.duration / 60
      : w.duration || 0;
    if (!longest || dur > longest.durationMin) {
      longest = { name: w.name, durationMin: Math.round(dur), date: toDate(w) };
    }
  }

  // Avg distance
  const withDistance = workouts.filter(w => w.actualStats?.distance);
  const avgDistanceKm = withDistance.length > 0
    ? withDistance.reduce((sum, w) => sum + (w.actualStats!.distance! / 1000), 0) / withDistance.length
    : 0;

  // Total elevation
  const totalElevationGain = workouts.reduce(
    (sum, w) => sum + (w.actualStats?.elevationGain || 0), 0
  );

  // Avg heart rate
  const withHR = workouts.filter(w => w.actualStats?.avgHeartRate);
  const avgHeartRate = withHR.length > 0
    ? Math.round(withHR.reduce((sum, w) => sum + w.actualStats!.avgHeartRate!, 0) / withHR.length)
    : null;

  return { mostActiveType, longestWorkout: longest, avgDistanceKm, totalElevationGain, avgHeartRate };
}

// ── PRs over time ──
export interface PRPoint {
  label: string;
  date: Date;
  count: number;
  prs: { exerciseName: string; newValue: number; unit: string }[];
}

export function computePRTimeline(workouts: Workout[], range: TimeRange): PRPoint[] {
  const withPRs = workouts.filter(w => w.prs && w.prs.length > 0);
  if (withPRs.length === 0) return [];

  const now = new Date();
  const start = getTimeRangeStart(range) ?? new Date(Math.min(...withPRs.map(w => toDate(w).getTime())));
  const diffDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const useMonthly = diffDays > 180;
  const useWeekly = diffDays > 60;

  let intervals: { start: Date; end: Date; label: string }[];
  if (useMonthly) {
    const months = eachMonthOfInterval({ start, end: now });
    intervals = months.map(m => ({ start: startOfMonth(m), end: endOfMonth(m), label: format(m, 'MMM yyyy') }));
  } else if (useWeekly) {
    const weeks = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 });
    intervals = weeks.map(w => ({ start: startOfWeek(w, { weekStartsOn: 1 }), end: endOfWeek(w, { weekStartsOn: 1 }), label: format(w, 'MMM d') }));
  } else {
    const days = eachDayOfInterval({ start, end: now });
    intervals = days.map(d => ({ start: new Date(d.setHours(0, 0, 0, 0)), end: new Date(new Date(d).setHours(23, 59, 59, 999)), label: format(d, 'MMM d') }));
  }

  return intervals.map(interval => {
    const bucket = withPRs.filter(w => {
      const d = toDate(w);
      return isWithinInterval(d, { start: interval.start, end: interval.end });
    });
    const allPRs = bucket.flatMap(w => w.prs || []);
    return {
      label: interval.label,
      date: interval.start,
      count: allPRs.length,
      prs: allPRs.map(p => ({ exerciseName: p.exerciseName, newValue: p.newValue, unit: p.unit })),
    };
  }).filter(p => p.count > 0); // Only points with PRs
}

// ── Duplicate detection ──
export interface DuplicateGroup {
  reason: string;
  workouts: Workout[];
}

// Normalize distance to meters from any workout format
function getDistanceMeters(w: Workout): number {
  if (w.actualStats?.distance) return w.actualStats.distance;
  if (w.type === 'run' && w.run?.distance) {
    const unit = w.run.distanceUnit || 'km';
    if (unit === 'miles') return w.run.distance * 1609.34;
    return w.run.distance * 1000; // km → m
  }
  if (w.type === 'bike' && w.bike?.distance) {
    const unit = w.bike.distanceUnit || 'km';
    if (unit === 'miles') return w.bike.distance * 1609.34;
    return w.bike.distance * 1000;
  }
  if (w.type === 'swim' && w.swim?.distance) {
    const unit = w.swim.distanceUnit || 'meters';
    if (unit === 'yards') return w.swim.distance * 0.9144;
    return w.swim.distance; // already meters
  }
  return 0;
}

// Normalize duration to seconds from any workout format
function getDurationSeconds(w: Workout): number {
  if (w.actualStats?.duration) return w.actualStats.duration;
  // Type-specific time fields are in minutes
  if (w.type === 'run' && w.run?.time) return w.run.time * 60;
  if (w.type === 'bike' && w.bike?.time) return w.bike.time * 60;
  if (w.type === 'swim' && w.swim?.time) return w.swim.time * 60;
  if (w.duration) return w.duration * 60;
  return 0;
}

export function detectDuplicates(workouts: Workout[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();

  // 1. Same stravaActivityId
  const byStravaId = new Map<string, Workout[]>();
  for (const w of workouts) {
    if (w.stravaActivityId) {
      const key = String(w.stravaActivityId);
      if (!byStravaId.has(key)) byStravaId.set(key, []);
      byStravaId.get(key)!.push(w);
    }
  }
  for (const [id, group] of byStravaId) {
    if (group.length > 1) {
      groups.push({ reason: `Same Strava Activity ID (${id})`, workouts: group });
      group.forEach(w => used.add(w.id));
    }
  }

  // 2a. Strava-to-Strava fuzzy duplicates (different activity IDs, same workout)
  // Catches re-synced activities with slightly different times/durations
  const remaining1 = workouts.filter(w => !used.has(w.id));
  const stravaWorkouts = remaining1.filter(w => w.source === 'strava');
  const manualWorkouts = remaining1.filter(w => w.source !== 'strava');

  for (let i = 0; i < stravaWorkouts.length; i++) {
    const a = stravaWorkouts[i];
    if (used.has(a.id)) continue;
    const matchGroup: Workout[] = [a];
    for (let j = i + 1; j < stravaWorkouts.length; j++) {
      const b = stravaWorkouts[j];
      if (used.has(b.id)) continue;
      if (a.type !== b.type || a.assignedTo !== b.assignedTo) continue;
      const dateA = toDate(a);
      const dateB = toDate(b);
      const minsDiff = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60);
      // Same type, same user, dates within 30 minutes
      if (minsDiff > 30) continue;
      // Check duration within 10 minutes (600 seconds)
      const durA = a.actualStats?.duration || (a.duration || 0) * 60;
      const durB = b.actualStats?.duration || (b.duration || 0) * 60;
      const durationClose = durA > 0 && durB > 0 && Math.abs(durA - durB) < 600;
      // Check distance within 5%
      const distA = a.actualStats?.distance || 0;
      const distB = b.actualStats?.distance || 0;
      const distanceClose = distA > 0 && distB > 0 && Math.abs(distA - distB) / Math.max(distA, distB) < 0.05;
      // Dates within 30 min is already suspicious; match if duration or distance also close,
      // OR if both have no distance/duration data (strength workouts)
      if (durationClose || distanceClose || (durA === 0 && durB === 0 && distA === 0 && distB === 0)) {
        matchGroup.push(b);
      }
    }
    if (matchGroup.length > 1) {
      groups.push({
        reason: `Strava duplicate: "${a.name}" on ${format(toDate(a), 'MMM d')} (${matchGroup.length} copies)`,
        workouts: matchGroup,
      });
      matchGroup.forEach(w => used.add(w.id));
    }
  }

  // 2b. Manual + Strava overlap (same type, same day — relaxed matching)
  for (const manual of manualWorkouts) {
    if (used.has(manual.id)) continue;
    for (const strava of stravaWorkouts) {
      if (used.has(strava.id)) continue;
      const dateM = toDate(manual);
      const dateS = toDate(strava);
      const hoursDiff = Math.abs(dateM.getTime() - dateS.getTime()) / (1000 * 60 * 60);
      if (manual.type === strava.type && manual.assignedTo === strava.assignedTo && hoursDiff < 24) {
        const durM = getDurationSeconds(manual);
        const durS = getDurationSeconds(strava);
        const durationClose = durM > 0 && durS > 0 && Math.abs(durM - durS) / Math.max(durM, durS) < 0.3;
        const distM = getDistanceMeters(manual);
        const distS = getDistanceMeters(strava);
        const distanceClose = distM > 0 && distS > 0 && Math.abs(distM - distS) / Math.max(distM, distS) < 0.15;
        // If same type + same day: match on duration/distance, OR if the manual entry has no stats at all (coach-assigned, just marked done)
        const manualNoStats = durM === 0 && distM === 0;
        if (durationClose || distanceClose || manualNoStats) {
          groups.push({
            reason: `Manual + Strava overlap: "${manual.name}" on ${format(dateM, 'MMM d')}`,
            workouts: [strava, manual], // Keep Strava (richer data) first
          });
          used.add(manual.id);
          used.add(strava.id);
          break;
        }
      }
    }
  }

  // 3. Same name + type + date within 24 hours + same user
  const remaining2 = workouts.filter(w => !used.has(w.id));
  for (let i = 0; i < remaining2.length; i++) {
    if (used.has(remaining2[i].id)) continue;
    const matches: Workout[] = [remaining2[i]];

    for (let j = i + 1; j < remaining2.length; j++) {
      if (used.has(remaining2[j].id)) continue;
      const a = remaining2[i];
      const b = remaining2[j];

      const dateA = toDate(a);
      const dateB = toDate(b);
      const hoursDiff = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60);

      const sameName = a.name.toLowerCase().trim() === b.name.toLowerCase().trim();
      const sameType = a.type === b.type;
      const sameUser = a.assignedTo === b.assignedTo;
      const closeDate = hoursDiff < 24;

      // Exact name + type + close date + same user
      if (sameName && sameType && sameUser && closeDate) {
        matches.push(b);
      }
      // Same type + very close date (< 2 hours) + similar duration
      else if (sameType && sameUser && hoursDiff < 2) {
        const durA = getDurationSeconds(a);
        const durB = getDurationSeconds(b);
        if (durA > 0 && durB > 0 && Math.abs(durA - durB) / Math.max(durA, durB) < 0.15) {
          matches.push(b);
        }
      }
      // Same distance (within 1%) + same day + same user (catches renamed Strava re-syncs)
      else if (sameUser && isSameDay(toDate(a), toDate(b))) {
        const distA = getDistanceMeters(a);
        const distB = getDistanceMeters(b);
        if (distA > 0 && distB > 0 && Math.abs(distA - distB) / Math.max(distA, distB) < 0.05) {
          matches.push(b);
        }
      }
    }

    if (matches.length > 1) {
      groups.push({
        reason: `Same "${remaining2[i].name}" on ${format(toDate(remaining2[i]), 'MMM d, yyyy')}`,
        workouts: matches,
      });
      matches.forEach(w => used.add(w.id));
    }
  }

  return groups;
}
