/* ═══════════════════════════════════════════════════════════════════════════
   ORCHESTRATOR — Logic Engine → GROQ → Validator → Retry/Accept
   ═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { generateLogicOutput, analyzeHistory } from '@/lib/training/logicEngine';
import { validatePlan, Violation } from '@/lib/training/validator';
import {
  LogicOutput, PlannedWorkout, EnhancedWorkout,
  VALID_TAGS, computeSessionLoad,
} from '@/lib/training/constraints';

const MAX_RETRIES = 1;

/* ── Build logic-only fallback ────────────────────────────────────────── */

function buildFallback(logicOutput: LogicOutput): EnhancedWorkout[] {
  const { plan, athlete } = logicOutput;
  return plan.map((p) => {
    const capIntensity = p.intensity.charAt(0).toUpperCase() + p.intensity.slice(1);
    const capType = p.type.charAt(0).toUpperCase() + p.type.slice(1);
    const capFocus = p.focus.charAt(0).toUpperCase() + p.focus.slice(1);

    // Build basic warmup/mainSet/cooldown per type
    const warmup = p.type === 'strength'
      ? '5-10 min light cardio, dynamic stretches'
      : `10 min easy ${p.type}, dynamic stretches`;
    const cooldown = p.type === 'strength'
      ? '5 min light cardio, static stretches'
      : `5-10 min easy ${p.type}, static stretching`;
    const mainDur = Math.max(p.durationMin - 15, 10);
    const mainSet = `${mainDur} min ${p.intensity} ${p.focus}`;

    return {
      ...p,
      name: `${capIntensity} ${capType} — ${capFocus}`,
      description: `${athlete.deload ? '[DELOAD] ' : ''}A ${p.intensity} ${p.type} session focused on ${p.focus}. ${p.durationMin} minutes total.${athlete.phase !== 'general' ? ` (${athlete.phase} phase${athlete.weeksOut ? `, ${athlete.weeksOut}w to event` : ''})` : ''}`,
      rationale: `Planned based on your training history and ${athlete.phase} phase.`,
      benefits: [`Develops ${p.focus}`, `Maintains ${p.type} fitness`],
      tags: [p.intensity],
      warmup,
      mainSet,
      cooldown,
      sessionType: p.focus,
      aiModified: false,
      changesCount: 0,
      loadDeltaPercent: 0,
    };
  });
}

/* ── Build GROQ prompt ────────────────────────────────────────────────── */

function buildPrompt(logicOutput: LogicOutput, recentWorkouts: any[]): string {
  const { athlete, constraints, plan } = logicOutput;
  const { profile, historySummary, phase, weeksOut, fatigueState, deload } = athlete;

  const profileLines = [
    `Experience: ${profile.experienceLevel || 'Intermediate'}`,
    `Sports: ${profile.sportPreferences?.join(', ') || 'Multi-sport'}`,
    `Goals: ${profile.trainingFor?.join(', ') || profile.fitnessGoals?.join(', ') || 'General fitness'}`,
    profile.eventDate ? `Event: ${profile.eventDate} (${weeksOut}w out, ${phase} phase)` : null,
    profile.ageRange ? `Age: ${profile.ageRange}` : null,
    profile.weeklyAvailability ? `Availability: ${profile.weeklyAvailability}` : null,
    `Fatigue state: ${fatigueState}`,
    deload ? '⚠️ DELOAD WEEK — volume must stay ≤80% of normal' : null,
    phase === 'taper' ? '⚠️ TAPER — no hard intensity allowed, volume reduced' : null,
    phase === 'recovery' ? '⚠️ RECOVERY — easy intensity only' : null,
  ].filter(Boolean).join('\n');

  const historyLines = [
    `Completion rate: ${historySummary.completedRate}%`,
    `Avg session: ${historySummary.avgDuration}min`,
    `Days since last: ${historySummary.daysSinceLast}`,
    `Types: ${Object.entries(historySummary.typeCounts).map(([t, c]) => `${t}:${c}`).join(', ') || 'none'}`,
  ].join(' | ');

  const recentLines = (recentWorkouts || []).slice(0, 8).map((w: any) => {
    const d = w.date ? new Date(w.date) : null;
    const ds = d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'Recent';
    const dur = w.duration ?? w.run?.time ?? w.bike?.time ?? w.swim?.time ?? w.strength?.totalTime ?? 0;
    const dist = w.run?.distance ? `${w.run.distance}${w.run.distanceUnit}` : w.bike?.distance ? `${w.bike.distance}${w.bike.distanceUnit}` : w.swim?.distance ? `${w.swim.distance}${w.swim.distanceUnit}` : '';
    return `- ${(w.type || 'other').toUpperCase()}: ${w.name || 'Unnamed'} (${ds}) ${w.completed ? '✅' : '❌'} ${dur}min ${dist}`.trim();
  }).join('\n') || 'No recent workouts';

  const planJson = JSON.stringify(plan, null, 2);

  return `You are an expert coach REVIEWING an algorithm-generated training plan. You may MODIFY specs within bounds and MUST provide coaching detail.

## ATHLETE
${profileLines}

## HISTORY
${historyLines}

## RECENT WORKOUTS
${recentLines}

## CONSTRAINTS (you must stay within these)
- Max spec change per workout: ±${constraints.maxSpecDeltaPercent}%
- Max total plan load change: ±${constraints.maxWeeklyLoadDeltaPercent}%
- Max sessions you can modify specs on: ${constraints.maxSessionsModifiable} of ${plan.length}
- Allowed intensities this phase: ${constraints.phaseRules.allowedIntensities.join(', ')}
- Weekly load ceiling: ${constraints.weeklyLoadCeiling}
${deload ? `- DELOAD: volume must stay ≤${constraints.deloadVolumeMax}% of normal` : ''}

## PLAN TO REVIEW
${planJson}

## YOUR TASK
Return a JSON object with "workouts" array. For each workout you MUST include:
- All original fields (type, date, intensity, focus, durationMin, sessionLoad, specs)
- You MAY adjust: durationMin (±${constraints.maxSpecDeltaPercent}%), distance (±${constraints.maxSpecDeltaPercent}%), terrain, strokeType, interval structure
- You MUST NOT change: type, date
- You MUST NOT use intensities outside: ${constraints.phaseRules.allowedIntensities.join(', ')}
- Add: name, description, rationale, benefits[], tags[], warmup, mainSet, cooldown, sessionType
- tags from: ${[...VALID_TAGS].join(', ')}
- "changes" array documenting what you modified and why

{
  "workouts": [
    {
      "type": "run", "date": "2026-02-23", "intensity": "moderate",
      "focus": "tempo / threshold", "durationMin": 48,
      "sessionLoad": 48,
      "specs": { "run": { "distance": 8.5, "distanceUnit": "km", "time": 48, "terrain": "road", "elevationGain": 0 } },
      "name": "Tempo Builder",
      "description": "Progressive tempo building lactate threshold",
      "rationale": "Your recent runs have been easy-only...",
      "benefits": ["Improves threshold", "Race pace practice"],
      "tags": ["tempo", "moderate"],
      "warmup": "10min easy jog, dynamic stretches",
      "mainSet": "3x10min at tempo pace with 3min easy between",
      "cooldown": "10min easy jog, static stretching",
      "sessionType": "tempo / threshold",
      "changes": [{"field": "terrain", "from": "road", "to": "mixed", "reason": "Variety for neuromuscular adaptation"}]
    }
  ]
}

Return ONLY valid JSON. Exactly ${plan.length} workouts.`;
}

/* ── Build retry prompt ───────────────────────────────────────────────── */

function buildRetryPrompt(violations: Violation[], logicOutput: LogicOutput): string {
  const violationLines = violations
    .filter((v) => v.severity === 'hard')
    .map((v) => `- [Workout ${v.workoutIndex + 1}] ${v.rule}: ${v.detail}`)
    .join('\n');

  return `Your previous plan FAILED validation. Fix these violations:

${violationLines}

Constraints reminder:
- Max spec change: ±${logicOutput.constraints.maxSpecDeltaPercent}%
- Max sessions modifiable: ${logicOutput.constraints.maxSessionsModifiable}
- Allowed intensities: ${logicOutput.constraints.phaseRules.allowedIntensities.join(', ')}
- Weekly load ceiling: ${logicOutput.constraints.weeklyLoadCeiling}

Original plan specs (revert to these if needed):
${JSON.stringify(logicOutput.plan, null, 2)}

Return corrected JSON with "workouts" array. Same format as before. Exactly ${logicOutput.plan.length} workouts.`;
}

/* ── Parse GROQ response into EnhancedWorkout[] ───────────────────────── */

function parseGroqResponse(responseText: string, original: PlannedWorkout[]): EnhancedWorkout[] {
  const parsed = JSON.parse(responseText);
  const aiWorkouts = parsed.workouts || parsed.suggestions || [];

  if (!Array.isArray(aiWorkouts) || aiWorkouts.length === 0) {
    throw new Error('Empty workouts array from AI');
  }

  return aiWorkouts.map((ai: any, i: number) => {
    const logic = original[i] || original[0];

    // Enforce immutables from logic
    const type = logic.type;
    const date = logic.date;

    // Allow bounded modifications
    const intensity = ai.intensity || logic.intensity;
    const durationMin = typeof ai.durationMin === 'number' ? ai.durationMin : logic.durationMin;
    const sessionLoad = computeSessionLoad(durationMin, intensity);

    // Merge specs: AI can modify values within type, but can't change type key
    const mergedSpecs: Record<string, any> = {};
    const origSpec = logic.specs[type] || {};
    const aiSpec = ai.specs?.[type] || ai[type] || {};
    mergedSpecs[type] = { ...origSpec, ...aiSpec };

    // Sync time field in specs with durationMin
    if (mergedSpecs[type].time !== undefined) {
      mergedSpecs[type].time = typeof aiSpec.time === 'number' ? aiSpec.time : durationMin;
    }

    return {
      type,
      date,
      intensity,
      focus: ai.focus || logic.focus,
      durationMin,
      sessionLoad,
      specs: mergedSpecs,
      name: typeof ai.name === 'string' ? ai.name : '',
      description: typeof ai.description === 'string' ? ai.description : '',
      rationale: typeof ai.rationale === 'string' ? ai.rationale : '',
      benefits: Array.isArray(ai.benefits) ? ai.benefits.slice(0, 5) : [],
      tags: Array.isArray(ai.tags) ? ai.tags.slice(0, 5) : [intensity],
      warmup: typeof ai.warmup === 'string' ? ai.warmup : '',
      mainSet: typeof ai.mainSet === 'string' ? ai.mainSet : '',
      cooldown: typeof ai.cooldown === 'string' ? ai.cooldown : '',
      sessionType: typeof ai.sessionType === 'string' ? ai.sessionType : logic.focus,
      aiModified: false, // set by validator
      changesCount: Array.isArray(ai.changes) ? ai.changes.length : 0,
      loadDeltaPercent: 0, // set by validator
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   API ROUTE
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recentWorkouts, athleteProfile } = body;
    const apiKey = process.env.GROQ_API_KEY;

    // ── Step 1: Logic Engine ──
    const logicOutput = generateLogicOutput(athleteProfile || {}, recentWorkouts || []);

    const analysis = {
      totalWorkouts: logicOutput.athlete.historySummary.totalWorkouts,
      workoutsByType: logicOutput.athlete.historySummary.typeCounts,
      completedRate: logicOutput.athlete.historySummary.completedRate,
      avgDuration: logicOutput.athlete.historySummary.avgDuration,
      daysSinceLast: logicOutput.athlete.historySummary.daysSinceLast,
      phase: logicOutput.athlete.phase,
      weeksOut: logicOutput.athlete.weeksOut,
      deload: logicOutput.athlete.deload,
      fatigueState: logicOutput.athlete.fatigueState,
    };

    // No API key → logic-only
    if (!apiKey) {
      return NextResponse.json({
        suggestions: buildFallback(logicOutput),
        analysis,
        validationPass: true,
        aiEnhanced: false,
        success: true,
      });
    }

    // ── Step 2: GROQ Enhancement ──
    const groq = new Groq({ apiKey });
    const systemMsg = 'You are an expert endurance coach reviewing an algorithm-generated plan. Modify within stated bounds. Document changes. Return valid JSON only.';

    let finalPlan: EnhancedWorkout[] | null = null;
    let lastViolations: Violation[] = [];
    let attempts = 0;
    let validationPassed = false;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      attempts = attempt + 1;

      const userMsg = attempt === 0
        ? buildPrompt(logicOutput, recentWorkouts || [])
        : buildRetryPrompt(lastViolations, logicOutput);

      try {
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: userMsg },
          ],
          temperature: attempt === 0 ? 0.7 : 0.4, // lower temp on retry
          max_tokens: 8000,
          response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        const enhanced = parseGroqResponse(responseText, logicOutput.plan);

        // ── Step 3: Validate ──
        const result = validatePlan(
          logicOutput.plan,
          enhanced,
          logicOutput.constraints,
          logicOutput.athlete.historySummary.avgPaces,
          logicOutput.athlete.deload
        );

        if (result.valid && result.adjustedPlan) {
          finalPlan = result.adjustedPlan;
          validationPassed = true;
          console.log(`✅ Validation passed on attempt ${attempts} (load delta: ${result.loadDeltaPercent}%)`);
          break;
        } else {
          const hardCount = result.violations.filter((v) => v.severity === 'hard').length;
          console.log(`⚠️ Attempt ${attempts} failed: ${hardCount} hard violations`);
          result.violations.filter((v) => v.severity === 'hard').forEach((v) => console.log(`  - ${v.rule}: ${v.detail}`));
          lastViolations = result.violations;
        }
      } catch (groqError: any) {
        console.error(`❌ GROQ attempt ${attempts} error:`, groqError.message);
        break; // don't retry on API errors
      }
    }

    // ── Step 4: Fallback if validation never passed ──
    if (!finalPlan) {
      console.log(`⚠️ All ${attempts} attempts failed, using logic-only fallback`);
      finalPlan = buildFallback(logicOutput);
      validationPassed = false;
    }

    return NextResponse.json({
      suggestions: finalPlan,
      analysis,
      validationPass: validationPassed,
      aiEnhanced: validationPassed,
      attempts,
      success: true,
    });
  } catch (error: any) {
    console.error('❌ Workout suggestions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions', success: false },
      { status: 500 }
    );
  }
}
