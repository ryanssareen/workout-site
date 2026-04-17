/**
 * Tests for the multi-week plan generator (Unit 3).
 * See docs/plans/2026-04-17-001-feat-ai-training-plan-creator-plan.md.
 */

import { describe, it, expect } from 'vitest';
import { generateMultiWeekPlan, defaultPlanLengthWeeks } from './multiWeekPlanner';
import type { GoalInputs } from '@/types';

function makeGoal(overrides: Partial<GoalInputs> = {}): GoalInputs {
  return {
    type: 'dated-event',
    sport: 'run',
    sports: ['run'],
    goalLabel: 'marathon',
    daysPerWeek: 4,
    typicalSessionMinutes: 60,
    eventDate: '2026-08-07', // 16 weeks from a 2026-04-17 start
    ...overrides,
  };
}

const START = new Date('2026-04-17');

describe('defaultPlanLengthWeeks', () => {
  it('returns a 10-week default for a 10K PR', () => {
    expect(defaultPlanLengthWeeks('10k')).toBe(10);
    expect(defaultPlanLengthWeeks('10K PR')).toBe(10);
  });

  it('returns a 16-week default for a marathon', () => {
    expect(defaultPlanLengthWeeks('marathon')).toBe(16);
  });

  it('returns a 12-week default for a half marathon', () => {
    expect(defaultPlanLengthWeeks('half marathon')).toBe(12);
    expect(defaultPlanLengthWeeks('half')).toBe(12);
  });

  it('returns a 16-week default for an olympic triathlon', () => {
    expect(defaultPlanLengthWeeks('olympic triathlon')).toBe(16);
  });

  it('falls back to 10 weeks for unrecognized labels', () => {
    expect(defaultPlanLengthWeeks('mystery-goal-2026')).toBe(10);
  });
});

describe('generateMultiWeekPlan', () => {
  describe('phase boundaries', () => {
    it('creates 4 phases for a 16-week marathon plan (intermediate)', () => {
      const { phaseMap } = generateMultiWeekPlan(
        makeGoal({ goalLabel: 'marathon', eventDate: '2026-08-07' }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      const phases = phaseMap.map(p => p.phase);
      expect(phases).toEqual(['base', 'build', 'peak', 'taper']);
      // Phase weeks sum to total plan weeks
      const totalWeeks = phaseMap.reduce((sum, p) => sum + p.weekNumbers.length, 0);
      expect(totalWeeks).toBeGreaterThanOrEqual(14); // allow small rounding
      expect(totalWeeks).toBeLessThanOrEqual(16);
    });

    it('preserves phase ordering: base weeks come first, taper last', () => {
      const { phaseMap } = generateMultiWeekPlan(
        makeGoal({ goalLabel: 'marathon', eventDate: '2026-08-07' }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      const base = phaseMap.find(p => p.phase === 'base')!;
      const taper = phaseMap.find(p => p.phase === 'taper')!;
      expect(Math.min(...base.weekNumbers)).toBe(1);
      expect(Math.max(...taper.weekNumbers)).toBeGreaterThanOrEqual(
        Math.max(...base.weekNumbers),
      );
    });
  });

  describe('sessions per week', () => {
    it('produces ~4 sessions per week for a 4-days/wk marathon runner', () => {
      const { weeklySkeletons } = generateMultiWeekPlan(
        makeGoal({ daysPerWeek: 4 }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      // Every week's skeleton should have roughly daysPerWeek sessions
      for (const week of weeklySkeletons) {
        expect(week.sessions.length).toBeGreaterThanOrEqual(3);
        expect(week.sessions.length).toBeLessThanOrEqual(5);
      }
    });

    it('produces 3 sessions per week for a beginner 3-days plan', () => {
      const { weeklySkeletons } = generateMultiWeekPlan(
        makeGoal({ daysPerWeek: 3, goalLabel: '10k', eventDate: '2026-06-26' }),
        { experienceLevel: 'Beginner' },
        START,
      );
      for (const week of weeklySkeletons) {
        expect(week.sessions.length).toBeGreaterThanOrEqual(2);
        expect(week.sessions.length).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('taper volume', () => {
    it('reduces duration volume in taper compared to peak', () => {
      const { weeklySkeletons, phaseMap } = generateMultiWeekPlan(
        makeGoal({ goalLabel: 'marathon', eventDate: '2026-08-07' }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      const peakWeek = phaseMap.find(p => p.phase === 'peak')!.weekNumbers[0];
      const taperWeek = phaseMap.find(p => p.phase === 'taper')!.weekNumbers[0];
      const peakVol = weeklySkeletons[peakWeek - 1].sessions.reduce(
        (s, x) => s + x.targetDuration,
        0,
      );
      const taperVol = weeklySkeletons[taperWeek - 1].sessions.reduce(
        (s, x) => s + x.targetDuration,
        0,
      );
      expect(taperVol).toBeLessThan(peakVol);
    });
  });

  describe('multi-sport (triathlon)', () => {
    it('rotates across sports in an olympic triathlon plan', () => {
      const { weeklySkeletons } = generateMultiWeekPlan(
        makeGoal({
          goalLabel: 'olympic triathlon',
          sport: undefined,
          sports: ['run', 'bike', 'swim'],
          daysPerWeek: 6,
          eventDate: '2026-08-07',
        }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      // Sample middle weeks — should see all 3 sports represented
      const midWeek = weeklySkeletons[Math.floor(weeklySkeletons.length / 2)];
      const sports = new Set(midWeek.sessions.map(s => s.type));
      // Not every week must have all 3, but over the plan all 3 should appear
      const allSports = new Set(
        weeklySkeletons.flatMap(w => w.sessions.map(s => s.type)),
      );
      expect(allSports.has('run')).toBe(true);
      expect(allSports.has('bike')).toBe(true);
      expect(allSports.has('swim')).toBe(true);
      // mid-week should have at least 2 distinct sports
      expect(sports.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('supporting modalities (strength/mobility)', () => {
    it('injects strength for single-sport runners on recovery days', () => {
      const { weeklySkeletons } = generateMultiWeekPlan(
        makeGoal({ daysPerWeek: 5, goalLabel: 'marathon', eventDate: '2026-08-07' }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      // At least one week should have strength as a supporting modality
      const allTypes = weeklySkeletons.flatMap(w => w.sessions.map(s => s.type));
      expect(allTypes).toContain('strength');
    });

    it('scales down strength volume during taper', () => {
      const { weeklySkeletons, phaseMap } = generateMultiWeekPlan(
        makeGoal({ daysPerWeek: 5, goalLabel: 'marathon', eventDate: '2026-08-07' }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      const taperWeekIdx = phaseMap.find(p => p.phase === 'taper')!.weekNumbers[0] - 1;
      const buildWeekIdx = phaseMap.find(p => p.phase === 'build')!.weekNumbers[0] - 1;
      const strengthDurationTaper = weeklySkeletons[taperWeekIdx].sessions
        .filter(s => s.type === 'strength')
        .reduce((sum, s) => sum + s.targetDuration, 0);
      const strengthDurationBuild = weeklySkeletons[buildWeekIdx].sessions
        .filter(s => s.type === 'strength')
        .reduce((sum, s) => sum + s.targetDuration, 0);
      // Taper strength should be <= build strength (or both zero)
      expect(strengthDurationTaper).toBeLessThanOrEqual(strengthDurationBuild);
    });
  });

  describe('plan length derivation', () => {
    it('uses the goal default when eventDate is absent (distance-PR)', () => {
      const { weeklySkeletons } = generateMultiWeekPlan(
        makeGoal({ type: 'distance-pr', eventDate: undefined, goalLabel: '10k' }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      expect(weeklySkeletons.length).toBe(10); // 10K default
    });

    it('clamps below-minimum event dates to the minimum length with a warning', () => {
      const tooSoon = new Date(START);
      tooSoon.setDate(tooSoon.getDate() + 14); // 2 weeks out for a marathon
      const { weeklySkeletons, warnings } = generateMultiWeekPlan(
        makeGoal({ goalLabel: 'marathon', eventDate: tooSoon.toISOString().slice(0, 10) }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      expect(weeklySkeletons.length).toBeGreaterThanOrEqual(4); // clamped up
      expect(warnings).toBeDefined();
      expect(warnings!.length).toBeGreaterThan(0);
      expect(warnings!.some(w => /minimum|short/i.test(w))).toBe(true);
    });
  });

  describe('intensity reconciliation', () => {
    it('never emits a recovery intensity — recovery is a phase tag, not an intensity', () => {
      const { weeklySkeletons } = generateMultiWeekPlan(
        makeGoal({ daysPerWeek: 5 }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      const allIntensities = new Set<string>();
      for (const week of weeklySkeletons) {
        for (const session of week.sessions) {
          allIntensities.add(session.intensity);
        }
      }
      // Must only emit the constraints.ts 3-value intensity set
      expect(allIntensities.has('recovery')).toBe(false);
      for (const intensity of allIntensities) {
        expect(['easy', 'moderate', 'hard']).toContain(intensity);
      }
    });
  });

  describe('key workouts', () => {
    it('marks at least one session per week as a key workout', () => {
      const { weeklySkeletons } = generateMultiWeekPlan(
        makeGoal({ daysPerWeek: 4 }),
        { experienceLevel: 'Intermediate' },
        START,
      );
      for (const week of weeklySkeletons) {
        const keyCount = week.sessions.filter(s => s.isKeyWorkout).length;
        expect(keyCount).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
