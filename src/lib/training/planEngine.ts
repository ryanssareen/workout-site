/**
 * Training Plan Logic Engine
 * 
 * Deterministic scheduling: picks dates, types, intensity, duration
 * based on user profile, history, and periodization principles.
 * AI fills in names/descriptions/specs on top of these skeletons.
 */

import { addDays, startOfTomorrow, getDay } from 'date-fns';

type WorkoutType = 'run' | 'swim' | 'bike' | 'strength' | 'other';
type Intensity = 'easy' | 'moderate' | 'hard' | 'recovery';

export interface WorkoutSkeleton {
  date: string; // ISO date string YYYY-MM-DD
  type: WorkoutType;
  intensity: Intensity;
  durationMinutes: number;
  tags: string[];
  focus: string; // e.g. "tempo", "long run", "intervals", "technique"
  isKeyWorkout: boolean;
}

export interface UserProfile {
  sportPreferences?: string[];
  trainingFor?: string[];
  eventDate?: string;
  experienceLevel?: string;
  weeklyAvailability?: string;
  ageRange?: string;
}

export interface WorkoutHistoryItem {
  type: string;
  date: string;
  completed: boolean;
  duration?: number;
  tags?: string[];
  run?: { distance?: number; distanceUnit?: string; time?: number };
  bike?: { distance?: number; distanceUnit?: string; time?: number };
  swim?: { distance?: number; distanceUnit?: string; time?: number };
  strength?: { exercises?: { name: string }[]; totalTime?: number };
}

// ── CONSTANTS ──────────────────────────────────────────────────────

const SPORT_TO_TYPE: Record<string, WorkoutType> = {
  Running: 'run',
  Swimming: 'swim',
  Biking: 'bike',
  Ironman: 'run', // multi-sport, will rotate
};

const EXPERIENCE_MULTIPLIER: Record<string, number> = {
  Beginner: 0.7,
  Intermediate: 1.0,
  Advanced: 1.3,
};

const AVAILABILITY_TO_DAYS: Record<string, number> = {
  '1–2 days': 2,
  '3–4 days': 4,
  '5–6 days': 5,
  '7 days': 6, // always 1 rest day
};

const INTENSITY_PATTERNS: Record<number, Intensity[]> = {
  2: ['moderate', 'easy'],
  3: ['moderate', 'hard', 'easy'],
  4: ['easy', 'hard', 'moderate', 'easy'],
  5: ['easy', 'hard', 'moderate', 'easy', 'moderate'],
  6: ['easy', 'hard', 'moderate', 'easy', 'moderate', 'recovery'],
};

const FOCUS_BY_INTENSITY: Record<Intensity, string[]> = {
  easy: ['base endurance', 'technique', 'aerobic base', 'zone 2'],
  moderate: ['tempo', 'threshold', 'steady state', 'sweet spot'],
  hard: ['intervals', 'VO2max', 'hill repeats', 'speed work'],
  recovery: ['active recovery', 'mobility', 'cross-training'],
};

const BASE_DURATION: Record<WorkoutType, Record<Intensity, number>> = {
  run:      { easy: 40, moderate: 50, hard: 45, recovery: 30 },
  swim:     { easy: 45, moderate: 55, hard: 50, recovery: 30 },
  bike:     { easy: 60, moderate: 75, hard: 60, recovery: 40 },
  strength: { easy: 40, moderate: 50, hard: 55, recovery: 30 },
  other:    { easy: 30, moderate: 40, hard: 45, recovery: 25 },
};

// ── HELPERS ────────────────────────────────────────────────────────

function parseAvailability(avail?: string): number {
  if (!avail) return 3;
  return AVAILABILITY_TO_DAYS[avail] ?? 3;
}

function getExperienceMultiplier(level?: string): number {
  if (!level) return 1.0;
  return EXPERIENCE_MULTIPLIER[level] ?? 1.0;
}

function getSportTypes(prefs?: string[]): WorkoutType[] {
  if (!prefs || prefs.length === 0) return ['run'];

  const types: WorkoutType[] = [];
  const isIronman = prefs.includes('Ironman');

  if (isIronman) {
    // Ironman athletes get all three disciplines
    return ['run', 'bike', 'swim'];
  }

  for (const sport of prefs) {
    const t = SPORT_TO_TYPE[sport];
    if (t && !types.includes(t)) types.push(t);
  }

  return types.length > 0 ? types : ['run'];
}

function getWeeksToEvent(eventDate?: string): number | null {
  if (!eventDate) return null;
  const diff = new Date(eventDate).getTime() - Date.now();
  return Math.max(1, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
}

function pickTrainingDays(count: number): number[] {
  // Return day-of-week indices (0=Sun, 1=Mon...) that space workouts well
  const patterns: Record<number, number[]> = {
    2: [2, 5],           // Tue, Fri
    3: [1, 3, 5],        // Mon, Wed, Fri
    4: [1, 2, 4, 6],     // Mon, Tue, Thu, Sat
    5: [1, 2, 3, 5, 6],  // Mon-Wed, Fri-Sat
    6: [1, 2, 3, 4, 5, 6], // Mon-Sat
  };
  return patterns[count] ?? patterns[3];
}

function mapDaysToDate(dayIndices: number[]): string[] {
  const tomorrow = startOfTomorrow();
  const todayDow = getDay(tomorrow);
  const dates: string[] = [];

  for (const targetDow of dayIndices) {
    let daysAhead = targetDow - todayDow;
    if (daysAhead <= 0) daysAhead += 7;
    const d = addDays(tomorrow, daysAhead);
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates.sort();
}

function analyzeHistory(history: WorkoutHistoryItem[]): {
  recentTypes: Record<string, number>;
  avgDuration: number;
  completionRate: number;
  lastHardDay: string | null;
  totalRecent: number;
  weeklyVolume: number;
} {
  if (!history || history.length === 0) {
    return { recentTypes: {}, avgDuration: 0, completionRate: 0, lastHardDay: null, totalRecent: 0, weeklyVolume: 0 };
  }

  const recentTypes: Record<string, number> = {};
  let totalDur = 0;
  let durCount = 0;
  let completed = 0;
  let lastHardDay: string | null = null;

  for (const w of history) {
    recentTypes[w.type] = (recentTypes[w.type] || 0) + 1;
    if (w.completed) completed++;

    const dur = w.duration || w.run?.time || w.bike?.time || w.swim?.time || w.strength?.totalTime;
    if (dur) { totalDur += dur; durCount++; }

    if (w.tags?.some(t => t === 'hard' || t === 'intervals' || t === 'speed')) {
      if (!lastHardDay || w.date > lastHardDay) lastHardDay = w.date;
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentCount = history.filter(w => w.date >= thirtyDaysAgo).length;
  const weeklyVolume = recentCount > 0 ? Math.round((recentCount / 4.3) * 10) / 10 : 0;

  return {
    recentTypes,
    avgDuration: durCount > 0 ? Math.round(totalDur / durCount) : 45,
    completionRate: Math.round((completed / history.length) * 100),
    lastHardDay,
    totalRecent: recentCount,
    weeklyVolume,
  };
}

// ── MAIN ENGINE ────────────────────────────────────────────────────

export function generatePlanSkeletons(
  profile: UserProfile,
  history: WorkoutHistoryItem[]
): WorkoutSkeleton[] {
  const daysPerWeek = parseAvailability(profile.weeklyAvailability);
  const expMult = getExperienceMultiplier(profile.experienceLevel);
  const sportTypes = getSportTypes(profile.sportPreferences);
  const weeksToEvent = getWeeksToEvent(profile.eventDate);
  const stats = analyzeHistory(history);

  // Pick training days and map to actual dates
  const dayIndices = pickTrainingDays(daysPerWeek);
  const dates = mapDaysToDate(dayIndices);

  // Get intensity pattern
  const intensities = INTENSITY_PATTERNS[daysPerWeek] ?? INTENSITY_PATTERNS[3];

  // If close to event, shift intensity distribution
  let adjustedIntensities = [...intensities];
  if (weeksToEvent !== null) {
    if (weeksToEvent <= 2) {
      // Taper: mostly easy/recovery
      adjustedIntensities = adjustedIntensities.map(i => i === 'hard' ? 'moderate' : i === 'moderate' ? 'easy' : i);
    } else if (weeksToEvent <= 4) {
      // Peak: more hard sessions
      adjustedIntensities = adjustedIntensities.map((i, idx) => idx === 0 ? 'moderate' : i);
    }
  }

  // If completion rate is low, dial back intensity
  if (stats.completionRate > 0 && stats.completionRate < 60) {
    adjustedIntensities = adjustedIntensities.map(i => i === 'hard' ? 'moderate' : i);
  }

  // Build skeletons
  const skeletons: WorkoutSkeleton[] = [];

  for (let i = 0; i < dates.length; i++) {
    const intensity = adjustedIntensities[i % adjustedIntensities.length];

    // Rotate sport types, but ensure variety
    let typeIdx = i % sportTypes.length;
    // If only 1 sport, add strength on some days
    let type = sportTypes[typeIdx];
    if (sportTypes.length === 1 && intensity === 'recovery') {
      type = 'strength';
    }
    if (sportTypes.length === 1 && i > 2 && i % 3 === 0) {
      type = 'strength';
    }

    // Under-represented types get priority
    const histCount = stats.recentTypes[type] || 0;
    const underRep = sportTypes.find(t => (stats.recentTypes[t] || 0) < histCount);
    if (underRep && i > 0 && Math.random() < 0.4) {
      type = underRep;
    }

    // Duration scaled by experience
    const baseDur = BASE_DURATION[type]?.[intensity] ?? 45;
    const durationMinutes = Math.round(baseDur * expMult);

    // Pick focus
    const focusOptions = FOCUS_BY_INTENSITY[intensity];
    const focus = focusOptions[i % focusOptions.length];

    // Tags
    const tags: string[] = [intensity];
    if (intensity === 'hard') tags.push('intervals');
    if (intensity === 'easy' && durationMinutes > 50) tags.push('long');
    if (focus.includes('tempo')) tags.push('tempo');
    if (focus.includes('technique')) tags.push('technique');

    skeletons.push({
      date: dates[i],
      type,
      intensity,
      durationMinutes,
      tags,
      focus,
      isKeyWorkout: intensity === 'hard',
    });
  }

  return skeletons;
}
