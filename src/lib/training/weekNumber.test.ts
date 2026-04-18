import { describe, it, expect } from 'vitest';
import { computePlanWeekNumber } from './weekNumber';

describe('computePlanWeekNumber', () => {
  it('returns 1 when the new date is in the same Monday-start week as the plan start', () => {
    // Plan starts Mon 2026-04-13; drop onto Fri 2026-04-17 (same ISO week).
    const newDate = new Date('2026-04-17T07:00:00Z');
    expect(computePlanWeekNumber(newDate, '2026-04-13', 'Asia/Kolkata')).toBe(1);
  });

  it('returns 2 when the new date is one ISO week later', () => {
    const newDate = new Date('2026-04-21T07:00:00Z');
    expect(computePlanWeekNumber(newDate, '2026-04-13', 'Asia/Kolkata')).toBe(2);
  });

  it('returns 5 when the new date is four ISO weeks later', () => {
    const newDate = new Date('2026-05-13T07:00:00Z');
    expect(computePlanWeekNumber(newDate, '2026-04-13', 'Asia/Kolkata')).toBe(5);
  });

  it('clamps to 1 for a drop before the plan start', () => {
    const newDate = new Date('2026-04-05T07:00:00Z');
    expect(computePlanWeekNumber(newDate, '2026-04-13', 'UTC')).toBe(1);
  });

  it('counts across a year boundary correctly', () => {
    // Plan starts Mon 2025-12-29; drop into Mon 2026-01-05 = next ISO week.
    const newDate = new Date('2026-01-05T12:00:00Z');
    expect(computePlanWeekNumber(newDate, '2025-12-29', 'UTC')).toBe(2);
  });

  it('honours the plan timezone when assigning the new day bucket', () => {
    // Drop at 20:00 UTC on Sun 2026-04-19 → Mon 2026-04-20 in Asia/Kolkata (UTC+5:30),
    // which is the first day of week 2 (plan starts Mon 2026-04-13).
    const newDate = new Date('2026-04-19T20:00:00Z');
    expect(computePlanWeekNumber(newDate, '2026-04-13', 'Asia/Kolkata')).toBe(2);
    // Same instant in UTC stays in week 1 because it's still Sunday there.
    expect(computePlanWeekNumber(newDate, '2026-04-13', 'UTC')).toBe(1);
  });
});
