/**
 * Tests for the static plan template library (Unit 4).
 */

import { describe, it, expect } from 'vitest';
import {
  PLAN_TEMPLATES,
  getMatchingTemplates,
  getDefaultTemplate,
  getTemplateById,
  buildMethodologyPromptSection,
} from './planTemplates';

describe('PLAN_TEMPLATES', () => {
  it('has at least 3 seeded templates', () => {
    expect(PLAN_TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps each promptAddendum under 4000 chars (defensive injection cap)', () => {
    for (const t of PLAN_TEMPLATES) {
      expect(t.promptAddendum.length).toBeLessThanOrEqual(4000);
    }
  });

  it('uses only valid sports', () => {
    for (const t of PLAN_TEMPLATES) {
      for (const s of t.sports) {
        expect(['run', 'bike', 'swim']).toContain(s);
      }
    }
  });
});

describe('getMatchingTemplates', () => {
  it('matches run+marathon to the balanced marathon template', () => {
    const matches = getMatchingTemplates('run', 'marathon');
    expect(matches.some(t => t.id === 'balanced-marathon')).toBe(true);
  });

  it('matches swim+olympic triathlon to the Trisutto template', () => {
    const matches = getMatchingTemplates('swim', 'olympic triathlon');
    expect(matches.some(t => t.id === 'trisutto-long-course')).toBe(true);
  });

  it('returns an empty array when no templates match', () => {
    const matches = getMatchingTemplates('run', 'unicorn-gallop');
    expect(matches).toEqual([]);
  });

  it('matches partial goal labels (e.g. "Sub-4 marathon")', () => {
    const matches = getMatchingTemplates('run', 'Sub-4 marathon');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('is case-insensitive on goalLabel', () => {
    const lowerMatches = getMatchingTemplates('run', 'marathon');
    const upperMatches = getMatchingTemplates('run', 'MARATHON');
    expect(upperMatches).toEqual(lowerMatches);
  });
});

describe('getDefaultTemplate', () => {
  it('returns a matching template flagged default when one exists', () => {
    const t = getDefaultTemplate('run', 'marathon');
    expect(t.default).toBe(true);
  });

  it('falls back to any matching template when no match has default:true', () => {
    // Construct a scenario where matches exist but none are default-flagged
    // by testing with a goal that matches e.g. Daniels VDOT (non-default).
    const t = getDefaultTemplate('run', '5k');
    expect(t).toBeDefined();
    expect(t.sports).toContain('run');
  });

  it('falls back to a library default when no match exists at all', () => {
    const t = getDefaultTemplate('run', 'unicorn-gallop');
    expect(t).toBeDefined();
  });
});

describe('getTemplateById', () => {
  it('returns the template when id exists', () => {
    const t = getTemplateById('balanced-marathon');
    expect(t?.id).toBe('balanced-marathon');
  });

  it('returns undefined when id does not exist', () => {
    expect(getTemplateById('no-such-template')).toBeUndefined();
  });
});

describe('buildMethodologyPromptSection', () => {
  it('wraps the addendum in the structural delimiters', () => {
    const t = PLAN_TEMPLATES[0];
    const section = buildMethodologyPromptSection(t);
    expect(section).toContain('[METHODOLOGY_ADDENDUM');
    expect(section).toContain('[END_METHODOLOGY_ADDENDUM]');
    expect(section).toContain(t.promptAddendum);
  });
});
