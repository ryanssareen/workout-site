/**
 * Plan week-number computation for drag-to-reschedule.
 *
 * When a workout that belongs to a training plan is moved to a new date, its
 * `planMeta.weekNumber` needs to match the ISO week of the new date, measured
 * from the plan's `startDate` in the plan's `timezoneAtCreation`.
 *
 * Phase is NOT recomputed here (R21): callers preserve `planMeta.phase` as-is,
 * even if the new date falls outside the original phase's range. Adherence
 * classification stays coherent with the original intent.
 */

import { differenceInCalendarWeeks } from 'date-fns';
import { getDayKey } from '@/lib/dayKey';

/**
 * Compute the 1-indexed week number for `newDate` within a plan starting at
 * `planStartDate` (yyyy-MM-dd) in `timezoneAtCreation`.
 *
 * Uses Monday-start weeks (ISO 8601, same convention as /wrap). Anchors both
 * dates at 12:00 UTC on the calendar day in the plan timezone to sidestep
 * DST-transition edge cases where midnight wouldn't exist in the local day.
 *
 * Returns at least 1 — a drop onto a day before the plan's start clamps to
 * week 1 rather than returning 0 or a negative number.
 */
export function computePlanWeekNumber(
  newDate: Date,
  planStartDate: string,
  timezoneAtCreation: string,
): number {
  const newDayKey = getDayKey(newDate, timezoneAtCreation);
  const startAnchor = new Date(`${planStartDate}T12:00:00Z`);
  const newAnchor = new Date(`${newDayKey}T12:00:00Z`);
  const weeks = differenceInCalendarWeeks(newAnchor, startAnchor, { weekStartsOn: 1 });
  return Math.max(1, weeks + 1);
}
