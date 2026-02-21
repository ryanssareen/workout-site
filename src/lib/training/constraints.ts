/* ═══════════════════════════════════════════════════════════════════════════
   CONSTRAINTS — single source of truth for all training rules
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Types ─────────────────────────────────────────────────────────────── */

export type WorkoutType = 'run' | 'swim' | 'bike' | 'strength' | 'other';
export type Intensity = 'easy' | 'moderate' | 'hard';
export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper' | 'recovery' | 'general';

export interface AthleteProfile {
  sportPreferences?: string[];
  fitnessGoals?: string[];
  trainingFor?: string[];
  experienceLevel?: string;
  ageRange?: string;
  eventDate?: string;
  weeklyAvailability?: string;
  bio?: string;
  timezone?: string;
}

export interface WorkoutSpec {
  distance?: number;
  distanceUnit?: string;
  time?: number;
  terrain?: string;
  elevationGain?: number;
  avgCadence?: number;
  strokeType?: string;
  poolLength?: number;
  totalTime?: number;
  rpe?: number;
  exercises?: any[];
  duration?: number;
  description?: string;
}

export interface PlannedWorkout {
  type: WorkoutType;
  date: string;
  intensity: Intensity;
  focus: string;
  durationMin: number;
  sessionLoad: number; // duration × intensity multiplier
  specs: Record<string, WorkoutSpec>;
}

export interface EnhancedWorkout extends PlannedWorkout {
  name: string;
  description: string;
  rationale: string;
  benefits: string[];
  tags: string[];
  warmup: string;
  mainSet: string;
  cooldown: string;
  sessionType: string;
  aiModified: boolean;
  changesCount: number;
  loadDeltaPercent: number;
}

export interface LogicOutput {
  athlete: {
    profile: AthleteProfile;
    historySummary: HistorySummary;
    phase: TrainingPhase;
    weeksOut: number | null;
    fatigueState: 'fresh' | 'loaded' | 'fatigued';
    deload: boolean;
  };
  constraints: PlanConstraints;
  plan: PlannedWorkout[];
}

export interface HistorySummary {
  totalWorkouts: number;
  completedRate: number;
  avgDuration: number;
  avgDistances: Record<string, number>;
  avgPaces: Record<string, number>;
  daysSinceLast: number;
  typeCounts: Record<string, number>;
  recentWeekLoad: number;
}

export interface PlanConstraints {
  maxSpecDeltaPercent: number;      // per-workout spec adjustment bound
  maxWeeklyLoadDeltaPercent: number; // total plan load drift
  maxSessionsModifiable: number;     // modification budget
  paceTolerancePercent: number;      // pace realism bound
  phaseRules: PhaseRules;
  deloadVolumeMax: number;           // max % of normal volume during deload
  weeklyLoadCeiling: number;         // absolute max weekly load
}

export interface PhaseRules {
  allowedIntensities: Intensity[];
  volumeMultiplier: number;
  description: string;
}

/* ── Constants ─────────────────────────────────────────────────────────── */

export const VALID_TAGS = new Set([
  'easy', 'moderate', 'hard', 'recovery', 'speed', 'endurance',
  'intervals', 'tempo', 'long', 'strength', 'technique', 'race',
]);

export const INTENSITY_LOAD_MULTIPLIER: Record<Intensity, number> = {
  easy: 0.6,
  moderate: 1.0,
  hard: 1.5,
};

export const EXPERIENCE_MULTIPLIER: Record<string, number> = {
  Beginner: 0.6,
  Intermediate: 1.0,
  Advanced: 1.4,
};

export const AVAILABILITY_DAYS: Record<string, number> = {
  '1–2 days': 2,
  '3–4 days': 3,
  '5–6 days': 5,
  '7 days': 6,
};

/** Default paces when history is insufficient */
export const DEFAULT_PACES: Record<string, Record<string, number>> = {
  Beginner:     { run: 7.5, swim: 0.033, bike: 3.0 },   // min/km, min/m, min/km
  Intermediate: { run: 6.0, swim: 0.025, bike: 2.4 },
  Advanced:     { run: 4.8, swim: 0.020, bike: 2.0 },
};

/* ── Phase Rules (centralized) ─────────────────────────────────────────── */

export const PHASE_RULES: Record<TrainingPhase, PhaseRules> = {
  taper:    { allowedIntensities: ['easy', 'moderate'],       volumeMultiplier: 0.6,  description: 'Reduce volume, maintain sharpness' },
  recovery: { allowedIntensities: ['easy'],                   volumeMultiplier: 0.5,  description: 'Active recovery only' },
  base:     { allowedIntensities: ['easy', 'moderate'],       volumeMultiplier: 0.85, description: 'Build aerobic base with volume' },
  build:    { allowedIntensities: ['easy', 'moderate', 'hard'], volumeMultiplier: 1.0,  description: 'Progressive load increase' },
  peak:     { allowedIntensities: ['easy', 'moderate', 'hard'], volumeMultiplier: 1.1,  description: 'Race-specific high intensity' },
  general:  { allowedIntensities: ['easy', 'moderate', 'hard'], volumeMultiplier: 1.0,  description: 'Balanced general fitness' },
};

/* ── Constraint Defaults ───────────────────────────────────────────────── */

export const DEFAULT_CONSTRAINTS: PlanConstraints = {
  maxSpecDeltaPercent: 15,
  maxWeeklyLoadDeltaPercent: 15,
  maxSessionsModifiable: 2,
  paceTolerancePercent: 30,
  phaseRules: PHASE_RULES.general,
  deloadVolumeMax: 80, // max 80% of normal
  weeklyLoadCeiling: 600, // minutes × intensity, adjustable per athlete
};

/* ── Helper: compute session load ──────────────────────────────────────── */

export function computeSessionLoad(durationMin: number, intensity: Intensity): number {
  return Math.round(durationMin * INTENSITY_LOAD_MULTIPLIER[intensity]);
}

/* ── Helper: determine training phase ──────────────────────────────────── */

export function getTrainingPhase(eventDate?: string): { phase: TrainingPhase; weeksOut: number | null } {
  if (!eventDate) return { phase: 'general', weeksOut: null };
  const event = new Date(eventDate);
  if (isNaN(event.getTime())) return { phase: 'general', weeksOut: null };

  const weeksOut = Math.round((event.getTime() - Date.now()) / (7 * 86400000));
  if (weeksOut <= 0) return { phase: 'recovery', weeksOut: 0 };
  if (weeksOut <= 2) return { phase: 'taper', weeksOut };
  if (weeksOut <= 5) return { phase: 'peak', weeksOut };
  if (weeksOut <= 10) return { phase: 'build', weeksOut };
  return { phase: 'base', weeksOut };
}

/* ── Helper: build constraints for an athlete ─────────────────────────── */

export function buildConstraints(phase: TrainingPhase, avgDuration: number, availDays: number): PlanConstraints {
  const phaseRules = PHASE_RULES[phase];
  // Weekly ceiling: avg session load × sessions/week × 1.2 buffer
  const avgLoad = computeSessionLoad(avgDuration || 45, 'moderate');
  const weeklyLoadCeiling = Math.round(avgLoad * availDays * 1.3);

  return {
    ...DEFAULT_CONSTRAINTS,
    phaseRules,
    weeklyLoadCeiling,
  };
}
