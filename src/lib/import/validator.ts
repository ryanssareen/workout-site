import { ParsedWorkout, ValidatedWorkout } from './types';

export function validateWorkouts(workouts: ParsedWorkout[]): ValidatedWorkout[] {
  return workouts.map(w => validateOne(w)).filter(Boolean) as ValidatedWorkout[];
}

function validateOne(w: ParsedWorkout): ValidatedWorkout {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Date checks
  if (!w.date || isNaN(w.date.getTime())) {
    errors.push('Invalid or missing date');
  } else {
    if (w.date.getFullYear() < 2000) errors.push('Date before year 2000 — likely a parse error');
    const now = new Date();
    const daysDiff = (w.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) warnings.push('Date is more than a year in the future');
  }

  // Name
  if (!w.name || w.name.trim().length === 0) {
    warnings.push('Missing workout name — auto-generated');
  }

  // Duration
  if (w.duration !== undefined) {
    if (w.duration < 0) errors.push('Negative duration');
    if (w.duration > 720) warnings.push('Duration exceeds 12 hours — possible unit error');
  }

  // Distance
  if (w.distance !== undefined) {
    if (w.distance < 0) errors.push('Negative distance');
    if (w.distance > 500) warnings.push('Distance exceeds 500km — possible unit error');
  }

  // Heart rate
  if (w.avgHeartRate !== undefined) {
    if (w.avgHeartRate > 250) warnings.push('Heart rate > 250bpm — likely invalid');
    if (w.avgHeartRate < 30) warnings.push('Heart rate < 30bpm — likely invalid');
  }

  // Calories
  if (w.calories !== undefined && w.calories > 10000) {
    warnings.push('Calories > 10,000 — possible error');
  }

  const hasErrors = errors.length > 0;
  const status = hasErrors ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

  return {
    ...w,
    status,
    warnings,
    errors,
    isDuplicate: false,
  };
}

export function deduplicateAgainstExisting(
  imported: ValidatedWorkout[],
  existing: Array<{ id: string; date: Date; type: string; distance?: number; duration?: number }>
): ValidatedWorkout[] {
  return imported.map(w => {
    if (w.status === 'error') return w;

    const dup = existing.find(e => {
      const dateDiff = Math.abs(w.date.getTime() - e.date.getTime()) / (1000 * 60 * 60 * 24);
      if (dateDiff > 1) return false;
      if (e.type !== w.type) return false;
      // Check distance similarity
      if (w.distance && e.distance) {
        const pctDiff = Math.abs(w.distance - e.distance) / Math.max(w.distance, e.distance);
        if (pctDiff < 0.1) return true;
      }
      // Check duration similarity
      if (w.duration && e.duration) {
        const pctDiff = Math.abs(w.duration - e.duration) / Math.max(w.duration, e.duration);
        if (pctDiff < 0.1) return true;
      }
      // Same date + type with no distance/duration to compare = probable dup
      if (!w.distance && !e.distance && !w.duration && !e.duration) return true;
      return false;
    });

    if (dup) {
      return {
        ...w,
        isDuplicate: true,
        duplicateOf: dup.id,
        warnings: [...w.warnings, 'Possible duplicate of existing workout'],
        status: w.status === 'valid' ? 'warning' : w.status,
      };
    }
    return w;
  });
}
