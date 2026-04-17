/**
 * Tests for createPlanContent (Unit 6) in the no-Groq / fallback path.
 *
 * The route-level integration (Firestore atomicity, beta gate, etc.) is
 * covered manually during QA — simulating Firestore transactions in a unit
 * test would be heavier than the test's value. This file pins the pure
 * orchestration logic: template resolution, carry-context, phase coverage.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPlanContent } from './planCreation';
import type { GoalInputs } from '@/types';

// Force the rules-based fallback path by stripping GROQ_API_KEY.
beforeAll(() => {
  delete process.env.GROQ_API_KEY;
});
afterAll(() => {
  // leave env untouched
});

function makeGoal(overrides: Partial<GoalInputs> = {}): GoalInputs {
  return {
    type: 'dated-event',
    sport: 'run',
    sports: ['run'],
    goalLabel: 'marathon',
    eventDate: '2026-08-07',
    daysPerWeek: 4,
    typicalSessionMinutes: 60,
    ...overrides,
  };
}

const START = new Date('2026-04-17T00:00:00Z');

describe('createPlanContent (no Groq)', () => {
  it('produces a plan covering every phase and every week', async () => {
    const content = await createPlanContent({
      goal: makeGoal(),
      profile: { experienceLevel: 'Intermediate' },
      startDate: START,
    });
    expect(content.phaseMap.map(p => p.phase)).toEqual(['base', 'build', 'peak', 'taper']);
    const totalWeeks = content.phaseMap.reduce((s, p) => s + p.weekNumbers.length, 0);
    expect(content.weeks.length).toBe(totalWeeks);
  });

  it('picks the Trisutto default for triathlon goals', async () => {
    const content = await createPlanContent({
      goal: makeGoal({ goalLabel: 'olympic triathlon', sport: undefined, sports: ['run', 'bike', 'swim'], daysPerWeek: 6 }),
      profile: { experienceLevel: 'Intermediate' },
      startDate: START,
    });
    expect(content.templateId).toBe('trisutto-long-course');
  });

  it('honors an explicit templateId even when another would default', async () => {
    const content = await createPlanContent({
      goal: makeGoal({ goalLabel: 'marathon' }),
      profile: { experienceLevel: 'Intermediate' },
      startDate: START,
      templateId: 'daniels-vdot-run',
    });
    expect(content.templateId).toBe('daniels-vdot-run');
  });

  it('falls back to default when the supplied templateId is unknown', async () => {
    const content = await createPlanContent({
      goal: makeGoal({ goalLabel: 'marathon' }),
      profile: { experienceLevel: 'Intermediate' },
      startDate: START,
      templateId: 'no-such-template',
    });
    expect(content.templateId).toBe('balanced-marathon');
  });

  it('every session carries a rules-based name and description', async () => {
    const content = await createPlanContent({
      goal: makeGoal(),
      profile: { experienceLevel: 'Intermediate' },
      startDate: START,
    });
    for (const w of content.weeks) {
      for (const s of w.sessions) {
        expect(s.name.length).toBeGreaterThan(3);
        expect(s.description.length).toBeGreaterThan(10);
      }
    }
  });

  it('records zero Groq phase calls when no API key is set', async () => {
    const content = await createPlanContent({
      goal: makeGoal(),
      profile: { experienceLevel: 'Intermediate' },
      startDate: START,
    });
    expect(content.groqStats.phaseCalls).toBe(0);
    expect(content.groqStats.phaseSuccesses).toBe(0);
  });

  it('surfaces warnings when plan length is clamped', async () => {
    const soon = new Date(START);
    soon.setUTCDate(soon.getUTCDate() + 7); // 1 week marathon → clamps up
    const content = await createPlanContent({
      goal: makeGoal({ goalLabel: 'marathon', eventDate: soon.toISOString().slice(0, 10) }),
      profile: { experienceLevel: 'Intermediate' },
      startDate: START,
    });
    expect(content.warnings).toBeDefined();
    expect(content.warnings!.length).toBeGreaterThan(0);
  });
});
