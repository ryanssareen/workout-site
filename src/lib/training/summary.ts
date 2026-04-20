/**
 * Workout summary generator (plan Unit 2 / R19).
 *
 * A deterministic, pure computation that produces a ~50-100 token compact
 * summary of a workout. Called inline at every workout write site so the
 * summary stays coherent with the underlying doc.
 *
 * LLM calls (weekly recap, proposed-changes, rebuild) read collections of
 * these summaries instead of raw workout docs to keep input token draw bounded.
 *
 * The same module powers the R9 daily ribbon — the ribbon's displayed state is
 * `summary.adherenceState`; the thresholds below are shared.
 *
 * Staleness is detected via a monotonic integer counter (`summaryVersion`),
 * NOT timestamps — client clock skew, offline Firestore replay, and server-
 * timestamp equality edge cases make time comparisons unreliable. See
 * Key Technical Decisions in the plan.
 */

import { safeToDate } from '@/lib/dateUtils';
import type {
  AdherenceState,
  PlanWorkoutMeta,
  Workout,
  WorkoutSummary,
} from '@/types';

// ─── Thresholds (v1 — intentionally wide; tune with beta data) ──────────

/** Within this fraction of target counts as on-target. */
const ON_TARGET_BAND = 0.15;
/** Beyond this fraction of target counts as missed. */
const MISSED_BAND = 0.3;
/** On hard/key sessions only — over-performing by this much is "exceeded". */
const EXCEEDED_BAND = 0.15;

/** Focus tags that signal a "hard" session where over-performance is positive. */
const HARD_FOCUS_TAGS = new Set([
  'intervals',
  'tempo',
  'race',
  'speed',
  'threshold',
]);

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Compute a compact summary for a workout.
 *
 * Pure function — no I/O, safe to call anywhere. Callers are responsible for
 * persisting the returned summary alongside the workout write.
 *
 * Pass `planMeta` when the workout belongs to a plan — the adherence
 * classification uses its targets. Without it, `adherenceState` is `'unplanned'`.
 */
export function computeWorkoutSummary(
  workout: Workout,
  planMeta?: PlanWorkoutMeta,
): WorkoutSummary {
  const metrics = extractMetrics(workout);
  const signal = detectSignal(workout, metrics);
  const date = toIsoDate(workout);

  const adherenceState: AdherenceState = planMeta
    ? classifyAdherence(workout, metrics, planMeta)
    : 'unplanned';

  return stripUndefined({
    generatedAt: Date.now(),
    forVersion: workout.summaryVersion ?? 1,
    sport: workout.type,
    date,
    phaseTag: planMeta?.phase,
    adherenceState,
    distance: metrics.distance,
    duration: metrics.duration,
    pace: metrics.pace,
    hrAvg: metrics.hrAvg,
    hrMax: metrics.hrMax,
    elevation: metrics.elevation,
    rpe: metrics.rpe,
    hasGps: signal.hasGps,
    hasHr: signal.hasHr,
    hasPower: signal.hasPower,
  });
}

/**
 * True when the workout's summary is older than the workout itself —
 * i.e. a subsequent write happened without regenerating the summary.
 *
 * This should never happen in production because every write site calls
 * `writeWithSummary`, but it's the load-bearing invariant guarding against
 * stale ribbons and stale LLM recaps, so we expose it for defensive reads.
 */
export function isSummaryStale(workout: Workout): boolean {
  if (!workout.summary) return true;
  const stored = workout.summary.forVersion;
  const current = workout.summaryVersion ?? 1;
  return stored < current;
}

/**
 * Merge `updateFields` onto an existing workout snapshot's data, bump
 * `summaryVersion`, recompute the summary, and return a payload ready to
 * pass to `updateDoc` / `batch.update` / `ref.update`.
 *
 * This is a pure function with no SDK dependency — it works for both client
 * and Admin SDK callers. Pass the raw `data()` of whatever Firestore
 * snapshot you already have in hand (or fetch one first if you don't).
 *
 * The returned object contains only the fields the caller should write —
 * it is NOT a full workout. Include Firestore sentinel values (serverTimestamp,
 * deleteField) in `updateFields` as you normally would; they are ignored by
 * the summary computation but passed through to the write.
 */
export function mergeSummaryIntoUpdate(
  existingData: Record<string, unknown>,
  id: string,
  updateFields: Record<string, unknown>,
): Record<string, unknown> {
  const existing = { id, ...existingData } as Workout;
  const nextVersion = (existing.summaryVersion ?? 0) + 1;
  const postWrite = { ...existing } as Record<string, unknown>;
  for (const [key, value] of Object.entries(updateFields)) {
    // Skip Firestore sentinel values for the summary computation; they pass
    // through unchanged in the returned payload.
    if (value && typeof value === 'object' && '_methodName' in (value as object)) continue;
    postWrite[key] = value;
  }
  postWrite.summaryVersion = nextVersion;
  const summary = computeWorkoutSummary(postWrite as unknown as Workout, existing.planMeta);
  return {
    ...updateFields,
    summaryVersion: nextVersion,
    summary,
  };
}

/**
 * Build the initial summary fields for a freshly-created workout. Returns
 * `{ summaryVersion: 1, summary, planStatus }` that the caller merges into
 * their create payload. `planStatus` defaults to `'active'` — plan creation
 * explicitly overrides to `'draft'` during stage 1.
 */
export function buildCreateSummaryFields(
  createData: Record<string, unknown>,
): { summaryVersion: number; summary: WorkoutSummary; planStatus: 'active' | 'draft' } {
  const planStatus = (createData.planStatus as 'active' | 'draft') ?? 'active';
  const hydrated = {
    ...createData,
    summaryVersion: 1,
    planStatus,
  } as unknown as Workout;
  const planMeta = (createData.planMeta as PlanWorkoutMeta | undefined);
  const summary = computeWorkoutSummary(hydrated, planMeta);
  return { summaryVersion: 1, summary, planStatus };
}

// ─── Internals ──────────────────────────────────────────────────────────

interface ExtractedMetrics {
  duration?: number;       // seconds
  distance?: number;       // meters
  pace?: number;           // seconds per km
  hrAvg?: number;
  hrMax?: number;
  elevation?: number;
  rpe?: number;
}

interface SignalFlags {
  hasGps: boolean;
  hasHr: boolean;
  hasPower: boolean;
}

/** Pull the metrics we care about from the various sport sub-objects and
 *  Strava enrichment. The canonical duration is `workout.duration`; sport
 *  sub-object times are in minutes and only used when `duration` is absent. */
function extractMetrics(workout: Workout): ExtractedMetrics {
  const m: ExtractedMetrics = {};

  // Duration — `workout.duration` is seconds (the canonical unit on the doc).
  // Fall back to sport sub-objects which carry minutes.
  if (workout.duration != null) {
    m.duration = workout.duration;
  } else if (workout.run?.time) {
    m.duration = workout.run.time * 60;
  } else if (workout.bike?.time) {
    m.duration = workout.bike.time * 60;
  } else if (workout.swim?.time) {
    m.duration = workout.swim.time * 60;
  } else if (workout.strength?.totalTime) {
    m.duration = workout.strength.totalTime * 60;
  } else if (workout.other?.duration) {
    m.duration = workout.other.duration * 60;
  }

  // Distance — prefer Strava's meters, then sport sub-object (convert to meters).
  if (workout.stravaData?.distance != null) {
    m.distance = workout.stravaData.distance;
  } else if (workout.actualStats?.distance != null) {
    m.distance = workout.actualStats.distance;
  } else if (workout.run?.distance != null) {
    m.distance = toMeters(workout.run.distance, workout.run.distanceUnit);
  } else if (workout.bike?.distance != null) {
    m.distance = toMeters(workout.bike.distance, workout.bike.distanceUnit);
  } else if (workout.swim?.distance != null) {
    m.distance = toMeters(workout.swim.distance, workout.swim.distanceUnit);
  }

  // Pace — seconds per kilometer. Only meaningful when we have both distance
  // and duration.
  if (m.duration != null && m.distance != null && m.distance > 0) {
    m.pace = m.duration / (m.distance / 1000);
  }

  // HR — Strava fields take precedence, fall back to sport sub-objects.
  m.hrAvg = workout.stravaData?.avgHeartRate
    ?? workout.actualStats?.avgHeartRate
    ?? workout.run?.avgHeartRate
    ?? workout.bike?.avgHeartRate;
  m.hrMax = workout.stravaData?.maxHeartRate
    ?? workout.actualStats?.maxHeartRate;

  // Elevation — meters.
  m.elevation = workout.stravaData?.elevationGain
    ?? workout.actualStats?.elevationGain
    ?? workout.run?.elevationGain
    ?? workout.bike?.elevationGain;

  // RPE — 1-10. Prefer explicit strength.rpe, then completionRating (1-5) scaled.
  if (workout.strength?.rpe != null) {
    m.rpe = workout.strength.rpe;
  } else if (workout.completionRating != null) {
    m.rpe = workout.completionRating * 2; // 1-5 → 2-10
  }

  return m;
}

function detectSignal(workout: Workout, metrics: ExtractedMetrics): SignalFlags {
  const hasGps = metrics.distance != null
    && metrics.distance > 0
    && workout.type !== 'swim'  // pool swim distance is lap-derived, not GPS
    && workout.type !== 'strength'
    && !isIndoor(workout);
  const hasHr = metrics.hrAvg != null && metrics.hrAvg > 0;
  const hasPower = workout.stravaData?.avgPower != null && workout.stravaData.avgPower > 0
    || workout.bike?.avgPower != null && workout.bike.avgPower > 0;
  return { hasGps, hasHr, hasPower };
}

function isIndoor(workout: Workout): boolean {
  if (workout.run?.terrain === 'treadmill') return true;
  // Bike rides without distance are assumed indoor trainer.
  if (workout.type === 'bike' && (workout.bike?.distance ?? 0) === 0) return true;
  return false;
}

function classifyAdherence(
  workout: Workout,
  metrics: ExtractedMetrics,
  plan: PlanWorkoutMeta,
): AdherenceState {
  // Not completed → missed, period.
  if (!workout.completed || (metrics.duration ?? 0) <= 0) {
    return 'missed';
  }

  const deltas = computeDeltas(metrics, plan);

  // No usable comparison at all → fall back to missed (rare; caller should
  // ensure plan workouts have at least a target duration).
  if (deltas.length === 0) {
    return 'missed';
  }

  // Classify by the worst per-dimension delta.
  const worst = Math.max(...deltas.map(d => Math.abs(d.value)));
  if (worst > MISSED_BAND) {
    return 'missed';
  }

  // Check for exceeded: hard/key session + meaningful over-performance.
  const isHard = plan.isKeyWorkout || HARD_FOCUS_TAGS.has(plan.focus.toLowerCase());
  if (isHard && worst > EXCEEDED_BAND) {
    const exceeded = deltas.some(d => d.signedOverPerformance > EXCEEDED_BAND);
    if (exceeded) return 'exceeded';
  }

  if (worst <= ON_TARGET_BAND) {
    return 'on-target';
  }
  return 'slightly-off';
}

interface Delta {
  /** Absolute fractional delta from target (0-N). */
  value: number;
  /** Signed fractional delta interpreted as "over-performance":
   *  positive = beat target (more distance, faster pace); negative = under.
   *  Pace is inverted (smaller seconds-per-km = faster). */
  signedOverPerformance: number;
}

function computeDeltas(metrics: ExtractedMetrics, plan: PlanWorkoutMeta): Delta[] {
  const deltas: Delta[] = [];

  if (metrics.duration != null && plan.targetDuration > 0) {
    const frac = (metrics.duration - plan.targetDuration) / plan.targetDuration;
    // For duration, going long isn't inherently over-performance — keep sign.
    deltas.push({ value: Math.abs(frac), signedOverPerformance: frac });
  }

  if (metrics.distance != null && plan.targetDistance && plan.targetDistance > 0) {
    const frac = (metrics.distance - plan.targetDistance) / plan.targetDistance;
    deltas.push({ value: Math.abs(frac), signedOverPerformance: frac });
  }

  if (metrics.pace != null && plan.targetPaceRange) {
    const { minSecPerKm, maxSecPerKm } = plan.targetPaceRange;
    const mid = (minSecPerKm + maxSecPerKm) / 2;
    let frac: number;
    if (metrics.pace >= minSecPerKm && metrics.pace <= maxSecPerKm) {
      frac = 0;
    } else if (metrics.pace < minSecPerKm) {
      frac = (minSecPerKm - metrics.pace) / mid; // faster than target range
    } else {
      frac = (metrics.pace - maxSecPerKm) / mid; // slower than target range
    }
    // Pace: smaller value = faster = over-performance, so sign is inverted.
    const signed = metrics.pace < minSecPerKm ? frac : -frac;
    deltas.push({ value: Math.abs(frac), signedOverPerformance: signed });
  }

  return deltas;
}

// ─── Utilities ──────────────────────────────────────────────────────────

function toMeters(distance: number, unit?: string): number {
  if (!distance || distance <= 0) return 0;
  switch (unit) {
    case 'km':
      return distance * 1000;
    case 'miles':
      return distance * 1609.344;
    case 'meters':
      return distance;
    case 'yards':
      return distance * 0.9144;
    default:
      // Default assumption for run/bike is km; for swim, meters.
      return distance > 500 ? distance : distance * 1000;
  }
}

function toIsoDate(workout: Workout): string {
  const d = safeToDate(workout);
  return d.toISOString().slice(0, 10);
}

/** Remove undefined values so Firestore never sees them in nested summary objects. */
function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}
