/**
 * Multi-week plan generator (plan Unit 3 / R3, R4).
 *
 * Produces a deterministic skeleton of weekly sessions across the full plan
 * horizon. AI enhancement runs on top of this skeleton per-phase in the plan
 * creation orchestrator — this module is pure periodization logic.
 *
 * Extends the existing single-week helpers in `planEngine.ts` and the phase
 * rules in `constraints.ts` without modifying them. Reconciles the 4-value
 * `Intensity` used by `planEngine.ts` (which includes `'recovery'`) to the
 * 3-value `Intensity` in `constraints.ts` at this module's boundary: a
 * `'recovery'` session surfaces as `intensity: 'easy'` with a `phaseTag` set.
 */

import { addDays } from 'date-fns';
import type {
  GoalInputs,
  PlanSport,
  PlanWorkoutMeta,
  TrainingPhase,
  PhaseMapEntry,
} from '@/types';
import type { Intensity, WorkoutType } from './constraints';
import { PHASE_RULES } from './constraints';

// ─── Public API ─────────────────────────────────────────────────────────

export interface AthleteProfileLite {
  experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | string;
}

export interface WeeklySkeleton {
  weekNumber: number;
  phase: TrainingPhase;
  /** yyyy-MM-dd for the Monday (ISO weekStart) of this plan week. */
  weekStart: string;
  sessions: ScheduledSession[];
}

export interface ScheduledSession extends PlanWorkoutMeta {
  /** Concrete scheduled date (yyyy-MM-dd, local to the plan's timezone). */
  date: string;
  /** Workout `type` field — the generator's scheduling unit. */
  type: WorkoutType;
  /** Intensity in the `constraints.ts` 3-value form. Recovery is expressed
   *  via the phase tag, not an intensity value. */
  intensity: Intensity;
  /** Descriptive tags for display and filtering. */
  tags: string[];
}

export interface MultiWeekPlanResult {
  phaseMap: PhaseMapEntry[];
  weeklySkeletons: WeeklySkeleton[];
  /** Non-fatal warnings the wizard should surface (e.g. "plan clamped to
   *  minimum length"). */
  warnings?: string[];
}

// ─── Plan length defaults per goal ──────────────────────────────────────

const PLAN_LENGTH_DEFAULTS: Record<string, number> = {
  '5k': 8,
  '10k': 10,
  'half marathon': 12,
  'half': 12,
  'marathon': 16,
  'sprint triathlon': 10,
  'sprint tri': 10,
  'olympic triathlon': 16,
  'olympic tri': 16,
  'ironman 70.3': 20,
  'ironman': 24,
};

const MIN_PLAN_WEEKS_BY_LABEL: Record<string, number> = {
  '5k': 4,
  '10k': 6,
  'half marathon': 8,
  'half': 8,
  'marathon': 12,
  'sprint triathlon': 8,
  'sprint tri': 8,
  'olympic triathlon': 10,
  'olympic tri': 10,
  'ironman 70.3': 14,
  'ironman': 18,
};

const DEFAULT_PLAN_WEEKS = 10;
const DEFAULT_MIN_WEEKS = 4;

/**
 * Default plan length (weeks) derived from a goal label. Unknown labels fall
 * back to 10 weeks.
 */
export function defaultPlanLengthWeeks(goalLabel: string): number {
  const key = normalizeGoalLabel(goalLabel);
  for (const [pattern, weeks] of Object.entries(PLAN_LENGTH_DEFAULTS)) {
    if (key.includes(pattern)) return weeks;
  }
  return DEFAULT_PLAN_WEEKS;
}

function minPlanLengthWeeks(goalLabel: string): number {
  const key = normalizeGoalLabel(goalLabel);
  for (const [pattern, weeks] of Object.entries(MIN_PLAN_WEEKS_BY_LABEL)) {
    if (key.includes(pattern)) return weeks;
  }
  return DEFAULT_MIN_WEEKS;
}

function normalizeGoalLabel(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── Phase split ratios ─────────────────────────────────────────────────

interface PhaseSplit {
  base: number;
  build: number;
  peak: number;
  taper: number;
}

/** Split a plan into phases. Beginners get more base, less build/peak. */
function phaseSplit(profile: AthleteProfileLite, totalWeeks: number): PhaseSplit {
  // Ratios by experience — ensure they sum to 1.0
  const exp = profile.experienceLevel;
  const ratio: PhaseSplit =
    exp === 'Beginner'
      ? { base: 0.50, build: 0.25, peak: 0.10, taper: 0.15 }
      : exp === 'Advanced'
      ? { base: 0.35, build: 0.30, peak: 0.20, taper: 0.15 }
      : { base: 0.40, build: 0.30, peak: 0.15, taper: 0.15 }; // Intermediate / default

  // Compute raw week counts. Taper always gets at least 1 week; peak at least 1.
  const taper = Math.max(1, Math.round(totalWeeks * ratio.taper));
  const peak = Math.max(1, Math.round(totalWeeks * ratio.peak));
  const build = Math.max(1, Math.round(totalWeeks * ratio.build));
  // Base takes the remainder — guarantees sum === totalWeeks.
  const base = Math.max(1, totalWeeks - build - peak - taper);

  return { base, build, peak, taper };
}

// ─── Core generator ─────────────────────────────────────────────────────

/**
 * Build a full multi-week plan skeleton.
 *
 * Deterministic — same inputs produce the same output. No I/O, no AI calls.
 */
export function generateMultiWeekPlan(
  goal: GoalInputs,
  profile: AthleteProfileLite,
  startDate: Date,
): MultiWeekPlanResult {
  const warnings: string[] = [];

  // 1. Determine total plan length.
  const desired = computeDesiredLength(goal, startDate);
  const minWeeks = minPlanLengthWeeks(goal.goalLabel);
  let totalWeeks = desired;
  if (desired < minWeeks) {
    warnings.push(
      `Requested plan is shorter than the minimum ${minWeeks} weeks for this goal — clamping. Consider pushing the event date or picking a shorter goal.`,
    );
    totalWeeks = minWeeks;
  }

  // 2. Split into phases.
  const split = phaseSplit(profile, totalWeeks);
  const phaseOrder: TrainingPhase[] = ['base', 'build', 'peak', 'taper'];
  const phaseMap: PhaseMapEntry[] = [];
  let cursor = 1;
  const weekToPhase: TrainingPhase[] = [];
  for (const phase of phaseOrder) {
    const count = split[phase];
    const weekNumbers: number[] = [];
    for (let i = 0; i < count; i++) {
      weekNumbers.push(cursor);
      weekToPhase.push(phase);
      cursor++;
    }
    const entryStart = addDays(startDate, (weekNumbers[0] - 1) * 7);
    const entryEnd = addDays(startDate, (weekNumbers[weekNumbers.length - 1]) * 7 - 1);
    phaseMap.push({
      phase,
      startDate: toIsoDate(entryStart),
      endDate: toIsoDate(entryEnd),
      weekNumbers,
    });
  }

  // 3. Build weekly skeletons.
  const weeklySkeletons: WeeklySkeleton[] = [];
  const sports = resolveSports(goal);
  const daysPerWeek = clampDaysPerWeek(goal.daysPerWeek);
  const expMult = experienceMultiplier(profile);

  for (let w = 1; w <= totalWeeks; w++) {
    const phase = weekToPhase[w - 1];
    const weekStart = addDays(startDate, (w - 1) * 7);
    const sessions = buildWeekSessions({
      weekNumber: w,
      phase,
      weekStart,
      sports,
      daysPerWeek,
      goal,
      expMult,
    });
    weeklySkeletons.push({
      weekNumber: w,
      phase,
      weekStart: toIsoDate(weekStart),
      sessions,
    });
  }

  return {
    phaseMap,
    weeklySkeletons,
    warnings: warnings.length ? warnings : undefined,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function computeDesiredLength(goal: GoalInputs, startDate: Date): number {
  if (goal.type === 'dated-event' && goal.eventDate) {
    const event = new Date(goal.eventDate);
    if (!isNaN(event.getTime())) {
      const days = Math.round((event.getTime() - startDate.getTime()) / 86400000);
      return Math.max(1, Math.round(days / 7));
    }
  }
  return defaultPlanLengthWeeks(goal.goalLabel);
}

function resolveSports(goal: GoalInputs): PlanSport[] {
  if (goal.sports && goal.sports.length > 0) return goal.sports;
  if (goal.sport) return [goal.sport];
  return ['run'];
}

function clampDaysPerWeek(n: number): number {
  return Math.max(2, Math.min(7, Math.round(n || 4)));
}

function experienceMultiplier(profile: AthleteProfileLite): number {
  switch (profile.experienceLevel) {
    case 'Beginner':
      return 0.7;
    case 'Advanced':
      return 1.3;
    default:
      return 1.0;
  }
}

interface WeekBuildInput {
  weekNumber: number;
  phase: TrainingPhase;
  weekStart: Date;
  sports: PlanSport[];
  daysPerWeek: number;
  goal: GoalInputs;
  expMult: number;
}

/**
 * Build a single week's scheduled sessions. Sessions are distributed across
 * the user's preferred training days (defaults to Tue/Thu/Sat/Sun-ish) with
 * the week's long key session on Sunday.
 */
function buildWeekSessions(input: WeekBuildInput): ScheduledSession[] {
  const { weekNumber, phase, weekStart, sports, daysPerWeek, goal, expMult } = input;
  const phaseRules = PHASE_RULES[phase];
  const phaseVolMult = phaseRules.volumeMultiplier;

  // Determine days of the week to schedule (ISO weekday 1-7: Mon-Sun).
  const trainingDays = chooseTrainingDays(goal.preferredDays, daysPerWeek);

  // Sport rotation for multi-sport plans. Single-sport just uses that sport.
  const sportRotation = buildSportRotation(sports, daysPerWeek);

  // Long key workout lands on the last training day (typically Sunday).
  const keyDayIdx = trainingDays.length - 1;

  const sessions: ScheduledSession[] = [];
  for (let i = 0; i < trainingDays.length; i++) {
    const isoWeekday = trainingDays[i]; // 1-7
    const dayOffset = isoWeekday - 1; // Monday base
    const date = addDays(weekStart, dayOffset);
    const isKey = i === keyDayIdx;

    // Determine sport for this slot.
    const sport = sportRotation[i % sportRotation.length];

    // Intensity per phase + slot.
    const intensity = pickIntensity(phase, isKey, i, trainingDays.length);

    // Focus label.
    const focus = pickFocus(phase, isKey, sport);

    // Duration from goal.typicalSessionMinutes, scaled by phase, experience, and key-workout flag.
    const isLong = isKey && (phase === 'base' || phase === 'build' || phase === 'peak');
    const keyMultiplier = isKey ? (isLong ? 1.7 : 1.2) : 1.0;
    const targetMinutes = Math.max(
      20,
      Math.round(goal.typicalSessionMinutes * expMult * phaseVolMult * keyMultiplier),
    );
    const targetDuration = targetMinutes * 60;

    // Target distance for distance-bearing sports.
    const targetDistance = estimateTargetDistance(sport, targetMinutes, phase);

    sessions.push({
      date: toIsoDate(date),
      type: sport,
      intensity,
      focus,
      weekNumber,
      phase,
      targetDuration,
      targetDistance,
      isKeyWorkout: isKey,
      tags: buildTags(phase, intensity, isKey),
    });
  }

  // Inject strength/mobility as a supporting modality when there's room. For
  // single-sport runners this lands on a lower-intensity slot (not the key
  // workout). Skip during taper to preserve freshness, or scale down.
  injectSupportingModalities(sessions, phase, sports, goal, weekStart);

  return sessions;
}

/** Pick up to `daysPerWeek` ISO weekday numbers (1-7) preferring user-selected
 *  days, with sensible defaults when none are provided. */
function chooseTrainingDays(preferred: number[] | undefined, daysPerWeek: number): number[] {
  const pool = (preferred && preferred.length >= daysPerWeek)
    ? [...preferred]
    : defaultTrainingDays(daysPerWeek);
  return pool.slice(0, daysPerWeek).sort((a, b) => a - b);
}

function defaultTrainingDays(daysPerWeek: number): number[] {
  switch (daysPerWeek) {
    case 2:
      return [3, 7]; // Wed, Sun
    case 3:
      return [2, 4, 7]; // Tue, Thu, Sun
    case 4:
      return [2, 4, 6, 7]; // Tue, Thu, Sat, Sun
    case 5:
      return [1, 3, 4, 6, 7]; // Mon, Wed, Thu, Sat, Sun
    case 6:
      return [1, 2, 3, 5, 6, 7]; // Mon, Tue, Wed, Fri, Sat, Sun
    case 7:
      return [1, 2, 3, 4, 5, 6, 7];
    default:
      return [2, 4, 6, 7];
  }
}

function buildSportRotation(sports: PlanSport[], daysPerWeek: number): WorkoutType[] {
  if (sports.length === 1) return Array(daysPerWeek).fill(sports[0]) as WorkoutType[];
  // For multi-sport, interleave. 3 sports × 4 days → run/bike/swim/run; etc.
  const rotation: WorkoutType[] = [];
  for (let i = 0; i < daysPerWeek; i++) {
    rotation.push(sports[i % sports.length]);
  }
  return rotation;
}

function pickIntensity(
  phase: TrainingPhase,
  isKey: boolean,
  slotIndex: number,
  totalSlots: number,
): Intensity {
  const allowed = PHASE_RULES[phase].allowedIntensities;
  if (phase === 'taper') {
    // Taper is mostly easy, with one moderate sharpener.
    return isKey ? 'moderate' : 'easy';
  }
  // base / build / peak: vary intensity. Key = moderate/hard; others = easy.
  if (isKey) return allowed.includes('hard') ? 'hard' : 'moderate';
  // Interleave a moderate tempo mid-week.
  if (slotIndex === Math.floor(totalSlots / 2)) return 'moderate';
  return 'easy';
}

function pickFocus(phase: TrainingPhase, isKey: boolean, sport: WorkoutType): string {
  if (isKey) {
    if (phase === 'taper') return 'sharpener';
    if (sport === 'run') return phase === 'peak' ? 'race-pace long' : 'long run';
    if (sport === 'bike') return phase === 'peak' ? 'race-pace ride' : 'long ride';
    if (sport === 'swim') return 'endurance swim';
    if (sport === 'strength') return 'main lift';
    return 'long session';
  }
  switch (phase) {
    case 'base':
      return 'aerobic easy';
    case 'build':
      return 'tempo';
    case 'peak':
      return 'intervals';
    case 'taper':
      return 'recovery';
    default:
      return 'easy';
  }
}

function buildTags(phase: TrainingPhase, intensity: Intensity, isKey: boolean): string[] {
  const tags: string[] = [intensity];
  if (isKey) tags.push('long');
  if (phase === 'taper') tags.push('recovery');
  if (phase === 'peak' && intensity === 'hard') tags.push('intervals');
  if (phase === 'build' && intensity === 'moderate') tags.push('tempo');
  return tags;
}

/**
 * Estimate a target distance for distance-bearing sports from duration and
 * phase. Uses rough pace defaults per sport — AI enhancement refines these.
 */
function estimateTargetDistance(
  sport: WorkoutType,
  durationMin: number,
  phase: TrainingPhase,
): number | undefined {
  if (sport === 'strength' || sport === 'other') return undefined;
  // Rough pace defaults (min/km or min/100m for swim).
  let minutesPerKm = 6.5; // run default
  if (sport === 'bike') minutesPerKm = 2.5;
  if (sport === 'swim') minutesPerKm = 25; // min/km for a 2:30/100m pace
  if (sport === 'walk') minutesPerKm = 12;
  // Harder phases go slightly faster.
  if (phase === 'peak') minutesPerKm *= 0.95;
  if (phase === 'build') minutesPerKm *= 0.98;
  const km = durationMin / minutesPerKm;
  return Math.round(km * 1000); // meters
}

/**
 * Inject strength/mobility as supporting modalities. For single-sport plans
 * we add one strength session per week (mid-week, lower intensity slot).
 * Strength is scaled down during taper and omitted in recovery phases.
 */
function injectSupportingModalities(
  sessions: ScheduledSession[],
  phase: TrainingPhase,
  sports: PlanSport[],
  goal: GoalInputs,
  weekStart: Date,
): void {
  if (sessions.length >= 6) return; // already a busy week
  // Only single-sport plans get auto-injected strength — multi-sport athletes
  // should schedule it via Edit Goal if they want it explicitly.
  if (sports.length > 1) return;
  // Skip if strength is already present.
  if (sessions.some(s => s.type === 'strength')) return;

  // Find a gap day mid-week that isn't already scheduled.
  const scheduledDays = new Set(sessions.map(s => s.date));
  for (let offset = 1; offset <= 5; offset++) {
    // Prefer Wednesday (offset 2 from Monday)
    const candidate = addDays(weekStart, [2, 4, 0, 3, 1][offset - 1]);
    const iso = toIsoDate(candidate);
    if (scheduledDays.has(iso)) continue;

    // Taper weeks get shorter strength; skip peak/taper-specific tuning for now.
    const taperMult = phase === 'taper' ? 0.4 : phase === 'peak' ? 0.7 : 1.0;
    const baseMinutes = Math.max(20, Math.round(Math.min(goal.typicalSessionMinutes, 45) * taperMult));

    sessions.push({
      date: iso,
      type: 'strength',
      intensity: 'moderate',
      focus: phase === 'taper' ? 'mobility' : 'accessory strength',
      weekNumber: sessions[0]?.weekNumber ?? 1,
      phase,
      targetDuration: baseMinutes * 60,
      targetDistance: undefined,
      isKeyWorkout: false,
      tags: ['strength', phase === 'taper' ? 'recovery' : 'moderate'],
    });
    // Keep the list sorted by date.
    sessions.sort((a, b) => a.date.localeCompare(b.date));
    return;
  }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
