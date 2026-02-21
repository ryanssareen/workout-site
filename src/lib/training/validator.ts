/* ═══════════════════════════════════════════════════════════════════════════
   VALIDATOR — deterministic enforcement of training rules
   Post-GROQ modification check. Single source of truth: constraints.ts
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  PlannedWorkout, EnhancedWorkout, PlanConstraints, Intensity,
  VALID_TAGS, INTENSITY_LOAD_MULTIPLIER, computeSessionLoad,
} from './constraints';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface Violation {
  workoutIndex: number;
  rule: string;
  detail: string;
  severity: 'hard' | 'soft'; // hard = must fix, soft = warning
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  adjustedPlan: EnhancedWorkout[] | null; // auto-corrected if only soft violations
  totalLoadOriginal: number;
  totalLoadModified: number;
  loadDeltaPercent: number;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function pctDelta(original: number, modified: number): number {
  if (original === 0) return modified === 0 ? 0 : 100;
  return Math.round(Math.abs(modified - original) / original * 100);
}

function getSpecValue(specs: Record<string, any>, type: string, field: string): number | undefined {
  const typeData = specs[type];
  if (!typeData) return undefined;
  return typeof typeData[field] === 'number' ? typeData[field] : undefined;
}

function derivePace(specs: Record<string, any>, type: string): number | null {
  const data = specs[type];
  if (!data) return null;
  const dist = data.distance || data.distance;
  const time = data.time || data.totalTime;
  if (!dist || !time || dist <= 0) return null;
  return time / dist;
}

/* ── Core Validator ───────────────────────────────────────────────────── */

export function validatePlan(
  original: PlannedWorkout[],
  modified: EnhancedWorkout[],
  constraints: PlanConstraints,
  historicalPaces: Record<string, number>,
  deload: boolean
): ValidationResult {
  const violations: Violation[] = [];
  let sessionsModified = 0;

  // ── Per-workout checks ──
  for (let i = 0; i < original.length; i++) {
    const orig = original[i];
    const mod = modified[i];

    if (!mod) {
      violations.push({ workoutIndex: i, rule: 'missing_workout', detail: `Workout ${i + 1} missing from modified plan`, severity: 'hard' });
      continue;
    }

    // 1. Type preserved (immutable)
    if (mod.type !== orig.type) {
      violations.push({ workoutIndex: i, rule: 'type_changed', detail: `Type changed from ${orig.type} to ${mod.type}`, severity: 'hard' });
    }

    // 2. Date preserved (immutable)
    if (mod.date !== orig.date) {
      violations.push({ workoutIndex: i, rule: 'date_changed', detail: `Date changed from ${orig.date} to ${mod.date}`, severity: 'hard' });
    }

    // 3. Intensity: must be in phase-allowed set
    if (!constraints.phaseRules.allowedIntensities.includes(mod.intensity)) {
      violations.push({ workoutIndex: i, rule: 'intensity_phase_violation', detail: `Intensity "${mod.intensity}" not allowed in current phase (allowed: ${constraints.phaseRules.allowedIntensities.join(', ')})`, severity: 'hard' });
    }

    // 4. Intensity swap: if changed, must pass load simulation
    if (mod.intensity !== orig.intensity) {
      const origLoad = computeSessionLoad(orig.durationMin, orig.intensity);
      const modLoad = computeSessionLoad(mod.durationMin, mod.intensity);
      const loadDelta = pctDelta(origLoad, modLoad);
      if (loadDelta > constraints.maxSpecDeltaPercent) {
        violations.push({ workoutIndex: i, rule: 'intensity_swap_load_exceeded', detail: `Intensity swap ${orig.intensity}→${mod.intensity} caused ${loadDelta}% load change (max ${constraints.maxSpecDeltaPercent}%)`, severity: 'hard' });
      }
    }

    // 5. Duration within bounds
    const durDelta = pctDelta(orig.durationMin, mod.durationMin);
    if (durDelta > constraints.maxSpecDeltaPercent + 5) { // +5% buffer over spec delta
      violations.push({ workoutIndex: i, rule: 'duration_exceeded', detail: `Duration changed ${durDelta}% (${orig.durationMin}→${mod.durationMin}min, max ${constraints.maxSpecDeltaPercent + 5}%)`, severity: 'hard' });
    }

    // 6. Distance within bounds (type-specific)
    const origDist = getSpecValue(orig.specs, orig.type, 'distance');
    const modDist = getSpecValue(mod.specs, mod.type, 'distance');
    if (origDist !== undefined && modDist !== undefined) {
      const distDelta = pctDelta(origDist, modDist);
      if (distDelta > constraints.maxSpecDeltaPercent + 5) {
        violations.push({ workoutIndex: i, rule: 'distance_exceeded', detail: `Distance changed ${distDelta}% (${origDist}→${modDist}, max ${constraints.maxSpecDeltaPercent + 5}%)`, severity: 'hard' });
      }
    }

    // 7. Pace realism
    const modPace = derivePace(mod.specs, mod.type);
    const histPace = historicalPaces[mod.type];
    if (modPace !== null && histPace && histPace > 0) {
      const paceDelta = pctDelta(histPace, modPace);
      if (paceDelta > constraints.paceTolerancePercent) {
        violations.push({ workoutIndex: i, rule: 'pace_unrealistic', detail: `Derived pace ${modPace.toFixed(2)} is ${paceDelta}% off historical ${histPace.toFixed(2)} (max ${constraints.paceTolerancePercent}%)`, severity: 'soft' });
      }
    }

    // 8. Required fields
    if (!mod.name || mod.name.length === 0) {
      violations.push({ workoutIndex: i, rule: 'missing_name', detail: 'Workout name is empty', severity: 'soft' });
    }
    if (!mod.mainSet || mod.mainSet.length === 0) {
      violations.push({ workoutIndex: i, rule: 'missing_mainset', detail: 'Main set description is empty', severity: 'soft' });
    }

    // 9. Tag validity
    if (mod.tags) {
      const invalidTags = mod.tags.filter((t) => !VALID_TAGS.has(t));
      if (invalidTags.length > 0) {
        violations.push({ workoutIndex: i, rule: 'invalid_tags', detail: `Invalid tags: ${invalidTags.join(', ')}`, severity: 'soft' });
      }
    }

    // 10. String length caps
    if (mod.name && mod.name.length > 80) {
      violations.push({ workoutIndex: i, rule: 'name_too_long', detail: `Name is ${mod.name.length} chars (max 80)`, severity: 'soft' });
    }
    if (mod.rationale && mod.rationale.length > 500) {
      violations.push({ workoutIndex: i, rule: 'rationale_too_long', detail: `Rationale is ${mod.rationale.length} chars (max 500)`, severity: 'soft' });
    }

    // Track if modified
    if (mod.durationMin !== orig.durationMin || mod.intensity !== orig.intensity ||
        getSpecValue(mod.specs, mod.type, 'distance') !== getSpecValue(orig.specs, orig.type, 'distance')) {
      sessionsModified++;
    }
  }

  // ── Plan-level checks ──

  // 11. Modification budget
  if (sessionsModified > constraints.maxSessionsModifiable) {
    violations.push({ workoutIndex: -1, rule: 'modification_budget_exceeded', detail: `${sessionsModified} sessions modified (max ${constraints.maxSessionsModifiable})`, severity: 'hard' });
  }

  // 12. Weekly load ceiling (post-modification, full recalculation)
  const totalLoadOriginal = original.reduce((sum, w) => sum + w.sessionLoad, 0);
  const totalLoadModified = modified.reduce((sum, w) => sum + computeSessionLoad(w.durationMin, w.intensity), 0);
  const loadDeltaPercent = pctDelta(totalLoadOriginal, totalLoadModified);

  if (loadDeltaPercent > constraints.maxWeeklyLoadDeltaPercent) {
    violations.push({ workoutIndex: -1, rule: 'weekly_load_exceeded', detail: `Total plan load changed ${loadDeltaPercent}% (${totalLoadOriginal}→${totalLoadModified}, max ${constraints.maxWeeklyLoadDeltaPercent}%)`, severity: 'hard' });
  }

  if (totalLoadModified > constraints.weeklyLoadCeiling) {
    violations.push({ workoutIndex: -1, rule: 'weekly_load_ceiling_breach', detail: `Total load ${totalLoadModified} exceeds ceiling ${constraints.weeklyLoadCeiling}`, severity: 'hard' });
  }

  // 13. Deload enforcement
  if (deload) {
    const normalLoad = original.reduce((sum, w) => sum + computeSessionLoad(w.durationMin, 'moderate'), 0);
    const deloadMax = Math.round(normalLoad * constraints.deloadVolumeMax / 100);
    if (totalLoadModified > deloadMax) {
      violations.push({ workoutIndex: -1, rule: 'deload_violated', detail: `Deload week load ${totalLoadModified} exceeds max ${deloadMax} (${constraints.deloadVolumeMax}% of normal)`, severity: 'hard' });
    }
  }

  // ── Auto-correct soft violations ──
  const hardViolations = violations.filter((v) => v.severity === 'hard');
  let adjustedPlan: EnhancedWorkout[] | null = null;

  if (hardViolations.length === 0) {
    // Auto-fix soft issues
    adjustedPlan = modified.map((w, i) => {
      const cleaned = { ...w };
      // Sanitize tags
      cleaned.tags = (w.tags || []).filter((t) => VALID_TAGS.has(t)).slice(0, 5);
      // Trim strings
      if (cleaned.name && cleaned.name.length > 80) cleaned.name = cleaned.name.slice(0, 77) + '...';
      if (cleaned.rationale && cleaned.rationale.length > 500) cleaned.rationale = cleaned.rationale.slice(0, 497) + '...';
      if (cleaned.warmup && cleaned.warmup.length > 500) cleaned.warmup = cleaned.warmup.slice(0, 497) + '...';
      if (cleaned.mainSet && cleaned.mainSet.length > 500) cleaned.mainSet = cleaned.mainSet.slice(0, 497) + '...';
      if (cleaned.cooldown && cleaned.cooldown.length > 500) cleaned.cooldown = cleaned.cooldown.slice(0, 497) + '...';
      // Fill missing name
      if (!cleaned.name || cleaned.name.length === 0) {
        const orig = original[i];
        cleaned.name = `${orig.intensity.charAt(0).toUpperCase() + orig.intensity.slice(1)} ${orig.type.charAt(0).toUpperCase() + orig.type.slice(1)} Session`;
      }
      // Compute delta metadata
      cleaned.aiModified = w.durationMin !== original[i]?.durationMin || w.intensity !== original[i]?.intensity;
      cleaned.changesCount = cleaned.aiModified ? 1 : 0;
      cleaned.loadDeltaPercent = pctDelta(original[i]?.sessionLoad || 0, computeSessionLoad(w.durationMin, w.intensity));
      return cleaned;
    });
  }

  return {
    valid: hardViolations.length === 0,
    violations,
    adjustedPlan,
    totalLoadOriginal,
    totalLoadModified,
    loadDeltaPercent,
  };
}
