/**
 * Tests for the workout summary generator (Unit 2).
 * See docs/plans/2026-04-17-001-feat-ai-training-plan-creator-plan.md.
 */

import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Workout, PlanWorkoutMeta } from '@/types';
import { computeWorkoutSummary, isSummaryStale } from './summary';

/** Test helper — builds a minimal workout doc with overrides. */
function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  const now = Timestamp.fromMillis(Date.UTC(2026, 3, 17, 7, 0)); // 2026-04-17 07:00 UTC
  return {
    id: 'w1',
    name: 'Test',
    type: 'run',
    description: '',
    date: now,
    ownerUsername: 'alice',
    createdBy: 'alice',
    assignedTo: 'alice',
    completed: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Workout;
}

/** Build a plan-workout meta with sensible defaults. */
function makePlanMeta(overrides: Partial<PlanWorkoutMeta> = {}): PlanWorkoutMeta {
  return {
    weekNumber: 4,
    phase: 'build',
    focus: 'tempo',
    targetDuration: 3600, // 60 min
    targetDistance: 10000, // 10 km
    targetPaceRange: { minSecPerKm: 360, maxSecPerKm: 380 }, // 6:00-6:20/km
    isKeyWorkout: true,
    ...overrides,
  };
}

describe('computeWorkoutSummary', () => {
  describe('happy paths', () => {
    it('classifies a run hitting its plan target as on-target', () => {
      const workout = makeWorkout({
        type: 'run',
        duration: 3600, // 60 min — matches target
        run: {
          distance: 10, // 10 km — matches target distance
          distanceUnit: 'km',
          time: 60,
          avgHeartRate: 155,
        },
        stravaData: {
          distance: 10000,
          time: 3600,
          avgHeartRate: 155,
        },
      });
      const summary = computeWorkoutSummary(workout, makePlanMeta());
      expect(summary.adherenceState).toBe('on-target');
      expect(summary.sport).toBe('run');
      expect(summary.hasGps).toBe(true);
      expect(summary.hasHr).toBe(true);
      expect(summary.distance).toBe(10000);
    });

    it('classifies a standalone (non-plan) workout as unplanned', () => {
      const workout = makeWorkout({
        duration: 2400,
        run: { distance: 6, distanceUnit: 'km', time: 40 },
      });
      const summary = computeWorkoutSummary(workout); // no planMeta
      expect(summary.adherenceState).toBe('unplanned');
      expect(summary.phaseTag).toBeUndefined();
    });
  });

  describe('signal fallback (duration-only)', () => {
    it('classifies a pool swim with matching duration as on-target via duration-only', () => {
      const workout = makeWorkout({
        type: 'swim',
        duration: 2820, // 47 min
        swim: {
          distance: 2000,
          distanceUnit: 'meters',
          time: 47, // minutes
          strokeType: 'freestyle',
          poolLength: 25,
        },
      });
      const plan = makePlanMeta({
        targetDuration: 2700, // 45 min
        targetDistance: undefined,
        targetPaceRange: undefined,
        focus: 'technique',
      });
      const summary = computeWorkoutSummary(workout, plan);
      expect(summary.adherenceState).toBe('on-target');
      expect(summary.hasGps).toBe(false);
      expect(summary.hasHr).toBe(false);
      expect(summary.duration).toBe(2820);
    });

    it('falls back to duration-only when pace/HR are missing on an indoor bike', () => {
      const workout = makeWorkout({
        type: 'bike',
        duration: 2400, // 40 min — close to target
        bike: {
          distance: 0, // indoor, no meaningful distance
          distanceUnit: 'km',
          time: 40,
        },
      });
      const plan = makePlanMeta({
        targetDuration: 2400,
        targetDistance: undefined,
        targetPaceRange: undefined,
      });
      const summary = computeWorkoutSummary(workout, plan);
      expect(summary.adherenceState).toBe('on-target');
      expect(summary.hasGps).toBe(false);
      expect(summary.hasPower).toBe(false);
    });
  });

  describe('missed and incomplete sessions', () => {
    it('marks a workout with completed: false as missed', () => {
      const workout = makeWorkout({ completed: false, duration: 0 });
      const summary = computeWorkoutSummary(workout, makePlanMeta());
      expect(summary.adherenceState).toBe('missed');
    });

    it('marks a zero-duration abandoned workout as missed with no signal flags', () => {
      const workout = makeWorkout({ duration: 0 });
      const summary = computeWorkoutSummary(workout, makePlanMeta());
      expect(summary.adherenceState).toBe('missed');
      expect(summary.hasGps).toBe(false);
      expect(summary.hasHr).toBe(false);
    });
  });

  describe('slightly-off and exceeded classification', () => {
    it('classifies a 50% short distance as missed', () => {
      const workout = makeWorkout({
        duration: 1800,
        run: { distance: 5, distanceUnit: 'km', time: 30 },
        stravaData: { distance: 5000, time: 1800 },
      });
      const plan = makePlanMeta({ targetDistance: 10000, targetDuration: 3600 });
      const summary = computeWorkoutSummary(workout, plan);
      // 5km vs 10km target = 50% short → missed per the threshold
      expect(summary.adherenceState).toBe('missed');
    });

    it('classifies a 20% short distance as slightly-off', () => {
      const workout = makeWorkout({
        duration: 3000, // 50 min vs 60 min target → within 20%
        run: { distance: 8, distanceUnit: 'km', time: 50 },
        stravaData: { distance: 8000, time: 3000 },
      });
      const plan = makePlanMeta({ targetDistance: 10000, targetDuration: 3600 });
      const summary = computeWorkoutSummary(workout, plan);
      expect(summary.adherenceState).toBe('slightly-off');
    });

    it('classifies over-target on a hard/key session as exceeded', () => {
      const workout = makeWorkout({
        duration: 3600,
        run: { distance: 11, distanceUnit: 'km', time: 60 },
        stravaData: { distance: 11000, time: 3600 },
      });
      // 11km on a 10km tempo target → +10% → within on-target band (so use a
      // larger delta to force the exceeded band)
      const workoutBig = makeWorkout({
        duration: 3900,
        run: { distance: 12.5, distanceUnit: 'km', time: 65 },
        stravaData: { distance: 12500, time: 3900 },
      });
      const plan = makePlanMeta({
        focus: 'intervals',
        isKeyWorkout: true,
        targetDistance: 10000,
        targetDuration: 3600,
      });
      const summary = computeWorkoutSummary(workoutBig, plan);
      // +25% distance on a hard/key session → exceeded, not slightly-off
      expect(summary.adherenceState).toBe('exceeded');

      // And on a 10% overshoot it stays on-target
      const summarySmall = computeWorkoutSummary(workout, plan);
      expect(summarySmall.adherenceState).toBe('on-target');
    });

    it('classifies faster-than-target on an easy session as slightly-off, not exceeded', () => {
      const workout = makeWorkout({
        duration: 3000, // 50 min vs 60 min target = 17% shorter
        run: { distance: 8, distanceUnit: 'km', time: 50 },
        stravaData: { distance: 8000, time: 3000 },
      });
      const plan = makePlanMeta({
        focus: 'easy',
        isKeyWorkout: false,
        targetDistance: 10000,
        targetDuration: 3600,
      });
      const summary = computeWorkoutSummary(workout, plan);
      // On easy sessions we don't reward over-performance — it's slightly-off
      expect(summary.adherenceState).toBe('slightly-off');
    });
  });

  describe('phase tag', () => {
    it('includes the phase tag for plan workouts', () => {
      const workout = makeWorkout({ duration: 3600 });
      const summary = computeWorkoutSummary(workout, makePlanMeta({ phase: 'taper' }));
      expect(summary.phaseTag).toBe('taper');
    });

    it('omits the phase tag for unplanned workouts', () => {
      const summary = computeWorkoutSummary(makeWorkout({ duration: 1800 }));
      expect(summary.phaseTag).toBeUndefined();
    });
  });

  describe('version propagation', () => {
    it('stamps forVersion from the workout summaryVersion', () => {
      const workout = makeWorkout({ summaryVersion: 7, duration: 3600 });
      const summary = computeWorkoutSummary(workout, makePlanMeta());
      expect(summary.forVersion).toBe(7);
    });

    it('defaults forVersion to 1 when summaryVersion is absent', () => {
      const workout = makeWorkout({ duration: 3600 });
      const summary = computeWorkoutSummary(workout, makePlanMeta());
      expect(summary.forVersion).toBe(1);
    });
  });
});

describe('isSummaryStale', () => {
  it('returns true when the summary is missing', () => {
    const workout = makeWorkout({ summaryVersion: 3 });
    expect(isSummaryStale(workout)).toBe(true);
  });

  it('returns true when forVersion lags behind summaryVersion', () => {
    const workout = makeWorkout({
      summaryVersion: 4,
      summary: {
        generatedAt: Date.now(),
        forVersion: 3,
        sport: 'run',
        date: '2026-04-17',
        adherenceState: 'unplanned',
        hasGps: false,
        hasHr: false,
        hasPower: false,
      },
    });
    expect(isSummaryStale(workout)).toBe(true);
  });

  it('returns false when forVersion matches summaryVersion', () => {
    const workout = makeWorkout({
      summaryVersion: 5,
      summary: {
        generatedAt: Date.now(),
        forVersion: 5,
        sport: 'run',
        date: '2026-04-17',
        adherenceState: 'on-target',
        hasGps: true,
        hasHr: true,
        hasPower: false,
      },
    });
    expect(isSummaryStale(workout)).toBe(false);
  });

  it('returns false when forVersion exceeds summaryVersion (stale read of the workout, not the summary)', () => {
    const workout = makeWorkout({
      summaryVersion: 3,
      summary: {
        generatedAt: Date.now(),
        forVersion: 5,
        sport: 'run',
        date: '2026-04-17',
        adherenceState: 'on-target',
        hasGps: true,
        hasHr: true,
        hasPower: false,
      },
    });
    expect(isSummaryStale(workout)).toBe(false);
  });
});
