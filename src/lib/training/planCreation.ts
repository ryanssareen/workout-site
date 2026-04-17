/**
 * Plan creation orchestrator (Unit 6).
 *
 * Pure in-memory transformation: goal + profile → finished plan + workouts.
 * Consumed by the `/api/plans/create` route — the route handles Firestore
 * persistence (draft-first atomicity + transaction on user.activePlanId);
 * this module only produces the plan shape.
 *
 * Chunking strategy per plan R19: one Groq call per training phase with
 * carried-forward context from the previous phase. If Groq is rate-limited
 * or returns malformed output, the per-phase fallback is rules-based
 * (skeleton → descriptive name/description) so plan creation always
 * succeeds.
 */

import Groq from 'groq-sdk';
import type {
  GoalInputs,
  PlanSport,
  PhaseMapEntry,
  PlanWorkoutMeta,
  TrainingPhase,
} from '@/types';
import {
  generateMultiWeekPlan,
  type AthleteProfileLite,
  type ScheduledSession,
  type WeeklySkeleton,
} from './multiWeekPlanner';
import {
  buildMethodologyPromptSection,
  getTemplateById,
  getDefaultTemplate,
} from './planTemplates';

const GROQ_MODEL_70B = 'llama-3.3-70b-versatile';
const GROQ_MODEL_8B = 'llama-3.1-8b-instant';
const GROQ_TIMEOUT_MS = 45_000;

/** The shape persisted on each workout doc, plus the scheduled date. */
export interface EnhancedSession extends PlanWorkoutMeta {
  date: string;
  type: 'run' | 'bike' | 'swim' | 'strength';
  intensity: 'easy' | 'moderate' | 'hard';
  tags: string[];
  /** Display name, e.g. "Tempo Run — 8km at threshold". */
  name: string;
  /** Plain-language description of the session for the workout detail view. */
  description: string;
}

export interface PlanCreationResult {
  phaseMap: PhaseMapEntry[];
  weeks: Array<{
    weekNumber: number;
    phase: TrainingPhase;
    weekStart: string;
    sessions: EnhancedSession[];
  }>;
  sports: PlanSport[];
  startDate: string;
  endDate: string;
  templateId: string;
  warnings?: string[];
  /** Tallies how many phase calls succeeded vs fell back — surfaced in logs
   *  so operators can see Groq health. */
  groqStats: { phaseCalls: number; phaseSuccesses: number; fell8bBack: number };
}

export interface PlanCreationInput {
  goal: GoalInputs;
  profile: AthleteProfileLite;
  startDate: Date;
  templateId?: string;
}

/**
 * Build a full training plan. Deterministic skeleton from multiWeekPlanner →
 * per-phase Groq enrichment with rules-based fallback.
 */
export async function createPlanContent(input: PlanCreationInput): Promise<PlanCreationResult> {
  const { goal, profile, startDate } = input;
  const { phaseMap, weeklySkeletons, warnings } = generateMultiWeekPlan(goal, profile, startDate);

  // Resolve template — fall back to default if the stored id is gone.
  const explicitTemplate = input.templateId ? getTemplateById(input.templateId) : undefined;
  const template = explicitTemplate ?? getDefaultTemplate(goal.sport ?? 'run', goal.goalLabel);

  // Enrich each phase's sessions. Carry forward a compact summary of the
  // previous phase's last week so phase N+1 has context.
  const groqStats = { phaseCalls: 0, phaseSuccesses: 0, fell8bBack: 0 };
  const enrichedWeeks: PlanCreationResult['weeks'] = [];
  let carryContext = '';

  for (const phase of phaseMap) {
    const phaseWeeks = weeklySkeletons.filter(w => phase.weekNumbers.includes(w.weekNumber));
    const enrichedPhase = await enrichPhase({
      phaseWeeks,
      phase: phase.phase,
      template,
      goal,
      profile,
      carryContext,
      groqStats,
    });
    enrichedWeeks.push(...enrichedPhase);
    carryContext = buildCarryContext(phase.phase, enrichedPhase);
  }

  const firstWeek = enrichedWeeks[0];
  const lastWeek = enrichedWeeks[enrichedWeeks.length - 1];
  const lastSession = lastWeek.sessions[lastWeek.sessions.length - 1];

  return {
    phaseMap,
    weeks: enrichedWeeks,
    sports: resolveSports(goal),
    startDate: firstWeek.weekStart,
    endDate: lastSession?.date ?? lastWeek.weekStart,
    templateId: template.id,
    warnings,
    groqStats,
  };
}

// ─── Internals ──────────────────────────────────────────────────────────

interface EnrichInput {
  phaseWeeks: WeeklySkeleton[];
  phase: TrainingPhase;
  template: ReturnType<typeof getDefaultTemplate>;
  goal: GoalInputs;
  profile: AthleteProfileLite;
  carryContext: string;
  groqStats: { phaseCalls: number; phaseSuccesses: number; fell8bBack: number };
}

async function enrichPhase(input: EnrichInput): Promise<PlanCreationResult['weeks']> {
  const { phaseWeeks, phase, template, goal, profile, carryContext, groqStats } = input;

  // Try Groq if API key is available. Otherwise fall back to rules-only
  // enrichment immediately.
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return phaseWeeks.map(w => rulesEnrichWeek(w, phase));
  }

  groqStats.phaseCalls++;
  try {
    const groq = new Groq({ apiKey });
    const systemPrompt = buildSystemPrompt({ template, goal, profile, phase, carryContext });
    const userPrompt = buildUserPrompt(phaseWeeks);

    const enhanced = await callGroqWithFallback({
      groq,
      systemPrompt,
      userPrompt,
      onFallback: () => groqStats.fell8bBack++,
    });
    const parsed = parseEnhancedSessions(enhanced, phaseWeeks);
    if (parsed) {
      groqStats.phaseSuccesses++;
      return parsed;
    }
  } catch (err) {
    // Non-fatal — fall through to rules-based enrichment.
    console.warn(`[planCreation] Groq phase '${phase}' failed, using rules fallback:`, err);
  }

  return phaseWeeks.map(w => rulesEnrichWeek(w, phase));
}

function buildSystemPrompt(input: {
  template: ReturnType<typeof getDefaultTemplate>;
  goal: GoalInputs;
  profile: AthleteProfileLite;
  phase: TrainingPhase;
  carryContext: string;
}): string {
  const { template, goal, profile, phase, carryContext } = input;
  const lines = [
    'You are a senior endurance coach building one training phase of a longer plan.',
    `Goal: ${goal.goalLabel}${goal.eventDate ? ` on ${goal.eventDate}` : ''}${goal.targetTime ? ` (target time ${goal.targetTime}s)` : ''}.`,
    `Current phase: ${phase}. Athlete: ${profile.experienceLevel ?? 'Intermediate'}. Availability: ${goal.daysPerWeek} days/week, ~${goal.typicalSessionMinutes} min/session.`,
    '',
    'Your job: for each planned session in the provided skeleton, produce a short name and a 1-2 sentence description. DO NOT change dates, types, intensities, durations, or distances — those are fixed by the skeleton. DO NOT add new sessions or remove existing ones.',
    '',
    'Output format: JSON array with one object per input session, in the same order. Each object must be `{ "name": string, "description": string }`. No prose, no code fences, no extra keys.',
    '',
    buildMethodologyPromptSection(template),
  ];
  if (carryContext) {
    lines.push('', 'Context from the previous phase (summary):', carryContext);
  }
  return lines.join('\n');
}

function buildUserPrompt(phaseWeeks: WeeklySkeleton[]): string {
  const sessions = phaseWeeks.flatMap(w =>
    w.sessions.map(s => ({
      week: w.weekNumber,
      date: s.date,
      type: s.type,
      intensity: s.intensity,
      focus: s.focus,
      durationMin: Math.round(s.targetDuration / 60),
      distanceM: s.targetDistance,
      isKey: s.isKeyWorkout,
    })),
  );
  return `Skeleton sessions for this phase:\n${JSON.stringify(sessions, null, 2)}`;
}

interface GroqCallInput {
  groq: Groq;
  systemPrompt: string;
  userPrompt: string;
  onFallback: () => void;
}

async function callGroqWithFallback(input: GroqCallInput): Promise<string> {
  const { groq, systemPrompt, userPrompt, onFallback } = input;
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  try {
    const res = await withTimeout(
      groq.chat.completions.create({
        model: GROQ_MODEL_70B,
        messages,
        max_tokens: 4000,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      GROQ_TIMEOUT_MS,
    );
    return res.choices[0]?.message?.content ?? '';
  } catch (err: unknown) {
    if (!isRateLimitOrTimeout(err)) throw err;
    onFallback();
    const res = await withTimeout(
      groq.chat.completions.create({
        model: GROQ_MODEL_8B,
        messages,
        max_tokens: 4000,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      GROQ_TIMEOUT_MS,
    );
    return res.choices[0]?.message?.content ?? '';
  }
}

function isRateLimitOrTimeout(err: unknown): boolean {
  const e = err as { status?: number; code?: string; message?: string };
  if (e?.status === 429) return true;
  if (e?.code === 'ETIMEDOUT' || e?.message?.toLowerCase().includes('timeout')) return true;
  return false;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Groq timeout')), ms)),
  ]);
}

/**
 * Parse the Groq response (JSON with either an array or a `{sessions: []}`
 * wrapper) and zip the name/description back onto the skeleton. Returns null
 * if the response is malformed so the caller falls back.
 */
function parseEnhancedSessions(
  raw: string,
  phaseWeeks: WeeklySkeleton[],
): PlanCreationResult['weeks'] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Accept either `[...]` or `{sessions: [...]}` or `{items: [...]}`.
  const arr: unknown = Array.isArray(parsed)
    ? parsed
    : (parsed as { sessions?: unknown; items?: unknown })?.sessions
      ?? (parsed as { items?: unknown })?.items;

  if (!Array.isArray(arr)) return null;

  const sessions = phaseWeeks.flatMap(w => w.sessions);
  if (arr.length !== sessions.length) return null;

  const enriched: PlanCreationResult['weeks'] = [];
  let idx = 0;
  for (const w of phaseWeeks) {
    const weekSessions: EnhancedSession[] = [];
    for (const s of w.sessions) {
      const e = arr[idx++] as { name?: unknown; description?: unknown };
      const name = typeof e?.name === 'string' && e.name.trim()
        ? String(e.name).slice(0, 120)
        : buildRulesName(s);
      const description = typeof e?.description === 'string' && e.description.trim()
        ? String(e.description).slice(0, 600)
        : buildRulesDescription(s);
      weekSessions.push(toEnhancedSession(s, w.phase, name, description));
    }
    enriched.push({
      weekNumber: w.weekNumber,
      phase: w.phase,
      weekStart: w.weekStart,
      sessions: weekSessions,
    });
  }
  return enriched;
}

function rulesEnrichWeek(
  w: WeeklySkeleton,
  _phase: TrainingPhase,
): PlanCreationResult['weeks'][number] {
  return {
    weekNumber: w.weekNumber,
    phase: w.phase,
    weekStart: w.weekStart,
    sessions: w.sessions.map(s =>
      toEnhancedSession(s, w.phase, buildRulesName(s), buildRulesDescription(s)),
    ),
  };
}

function toEnhancedSession(
  s: ScheduledSession,
  phase: TrainingPhase,
  name: string,
  description: string,
): EnhancedSession {
  return {
    date: s.date,
    type: s.type as EnhancedSession['type'],
    intensity: s.intensity,
    tags: s.tags,
    weekNumber: s.weekNumber,
    phase,
    focus: s.focus,
    targetDuration: s.targetDuration,
    targetDistance: s.targetDistance,
    targetPaceRange: s.targetPaceRange,
    targetHRZone: s.targetHRZone,
    isKeyWorkout: s.isKeyWorkout,
    name,
    description,
  };
}

function buildRulesName(s: ScheduledSession): string {
  const cap = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
  return `${cap(s.intensity)} ${cap(s.type)} — ${s.focus}`;
}

function buildRulesDescription(s: ScheduledSession): string {
  const mins = Math.round(s.targetDuration / 60);
  const distKm = s.targetDistance ? (s.targetDistance / 1000).toFixed(1) : null;
  const parts = [
    `${mins} min ${s.intensity} ${s.type} focused on ${s.focus}`,
  ];
  if (distKm) parts.push(`~${distKm} km`);
  if (s.isKeyWorkout) parts.push('key session of the week');
  return parts.join(' · ') + '.';
}

function buildCarryContext(phase: TrainingPhase, enriched: PlanCreationResult['weeks']): string {
  if (enriched.length === 0) return '';
  const lastWeek = enriched[enriched.length - 1];
  const summary = lastWeek.sessions
    .map(s => `${s.type}/${s.intensity}/${Math.round(s.targetDuration / 60)}min/${s.focus}`)
    .join(', ');
  return `End of ${phase} (week ${lastWeek.weekNumber}): ${summary}.`;
}

function resolveSports(goal: GoalInputs): PlanSport[] {
  if (goal.sports && goal.sports.length > 0) return goal.sports;
  if (goal.sport) return [goal.sport];
  return ['run'];
}
