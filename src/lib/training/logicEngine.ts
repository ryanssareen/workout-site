/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC ENGINE — deterministic training plan generation
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  AthleteProfile, WorkoutType, Intensity, TrainingPhase, PlannedWorkout,
  LogicOutput, HistorySummary, PlanConstraints,
  EXPERIENCE_MULTIPLIER, AVAILABILITY_DAYS, DEFAULT_PACES,
  INTENSITY_LOAD_MULTIPLIER, PHASE_RULES,
  computeSessionLoad, getTrainingPhase, buildConstraints,
} from './constraints';

/* ── Helpers ──────────────────────────────────────────────────────────── */

function parseAvailability(avail?: string): number {
  return AVAILABILITY_DAYS[avail || ''] || 3;
}

function getExpMultiplier(level?: string): number {
  return EXPERIENCE_MULTIPLIER[level || ''] || 1.0;
}

function sportToType(sport: string): WorkoutType {
  const l = sport.toLowerCase();
  if (l.includes('run')) return 'run';
  if (l.includes('swim')) return 'swim';
  if (l.includes('bik') || l.includes('cycl')) return 'bike';
  if (l.includes('ironman') || l.includes('triath')) return 'run';
  if (l.includes('strength')) return 'strength';
  return 'other';
}

/* ── History Analysis (recency-weighted) ──────────────────────────────── */

export function analyzeHistory(workouts: any[], experienceLevel?: string): HistorySummary {
  const typeCounts: Record<string, number> = {};
  const weightedDurations: number[] = [];
  const weightedDistances: Record<string, number[]> = {};
  const pacesByType: Record<string, number[]> = {};
  let completedCount = 0;
  let recentWeekLoad = 0;
  const dates: Date[] = [];
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;

  const total = (workouts || []).length;

  (workouts || []).forEach((w: any, idx: number) => {
    if (!w) return;
    const recencyWeight = total > 1 ? 0.4 + 0.6 * ((total - idx) / total) : 1.0;

    typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
    if (w.completed) completedCount++;

    const dur = w.duration ?? w.run?.time ?? w.bike?.time ?? w.swim?.time ?? w.strength?.totalTime ?? w.other?.duration;
    if (typeof dur === 'number') weightedDurations.push(dur * recencyWeight);

    // Distances + paces
    const trackDist = (type: string, dist: number, time: number | undefined) => {
      (weightedDistances[type] = weightedDistances[type] || []).push(dist * recencyWeight);
      if (time && dist > 0) {
        (pacesByType[type] = pacesByType[type] || []).push(time / dist);
      }
    };

    if (w.type === 'run' && w.run?.distance) trackDist('run', w.run.distance, w.run.time);
    if (w.type === 'bike' && w.bike?.distance) trackDist('bike', w.bike.distance, w.bike.time);
    if (w.type === 'swim' && w.swim?.distance) trackDist('swim', w.swim.distance, w.swim.time);

    // Fatigue: 7-day load
    const tags = Array.isArray(w.tags) ? w.tags : [];
    const intensityTag = (['hard', 'moderate', 'easy'] as const).find((t) => tags.includes(t)) || 'moderate';
    const sessionLoad = computeSessionLoad(typeof dur === 'number' ? dur : 30, intensityTag);

    const d = w.date ? new Date(w.date) : null;
    if (d && !isNaN(d.getTime())) {
      dates.push(d);
      if (d.getTime() >= sevenDaysAgo) recentWeekLoad += sessionLoad;
    }
  });

  const avgDuration = weightedDurations.length > 0
    ? Math.round(weightedDurations.reduce((a, b) => a + b, 0) / weightedDurations.length)
    : 45;

  const avgDistances: Record<string, number> = {};
  for (const [type, dists] of Object.entries(weightedDistances)) {
    avgDistances[type] = dists.reduce((a, b) => a + b, 0) / dists.length;
  }

  // Paces: use historical if available, else fall back to experience-based defaults
  const avgPaces: Record<string, number> = {};
  const defaults = DEFAULT_PACES[experienceLevel || ''] || DEFAULT_PACES.Intermediate;
  for (const type of ['run', 'swim', 'bike']) {
    if (pacesByType[type]?.length) {
      avgPaces[type] = pacesByType[type].reduce((a, b) => a + b, 0) / pacesByType[type].length;
    } else {
      avgPaces[type] = defaults[type];
    }
  }

  const sortedDates = dates.sort((a, b) => b.getTime() - a.getTime());
  const lastWorkoutDate = sortedDates[0] || null;
  const daysSinceLast = lastWorkoutDate ? Math.round((now - lastWorkoutDate.getTime()) / 86400000) : 14;
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return {
    totalWorkouts: total,
    completedRate: completionRate,
    avgDuration,
    avgDistances,
    avgPaces,
    daysSinceLast,
    typeCounts,
    recentWeekLoad,
  };
}

/* ── Fatigue State ────────────────────────────────────────────────────── */

function getFatigueState(recentWeekLoad: number, avgDuration: number): 'fresh' | 'loaded' | 'fatigued' {
  const threshold = avgDuration * 5;
  if (recentWeekLoad > threshold * 1.2) return 'fatigued';
  if (recentWeekLoad > threshold * 0.8) return 'loaded';
  return 'fresh';
}

/* ── Progressive Overload with Guardrails ─────────────────────────────── */

function getProgressionRate(completionRate: number, phase: TrainingPhase): number {
  if (completionRate < 60) return 0.95;
  if (completionRate < 80) return 1.0;
  if (phase === 'taper' || phase === 'recovery') return 0.9;
  if (phase === 'base') return 1.05;
  if (phase === 'peak') return 1.08;
  return 1.06;
}

function shouldDeload(totalWorkouts: number): boolean {
  return totalWorkouts > 0 && totalWorkouts % 12 < 3;
}

/* ── Schedule Dates ───────────────────────────────────────────────────── */

function getNextDates(count: number, availDays: number): string[] {
  const dates: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const gap = Math.max(1, Math.round(7 / availDays));
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + gap);
  }
  return dates;
}

/* ── Type Selection ───────────────────────────────────────────────────── */

function pickTypes(sports: string[], history: HistorySummary, count: number): WorkoutType[] {
  let pool: WorkoutType[] = [];
  for (const s of sports) {
    const l = s.toLowerCase();
    if (l.includes('ironman') || l.includes('triath')) {
      pool.push('run', 'swim', 'bike');
    } else {
      pool.push(sportToType(s));
    }
  }
  pool = [...new Set(pool)];
  if (pool.length === 1) pool.push('strength');

  const sorted = pool.sort((a, b) => (history.typeCounts[a] || 0) - (history.typeCounts[b] || 0));
  const result: WorkoutType[] = [];
  for (let i = 0; i < count; i++) {
    result.push(sorted[i % sorted.length]);
  }
  return result;
}

/* ── Intensity Selection ──────────────────────────────────────────────── */

function pickIntensities(
  count: number,
  daysSinceLast: number,
  phase: TrainingPhase,
  fatigueState: 'fresh' | 'loaded' | 'fatigued'
): Intensity[] {
  if (fatigueState === 'fatigued' || daysSinceLast >= 7) {
    const base: Intensity[] = ['easy', 'moderate', 'easy'];
    return base.slice(0, count);
  }

  const patterns: Record<TrainingPhase, Intensity[]> = {
    taper:    ['easy', 'moderate', 'easy'],
    recovery: ['easy', 'easy', 'moderate'],
    base:     ['moderate', 'easy', 'moderate'],
    build:    ['moderate', 'hard', 'easy'],
    peak:     ['hard', 'moderate', 'hard'],
    general:  ['moderate', 'hard', 'easy'],
  };

  // Enforce phase rules: filter out disallowed intensities
  const allowed = PHASE_RULES[phase].allowedIntensities;
  const pattern = (patterns[phase] || patterns.general).map((i) =>
    allowed.includes(i) ? i : allowed[allowed.length - 1]
  );

  return pattern.slice(0, count);
}

/* ── Spec Builder (pace-consistent) ───────────────────────────────────── */

function buildSpecs(
  type: WorkoutType,
  intensity: Intensity,
  exp: number,
  avgDist: Record<string, number>,
  avgPaces: Record<string, number>,
  progressionRate: number,
  volumeMult: number,
  deload: boolean
): { durationMin: number; specs: Record<string, any> } {
  const deloadMult = deload ? 0.7 : 1.0;
  const intensityMult = intensity === 'easy' ? 0.8 : intensity === 'hard' ? 1.2 : 1.0;
  const totalMult = progressionRate * volumeMult * deloadMult;

  switch (type) {
    case 'run': {
      const dist = Math.round((avgDist['run'] || 5) * totalMult * intensityMult * 10) / 10;
      const pace = avgPaces['run'] || 6;
      const paceAdj = intensity === 'easy' ? 1.1 : intensity === 'hard' ? 0.95 : 1.0;
      const time = Math.round(dist * pace * paceAdj) || 45;
      return { durationMin: time, specs: { run: { distance: dist, distanceUnit: 'km', time, terrain: intensity === 'hard' ? 'track' : 'road', elevationGain: intensity === 'hard' ? Math.round(100 * exp) : 0 } } };
    }
    case 'swim': {
      const dist = Math.round((avgDist['swim'] || 1500) * totalMult * intensityMult);
      const pace = avgPaces['swim'] || 0.025;
      const time = Math.round(dist * pace * (intensity === 'easy' ? 1.1 : 1.0)) || 40;
      return { durationMin: time, specs: { swim: { distance: dist, distanceUnit: 'meters', time, strokeType: 'freestyle', poolLength: 25 } } };
    }
    case 'bike': {
      const dist = Math.round((avgDist['bike'] || 25) * totalMult * intensityMult * 10) / 10;
      const pace = avgPaces['bike'] || 2.4;
      const paceAdj = intensity === 'easy' ? 1.1 : intensity === 'hard' ? 0.95 : 1.0;
      const time = Math.round(dist * pace * paceAdj) || 60;
      return { durationMin: time, specs: { bike: { distance: dist, distanceUnit: 'km', time, avgCadence: intensity === 'hard' ? 90 : 80, elevationGain: intensity === 'hard' ? Math.round(400 * exp) : Math.round(100 * exp) } } };
    }
    case 'strength': {
      const time = Math.round(45 * exp * intensityMult * deloadMult) || 45;
      return { durationMin: time, specs: { strength: { totalTime: time, rpe: intensity === 'easy' ? 5 : intensity === 'hard' ? 8 : 6, exercises: [] } } };
    }
    default: {
      const time = Math.round(40 * exp * deloadMult) || 40;
      return { durationMin: time, specs: { other: { duration: time, description: '' } } };
    }
  }
}

/* ── Core Logic Engine ────────────────────────────────────────────────── */

export function generateLogicOutput(profile: AthleteProfile, workouts: any[]): LogicOutput {
  const history = analyzeHistory(workouts, profile.experienceLevel);
  const exp = getExpMultiplier(profile.experienceLevel);
  const availDays = parseAvailability(profile.weeklyAvailability);
  const sports = profile.sportPreferences || ['Running'];
  const count = 3;

  const { phase, weeksOut } = getTrainingPhase(profile.eventDate);
  const volumeMult = PHASE_RULES[phase].volumeMultiplier;
  const progressionRate = getProgressionRate(history.completedRate, phase);
  const deload = shouldDeload(history.totalWorkouts);
  const fatigueState = getFatigueState(history.recentWeekLoad, history.avgDuration);

  const constraints = buildConstraints(phase, history.avgDuration, availDays);
  const dates = getNextDates(count, availDays);
  const types = pickTypes(sports, history, count);
  const intensities = pickIntensities(count, history.daysSinceLast, phase, fatigueState);

  const focusMap: Record<string, Record<string, string>> = {
    easy:     { run: 'recovery / base building', swim: 'technique / easy aerobic', bike: 'easy spin / active recovery', strength: 'mobility / activation', other: 'cross-training' },
    moderate: { run: 'tempo / threshold', swim: 'aerobic endurance', bike: 'endurance / tempo', strength: 'hypertrophy / strength', other: 'moderate effort' },
    hard:     { run: 'intervals / VO2max', swim: 'sprint sets / race pace', bike: 'hill repeats / power intervals', strength: 'max effort / heavy lifts', other: 'high intensity' },
  };

  const plan: PlannedWorkout[] = [];
  for (let i = 0; i < count; i++) {
    const { durationMin, specs } = buildSpecs(
      types[i], intensities[i], exp,
      history.avgDistances, history.avgPaces,
      progressionRate, volumeMult, deload
    );
    const sessionLoad = computeSessionLoad(durationMin, intensities[i]);

    plan.push({
      type: types[i],
      date: dates[i],
      intensity: intensities[i],
      focus: focusMap[intensities[i]]?.[types[i]] || 'general fitness',
      durationMin,
      sessionLoad,
      specs,
    });
  }

  return {
    athlete: {
      profile,
      historySummary: history,
      phase,
      weeksOut,
      fatigueState,
      deload,
    },
    constraints,
    plan,
  };
}
