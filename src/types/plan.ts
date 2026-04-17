/**
 * Type definitions for the AI-assisted training plan creator.
 *
 * See: docs/plans/2026-04-17-001-feat-ai-training-plan-creator-plan.md (Unit 1)
 *      docs/brainstorms/2026-04-17-ai-training-plan-creator-requirements.md
 */

import type { Timestamp } from 'firebase/firestore';
import type { WorkoutType } from './index';

// ─── Goal and plan metadata ─────────────────────────────────────────────

export type PlanGoalType = 'dated-event' | 'distance-pr';

export type PlanSport = 'run' | 'bike' | 'swim';

export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper';

/** Raw goal inputs collected from the wizard — persisted on the plan doc
 *  and on `user.lastFailedPlanId` so a retry can pre-populate the wizard. */
export interface GoalInputs {
  type: PlanGoalType;
  /** Primary sport for single-sport plans; undefined for triathlon. */
  sport?: PlanSport;
  /** Subset of sports for triathlon (e.g. ['run','bike','swim']). */
  sports?: PlanSport[];
  /** e.g. "marathon", "10K PR", "olympic-triathlon". Free-text slug. */
  goalLabel: string;
  /** ISO yyyy-MM-dd — required for dated-event goals, absent for distance-PR. */
  eventDate?: string;
  /** Target distance in meters (e.g. 42195 for marathon). */
  targetDistance?: number;
  /** Target time in seconds (e.g. 14400 for sub-4 marathon). */
  targetTime?: number;
  /** Days per week the athlete can reliably train. */
  daysPerWeek: number;
  /** Typical session length in minutes (user's default, not per-session target). */
  typicalSessionMinutes: number;
  /** Preferred days of the week as ISO weekday numbers (1=Mon, 7=Sun). */
  preferredDays?: number[];
}

/** Phase map entry — when each phase runs across the plan. */
export interface PhaseMapEntry {
  phase: TrainingPhase;
  /** ISO yyyy-MM-dd (inclusive). */
  startDate: string;
  /** ISO yyyy-MM-dd (inclusive). */
  endDate: string;
  /** 1-based week numbers belonging to this phase. */
  weekNumbers: number[];
}

/** Plan lifecycle state. `draft` is written by plan-creation stage 1 and
 *  flipped to `active` in stage 2 inside a transaction on the user doc. */
export type PlanStatus =
  | 'draft'
  | 'active'
  | 'completed'
  | 'abandoned'
  | 'failed-creation';

/** A first-class training plan document.
 *
 *  Stored at `trainingPlans/{planId}` (top-level collection).
 *  Plan workouts live at `users/{username}/workouts/{id}` with a `planId` field
 *  — see `PlanWorkoutMeta` below. */
export interface TrainingPlan {
  id: string;
  /** Owner — matches `user.username`, not the Firebase UID. */
  userId: string;
  /** Snapshot of the wizard inputs that produced this plan. */
  goal: GoalInputs;
  /** yyyy-MM-dd — first plan day (typically tomorrow at creation time). */
  startDate: string;
  /** yyyy-MM-dd — last plan day (the event date for dated goals). */
  endDate: string;
  /** Periodization phases in order. */
  phaseMap: PhaseMapEntry[];
  /** All sports that appear in this plan. */
  sports: PlanSport[];
  status: PlanStatus;
  /** Template id (from `PLAN_TEMPLATES` in src/lib/training/planTemplates.ts)
   *  whose `promptAddendum` steered this plan's generation. */
  templateId?: string;
  /** Monotonic counter. Bumped on every mutation to the plan or its workouts
   *  (create, proposal accept, edit goal, abandon). Used as part of the cache
   *  key for weekly narrative recaps (see plan R19 / Unit 13). */
  version: number;
  /** IANA timezone snapshot at creation (e.g. "Asia/Kolkata"). Plan workouts
   *  render against this, not the user's current timezone, so a user who
   *  moves countries doesn't see their Sunday long run shift days. */
  timezoneAtCreation: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
  abandonedAt?: Timestamp;
  /** Hard-failure state from plan-creation stage 2. The retry flow reads
   *  `user.lastFailedPlanId` (not this field) to avoid an orphan-lookup. */
  failureReason?: string;
}

// ─── Plan templates (static const, not Firestore in v1) ─────────────────

export interface PlanTemplate {
  id: string;
  name: string;
  /** Sports this template is valid for. */
  sports: PlanSport[];
  /** Free-form goal labels this template matches (e.g. "marathon", "10K PR"). */
  goalTypes: string[];
  /** Text injected into the Groq system prompt. Wrapped with
   *  [METHODOLOGY_ADDENDUM] delimiters at injection time. */
  promptAddendum: string;
  /** Surfaced first when multiple templates match in the wizard. */
  default: boolean;
}

// ─── Plan workout metadata (merged onto workout docs) ───────────────────

/** Metadata that turns a regular workout doc into a plan workout.
 *  Stored on the workout doc under `planMeta`. The workout's `planId`
 *  field is set as a sibling — see `PlanWorkoutFields` below. */
export interface PlanWorkoutMeta {
  weekNumber: number;
  phase: TrainingPhase;
  /** Session focus — e.g. "long run", "tempo", "technique", "recovery". */
  focus: string;
  /** Rationale surfaced in the plan-context side panel. */
  reason?: string;
  /** Target session duration (seconds). Required. */
  targetDuration: number;
  /** Target distance (meters). Absent for strength/mobility-only sessions. */
  targetDistance?: number;
  /** Target pace range (seconds per km). Absent when not meaningful. */
  targetPaceRange?: { minSecPerKm: number; maxSecPerKm: number };
  /** Heart-rate zone index this session targets (1-5). Displayed, not used
   *  as an adaptation input in v1. */
  targetHRZone?: number;
  /** True when this session is a key workout (long run, race-pace, etc.).
   *  Adaptation prefers not to shuffle these. */
  isKeyWorkout: boolean;
}

// ─── Workout summary layer (R19) ────────────────────────────────────────

export type AdherenceState =
  | 'on-target'
  | 'slightly-off'
  | 'exceeded'
  | 'missed'
  | 'unplanned';

/** Compact summary persisted on every workout doc for cheap LLM reads.
 *  Regenerated on every mutation (see src/lib/training/summary.ts). */
export interface WorkoutSummary {
  /** Client epoch-ms at generation. Used only for diagnostics — staleness
   *  is detected via `forVersion < workout.summaryVersion`, not timestamps. */
  generatedAt: number;
  /** Which `workout.summaryVersion` this summary was generated against. */
  forVersion: number;
  sport: WorkoutType;
  /** yyyy-MM-dd in the workout's local timezone. */
  date: string;
  /** Phase tag if this is a plan workout, else undefined. */
  phaseTag?: TrainingPhase;
  adherenceState: AdherenceState;
  /** Compact metrics — null fields indicate the signal was absent. */
  distance?: number;    // meters
  duration?: number;    // seconds
  pace?: number;        // seconds per km
  hrAvg?: number;       // bpm
  hrMax?: number;       // bpm
  elevation?: number;   // meters
  rpe?: number;         // 1-10 or emoji-derived
  /** Signal availability flags — consumed by the ribbon to decide whether
   *  to render the duration-only fallback. */
  hasGps: boolean;
  hasHr: boolean;
  hasPower: boolean;
}

// ─── Workout doc additions (merged onto `Workout`) ──────────────────────

/** Fields added to `Workout` by the training-plan feature.
 *  Merged into the `Workout` interface in src/types/index.ts. */
export interface PlanWorkoutFields {
  /** Present on workouts that belong to an active/completed/abandoned plan. */
  planId?: string;
  /** `'draft'` during plan-creation stage 1; `'active'` otherwise (including
   *  non-plan workouts — defaulted at write time so the Strava webhook's
   *  `!= 'draft'` filter works correctly without backfilling legacy data). */
  planStatus?: 'draft' | 'active';
  /** Plan metadata — only present when `planId` is set. */
  planMeta?: PlanWorkoutMeta;
  /** Monotonic version counter bumped on every workout mutation.
   *  Consumed by `isSummaryStale`. */
  summaryVersion?: number;
  /** Compact summary. Regenerated on every write via writeWithSummary(). */
  summary?: WorkoutSummary;
  /** Soft-delete flag written by abandon (see Unit 15). Future plan workouts
   *  with this set are hidden from the calendar but remain recoverable. */
  abandonedByPlan?: boolean;
}

// ─── User doc additions ─────────────────────────────────────────────────

/** Fields added to `User` by the training-plan feature.
 *  Merged into the `User` interface in src/types/index.ts. */
export interface PlanUserFields {
  /** Admin-gated flag — must be `true` for a user to create or hold a plan.
   *  Client Firestore rules deny writes to this field. */
  planBetaEnabled?: boolean;
  /** Denormalized pointer to the user's current plan. Cleared on abandon
   *  and on completion (cron or lazy-update). Written only inside a
   *  runTransaction on the user doc. */
  activePlanId?: string;
  /** Surfaces the retry flow on /plan after a failed-creation. The field is
   *  cleared on a successful retry or by the cron sweep after 7 days. */
  lastFailedPlanId?: {
    id: string;
    at: Timestamp;
    goalInputs: GoalInputs;
  };
}
