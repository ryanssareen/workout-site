import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC ENGINE — deterministic training plan generation
   ═══════════════════════════════════════════════════════════════════════════ */

interface AthleteProfile {
  sportPreferences?: string[];
  fitnessGoals?: string[];
  trainingFor?: string[];
  experienceLevel?: string;
  ageRange?: string;
  eventDate?: string;
  weeklyAvailability?: string;
  bio?: string;
  timezone?: string;
}

interface LogicPlan {
  type: 'run' | 'swim' | 'bike' | 'strength' | 'other';
  date: string;
  intensity: 'easy' | 'moderate' | 'hard';
  focus: string;
  durationMin: number;
  specs: Record<string, any>;
}

/* ── Constants ────────────────────────────────────────────────────────── */

const EXPERIENCE_MULTIPLIER: Record<string, number> = {
  Beginner: 0.6,
  Intermediate: 1.0,
  Advanced: 1.4,
};

const AVAILABILITY_DAYS: Record<string, number> = {
  '1–2 days': 2,
  '3–4 days': 3,
  '5–6 days': 5,
  '7 days': 6,
};

const VALID_TAGS = new Set([
  'easy', 'moderate', 'hard', 'recovery', 'speed', 'endurance',
  'intervals', 'tempo', 'long', 'strength', 'technique', 'race',
]);

/* ── Helpers ──────────────────────────────────────────────────────────── */

function parseAvailability(avail?: string): number {
  return AVAILABILITY_DAYS[avail || ''] || 3;
}

function getExpMultiplier(level?: string): number {
  return EXPERIENCE_MULTIPLIER[level || ''] || 1.0;
}

function sportToType(sport: string): 'run' | 'swim' | 'bike' | 'strength' | 'other' {
  const l = sport.toLowerCase();
  if (l.includes('run')) return 'run';
  if (l.includes('swim')) return 'swim';
  if (l.includes('bik') || l.includes('cycl')) return 'bike';
  if (l.includes('ironman') || l.includes('triath')) return 'run';
  if (l.includes('strength')) return 'strength';
  return 'other';
}

/* ── History Analysis (recency-weighted) ──────────────────────────────── */

function analyzeHistory(workouts: any[]) {
  const typeCounts: Record<string, number> = {};
  const weightedDurations: number[] = [];
  const weightedDistances: Record<string, number[]> = {};
  const pacesByType: Record<string, number[]> = {}; // min/km or min/100m
  let completedCount = 0;
  let totalLoad = 0;        // fatigue: Σ(duration × intensity)
  let recentWeekLoad = 0;   // last 7 days only
  const dates: Date[] = [];
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;

  const INTENSITY_LOAD: Record<string, number> = { easy: 0.6, moderate: 1.0, hard: 1.5 };

  (workouts || []).forEach((w: any, idx: number) => {
    if (!w) return;
    // Recency weight: most recent gets 1.0, oldest gets 0.4
    const total = (workouts || []).length;
    const recencyWeight = 0.4 + 0.6 * ((total - idx) / total);

    typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
    if (w.completed) completedCount++;

    const dur = w.duration ?? w.run?.time ?? w.bike?.time ?? w.swim?.time ?? w.strength?.totalTime ?? w.other?.duration;
    if (typeof dur === 'number') weightedDurations.push(dur * recencyWeight);

    // Distances (recency-weighted)
    if (w.type === 'run' && w.run?.distance) {
      (weightedDistances['run'] = weightedDistances['run'] || []).push(w.run.distance * recencyWeight);
      if (w.run.time && w.run.distance > 0) {
        (pacesByType['run'] = pacesByType['run'] || []).push(w.run.time / w.run.distance);
      }
    }
    if (w.type === 'bike' && w.bike?.distance) {
      (weightedDistances['bike'] = weightedDistances['bike'] || []).push(w.bike.distance * recencyWeight);
      if (w.bike.time && w.bike.distance > 0) {
        (pacesByType['bike'] = pacesByType['bike'] || []).push(w.bike.time / w.bike.distance);
      }
    }
    if (w.type === 'swim' && w.swim?.distance) {
      (weightedDistances['swim'] = weightedDistances['swim'] || []).push(w.swim.distance * recencyWeight);
      if (w.swim.time && w.swim.distance > 0) {
        (pacesByType['swim'] = pacesByType['swim'] || []).push(w.swim.time / w.swim.distance);
      }
    }

    // Fatigue load
    const tags = Array.isArray(w.tags) ? w.tags : [];
    const intensityTag = tags.find((t: string) => INTENSITY_LOAD[t]) || 'moderate';
    const loadMult = INTENSITY_LOAD[intensityTag] || 1.0;
    const sessionLoad = (typeof dur === 'number' ? dur : 30) * loadMult;
    totalLoad += sessionLoad;

    const d = w.date ? new Date(w.date) : null;
    if (d && !isNaN(d.getTime())) {
      dates.push(d);
      if (d.getTime() >= sevenDaysAgo) recentWeekLoad += sessionLoad;
    }
  });

  // Weighted averages
  const avgDuration = weightedDurations.length > 0
    ? Math.round(weightedDurations.reduce((a, b) => a + b, 0) / weightedDurations.length)
    : 45;

  const avgDistances: Record<string, number> = {};
  for (const [type, dists] of Object.entries(weightedDistances)) {
    avgDistances[type] = dists.reduce((a, b) => a + b, 0) / dists.length;
  }

  const avgPaces: Record<string, number> = {};
  for (const [type, paces] of Object.entries(pacesByType)) {
    avgPaces[type] = paces.reduce((a, b) => a + b, 0) / paces.length;
  }

  const sortedDates = dates.sort((a, b) => b.getTime() - a.getTime());
  const lastWorkoutDate = sortedDates[0] || null;
  const daysSinceLast = lastWorkoutDate ? Math.round((now - lastWorkoutDate.getTime()) / 86400000) : 14;

  const completionRate = workouts?.length > 0 ? Math.round((completedCount / workouts.length) * 100) : 0;

  return {
    typeCounts,
    totalWorkouts: (workouts || []).length,
    completedCount,
    completionRate,
    avgDuration,
    avgDistances,
    avgPaces,
    daysSinceLast,
    lastWorkoutDate,
    totalLoad,
    recentWeekLoad,
  };
}

/* ── Event Periodization ──────────────────────────────────────────────── */

type TrainingPhase = 'base' | 'build' | 'peak' | 'taper' | 'recovery' | 'general';

function getTrainingPhase(eventDate?: string): { phase: TrainingPhase; weeksOut: number | null } {
  if (!eventDate) return { phase: 'general', weeksOut: null };
  const event = new Date(eventDate);
  if (isNaN(event.getTime())) return { phase: 'general', weeksOut: null };

  const weeksOut = Math.round((event.getTime() - Date.now()) / (7 * 86400000));
  if (weeksOut <= 0) return { phase: 'recovery', weeksOut: 0 };
  if (weeksOut <= 2) return { phase: 'taper', weeksOut };
  if (weeksOut <= 5) return { phase: 'peak', weeksOut };
  if (weeksOut <= 10) return { phase: 'build', weeksOut };
  return { phase: 'base', weeksOut };
}

function phaseIntensityBias(phase: TrainingPhase): { volumeMult: number; intensityBias: 'easy' | 'moderate' | 'hard' } {
  switch (phase) {
    case 'taper': return { volumeMult: 0.6, intensityBias: 'easy' };
    case 'recovery': return { volumeMult: 0.5, intensityBias: 'easy' };
    case 'base': return { volumeMult: 0.85, intensityBias: 'moderate' };
    case 'build': return { volumeMult: 1.0, intensityBias: 'moderate' };
    case 'peak': return { volumeMult: 1.1, intensityBias: 'hard' };
    default: return { volumeMult: 1.0, intensityBias: 'moderate' };
  }
}

/* ── Progressive Overload with Guardrails ─────────────────────────────── */

function getProgressionRate(completionRate: number, phase: TrainingPhase): number {
  // Cap progression if completion is low
  if (completionRate < 60) return 0.95; // reduce load
  if (completionRate < 80) return 1.0;  // maintain
  // Phase-aware progression
  if (phase === 'taper' || phase === 'recovery') return 0.9;
  if (phase === 'base') return 1.05;
  if (phase === 'peak') return 1.08;
  return 1.06; // default ~6% build
}

function shouldDeload(totalWorkouts: number): boolean {
  // Every 4th week = deload
  // Approximate: if recent history shows 12+ workouts (3 weeks × 4/week), trigger deload
  return totalWorkouts > 0 && totalWorkouts % 12 < 3;
}

/* ── Schedule Dates ───────────────────────────────────────────────────── */

function getNextDates(count: number, availDays: number): string[] {
  const dates: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const gap = Math.max(1, Math.round(7 / availDays));
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + gap);
  }
  return dates;
}

/* ── Type Selection ───────────────────────────────────────────────────── */

function pickTypes(
  sports: string[],
  history: ReturnType<typeof analyzeHistory>,
  count: number
): ('run' | 'swim' | 'bike' | 'strength' | 'other')[] {
  let pool: ('run' | 'swim' | 'bike' | 'strength' | 'other')[] = [];
  for (const s of sports) {
    const l = s.toLowerCase();
    if (l.includes('ironman') || l.includes('triath')) {
      pool.push('run', 'swim', 'bike');
    } else {
      pool.push(sportToType(s));
    }
  }
  pool = [...new Set(pool)];
  if (pool.length === 1) pool.push('strength');

  // Prioritize underrepresented types
  const sorted = pool.sort((a, b) => (history.typeCounts[a] || 0) - (history.typeCounts[b] || 0));
  const result: typeof pool = [];
  for (let i = 0; i < count; i++) {
    result.push(sorted[i % sorted.length]);
  }
  return result;
}

/* ── Intensity Selection ──────────────────────────────────────────────── */

function pickIntensities(
  count: number,
  daysSinceLast: number,
  phase: TrainingPhase,
  recentWeekLoad: number,
  avgDuration: number
): ('easy' | 'moderate' | 'hard')[] {
  // Fatigue guard: if recent load is high, force easier
  const highLoadThreshold = avgDuration * 5; // rough: 5 sessions worth
  const fatigued = recentWeekLoad > highLoadThreshold;

  if (fatigued || daysSinceLast >= 7) {
    const base: ('easy' | 'moderate' | 'hard')[] = ['easy', 'moderate', 'easy'];
    return base.slice(0, count);
  }

  // Phase-based patterns
  const patterns: Record<TrainingPhase, ('easy' | 'moderate' | 'hard')[]> = {
    taper: ['easy', 'moderate', 'easy'],
    recovery: ['easy', 'easy', 'moderate'],
    base: ['moderate', 'easy', 'moderate'],
    build: ['moderate', 'hard', 'easy'],
    peak: ['hard', 'moderate', 'hard'],
    general: ['moderate', 'hard', 'easy'],
  };

  const pattern = patterns[phase] || patterns.general;
  return pattern.slice(0, count);
}

/* ── Spec Builder (pace-consistent) ───────────────────────────────────── */

function buildSpecs(
  type: string,
  intensity: 'easy' | 'moderate' | 'hard',
  exp: number,
  avgDist: Record<string, number>,
  avgPaces: Record<string, number>,
  avgDur: number,
  progressionRate: number,
  volumeMult: number,
  deload: boolean
): { durationMin: number; specs: Record<string, any> } {
  const deloadMult = deload ? 0.7 : 1.0;
  const intensityMult = intensity === 'easy' ? 0.8 : intensity === 'hard' ? 1.2 : 1.0;
  const totalMult = progressionRate * volumeMult * deloadMult;

  switch (type) {
    case 'run': {
      const baseDist = (avgDist['run'] || 5) * totalMult;
      const dist = Math.round(baseDist * intensityMult * 10) / 10;
      // Pace-consistent: derive time from distance × avg pace
      const pace = avgPaces['run'] || 6; // min/km default
      const time = Math.round(dist * pace * (intensity === 'easy' ? 1.1 : intensity === 'hard' ? 0.95 : 1.0));
      return {
        durationMin: time || 45,
        specs: {
          run: {
            distance: dist,
            distanceUnit: 'km',
            time: time || 45,
            terrain: intensity === 'hard' ? 'track' : 'road',
            elevationGain: intensity === 'hard' ? Math.round(100 * exp) : 0,
          },
        },
      };
    }
    case 'swim': {
      const baseDist = (avgDist['swim'] || 1500) * totalMult;
      const dist = Math.round(baseDist * intensityMult);
      const pace = avgPaces['swim'] || 0.025; // min/m default ~2:30/100m
      const time = Math.round(dist * pace * (intensity === 'easy' ? 1.1 : 1.0));
      return {
        durationMin: time || 40,
        specs: {
          swim: {
            distance: dist,
            distanceUnit: 'meters',
            time: time || 40,
            strokeType: 'freestyle',
            poolLength: 25,
          },
        },
      };
    }
    case 'bike': {
      const baseDist = (avgDist['bike'] || 25) * totalMult;
      const dist = Math.round(baseDist * intensityMult * 10) / 10;
      const pace = avgPaces['bike'] || 2.4; // min/km default ~25km/h
      const time = Math.round(dist * pace * (intensity === 'easy' ? 1.1 : intensity === 'hard' ? 0.95 : 1.0));
      return {
        durationMin: time || 60,
        specs: {
          bike: {
            distance: dist,
            distanceUnit: 'km',
            time: time || 60,
            avgCadence: intensity === 'hard' ? 90 : 80,
            elevationGain: intensity === 'hard' ? Math.round(400 * exp) : Math.round(100 * exp),
          },
        },
      };
    }
    case 'strength': {
      const time = Math.round(45 * exp * intensityMult * deloadMult);
      return {
        durationMin: time || 45,
        specs: {
          strength: {
            totalTime: time || 45,
            rpe: intensity === 'easy' ? 5 : intensity === 'hard' ? 8 : 6,
            exercises: [],
          },
        },
      };
    }
    default: {
      return {
        durationMin: Math.round(40 * exp * deloadMult),
        specs: {
          other: {
            duration: Math.round(40 * exp * deloadMult),
            description: '',
          },
        },
      };
    }
  }
}

/* ── Core Logic Engine ────────────────────────────────────────────────── */

function generateLogicPlans(profile: AthleteProfile, workouts: any[]): LogicPlan[] {
  const history = analyzeHistory(workouts);
  const exp = getExpMultiplier(profile.experienceLevel);
  const availDays = parseAvailability(profile.weeklyAvailability);
  const sports = profile.sportPreferences || ['Running'];
  const count = 3;

  const { phase } = getTrainingPhase(profile.eventDate);
  const { volumeMult } = phaseIntensityBias(phase);
  const progressionRate = getProgressionRate(history.completionRate, phase);
  const deload = shouldDeload(history.totalWorkouts);

  const dates = getNextDates(count, availDays);
  const types = pickTypes(sports, history, count);
  const intensities = pickIntensities(count, history.daysSinceLast, phase, history.recentWeekLoad, history.avgDuration);

  const focusMap: Record<string, Record<string, string>> = {
    easy: { run: 'recovery / base building', swim: 'technique / easy aerobic', bike: 'easy spin / active recovery', strength: 'mobility / activation', other: 'cross-training' },
    moderate: { run: 'tempo / threshold', swim: 'aerobic endurance', bike: 'endurance / tempo', strength: 'hypertrophy / strength', other: 'moderate effort' },
    hard: { run: 'intervals / VO2max', swim: 'sprint sets / race pace', bike: 'hill repeats / power intervals', strength: 'max effort / heavy lifts', other: 'high intensity' },
  };

  const plans: LogicPlan[] = [];
  for (let i = 0; i < count; i++) {
    const { durationMin, specs } = buildSpecs(
      types[i], intensities[i], exp,
      history.avgDistances, history.avgPaces, history.avgDuration,
      progressionRate, volumeMult, deload
    );

    plans.push({
      type: types[i],
      date: dates[i],
      intensity: intensities[i],
      focus: focusMap[intensities[i]]?.[types[i]] || 'general fitness',
      durationMin,
      specs,
    });
  }
  return plans;
}

/* ═══════════════════════════════════════════════════════════════════════════
   API ROUTE
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recentWorkouts, athleteProfile } = body;
    const apiKey = process.env.GROQ_API_KEY;

    // ── Step 1: Logic engine ──
    const logicPlans = generateLogicPlans(athleteProfile || {}, recentWorkouts || []);
    const history = analyzeHistory(recentWorkouts || []);
    const { phase, weeksOut } = getTrainingPhase(athleteProfile?.eventDate);
    const deload = shouldDeload(history.totalWorkouts);

    const analysis = {
      totalWorkouts: history.totalWorkouts,
      workoutsByType: history.typeCounts,
      completedRate: history.completionRate,
      avgDuration: history.avgDuration,
      daysSinceLast: history.daysSinceLast,
      phase,
      weeksOut,
      deload,
    };

    // No API key → logic-only fallback
    if (!apiKey) {
      const fallback = logicPlans.map((p) => ({
        name: `${p.intensity.charAt(0).toUpperCase() + p.intensity.slice(1)} ${p.type.charAt(0).toUpperCase() + p.type.slice(1)} Session`,
        type: p.type,
        date: p.date,
        difficulty: p.intensity,
        estimatedDuration: p.durationMin,
        description: `${deload ? '[DELOAD] ' : ''}A ${p.intensity} ${p.type} session focused on ${p.focus}.${phase !== 'general' ? ` (${phase} phase${weeksOut ? `, ${weeksOut}w to event` : ''})` : ''}`,
        sessionType: p.focus,
        tags: [p.intensity],
        ...p.specs,
      }));
      return NextResponse.json({ suggestions: fallback, analysis, success: true });
    }

    // ── Step 2: AI enhancement ──
    const groq = new Groq({ apiKey });

    const profileSummary = [
      `Experience: ${athleteProfile?.experienceLevel || 'Intermediate'}`,
      `Sports: ${athleteProfile?.sportPreferences?.join(', ') || 'Multi-sport'}`,
      `Goals: ${athleteProfile?.trainingFor?.join(', ') || athleteProfile?.fitnessGoals?.join(', ') || 'General fitness'}`,
      athleteProfile?.eventDate ? `Event date: ${athleteProfile.eventDate} (${weeksOut}w out, ${phase} phase)` : null,
      athleteProfile?.ageRange ? `Age: ${athleteProfile.ageRange}` : null,
      athleteProfile?.weeklyAvailability ? `Availability: ${athleteProfile.weeklyAvailability}` : null,
      deload ? '⚠️ DELOAD WEEK — reduce volume ~30%, keep intensity moderate-low' : null,
      phase === 'taper' ? '⚠️ TAPER PHASE — reduce volume, maintain sharpness with short quality efforts' : null,
    ].filter(Boolean).join('\n');

    const recentHistory = (recentWorkouts || []).slice(0, 8).map((w: any) => {
      const d = w.date ? new Date(w.date) : null;
      const dateStr = d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'Recent';
      const dur = w.duration ?? w.run?.time ?? w.bike?.time ?? w.swim?.time ?? w.strength?.totalTime ?? 0;
      const dist = w.run?.distance ? `${w.run.distance}${w.run.distanceUnit}` : w.bike?.distance ? `${w.bike.distance}${w.bike.distanceUnit}` : w.swim?.distance ? `${w.swim.distance}${w.swim.distanceUnit}` : '';
      return `- ${(w.type || 'other').toUpperCase()}: ${w.name || 'Unnamed'} (${dateStr}) ${w.completed ? '✅' : '❌'} ${dur}min ${dist}`.trim();
    }).join('\n') || 'No recent workouts';

    const planSummary = logicPlans.map((p, i) => {
      const typeData = p.specs[p.type] || {};
      return `Workout ${i + 1}: ${p.type.toUpperCase()} on ${p.date}, ${p.intensity}, ~${p.durationMin}min, focus: ${p.focus}. Specs: ${JSON.stringify(typeData)}`;
    }).join('\n');

    const prompt = `You are an expert endurance coach. I have computed a structured training plan using an algorithm. Enhance each workout with creative names, descriptions, warmup/mainSet/cooldown, and coaching rationale.

## ATHLETE
${profileSummary}

## RECENT HISTORY (${history.completionRate}% completion rate, ${history.daysSinceLast}d since last)
${recentHistory}

## LOGIC-GENERATED PLAN (enhance these, do NOT change type/date/specs)
${planSummary}

Return ONLY valid JSON:
{
  "workouts": [
    {
      "name": "Creative workout name",
      "type": "run",
      "date": "2026-02-22",
      "difficulty": "moderate",
      "estimatedDuration": 45,
      "description": "One-line summary",
      "sessionType": "tempo / threshold",
      "rationale": "Why this workout now",
      "benefits": ["benefit1", "benefit2"],
      "tags": ["tempo", "endurance"],
      "warmup": "Detailed warmup",
      "mainSet": "Specific main set with intervals/distances/paces",
      "cooldown": "Detailed cooldown",
      "run": { "distance": 8, "distanceUnit": "km", "time": 45, "terrain": "road", "elevationGain": 0 }
    }
  ]
}

RULES:
- Keep EXACT type, date, and numeric specs
- mainSet must be very specific
- rationale must reference athlete's history/level/phase
- tags from: easy, moderate, hard, recovery, speed, endurance, intervals, tempo, long, strength, technique, race
- Return exactly 3 workouts`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an expert endurance sports coach. Enhance structured workout plans with creative details. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    let suggestions;

    try {
      const parsed = JSON.parse(responseText);
      const aiWorkouts = parsed.workouts || parsed.suggestions || [];

      if (!Array.isArray(aiWorkouts) || aiWorkouts.length === 0) throw new Error('Empty AI response');

      // ── Step 3: Merge with validation ──
      suggestions = aiWorkouts.map((ai: any, i: number) => {
        const logic = logicPlans[i] || logicPlans[0];
        // Validate tags
        const validTags = Array.isArray(ai.tags)
          ? ai.tags.filter((t: string) => VALID_TAGS.has(t)).slice(0, 5)
          : [logic.intensity];

        return {
          name: typeof ai.name === 'string' && ai.name.length < 80 ? ai.name : `${logic.intensity} ${logic.type} Session`,
          description: typeof ai.description === 'string' && ai.description.length < 300 ? ai.description : '',
          rationale: typeof ai.rationale === 'string' && ai.rationale.length < 500 ? ai.rationale : '',
          benefits: Array.isArray(ai.benefits) ? ai.benefits.slice(0, 5) : [],
          tags: validTags,
          warmup: typeof ai.warmup === 'string' && ai.warmup.length < 500 ? ai.warmup : '',
          mainSet: typeof ai.mainSet === 'string' && ai.mainSet.length < 500 ? ai.mainSet : '',
          cooldown: typeof ai.cooldown === 'string' && ai.cooldown.length < 500 ? ai.cooldown : '',
          sessionType: typeof ai.sessionType === 'string' ? ai.sessionType : logic.focus,
          // Logic-enforced
          type: logic.type,
          date: logic.date,
          difficulty: logic.intensity,
          estimatedDuration: logic.durationMin,
          ...logic.specs,
        };
      });
    } catch (parseError) {
      console.error('AI parse failed, logic-only fallback:', parseError);
      suggestions = logicPlans.map((p) => ({
        name: `${p.intensity.charAt(0).toUpperCase() + p.intensity.slice(1)} ${p.type.charAt(0).toUpperCase() + p.type.slice(1)} Session`,
        type: p.type, date: p.date, difficulty: p.intensity, estimatedDuration: p.durationMin,
        description: `A ${p.intensity} ${p.type} session focused on ${p.focus}.`,
        sessionType: p.focus, tags: [p.intensity],
        ...p.specs,
      }));
    }

    return NextResponse.json({ suggestions, analysis, success: true });
  } catch (error: any) {
    console.error('❌ Workout suggestions error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate suggestions', success: false }, { status: 500 });
  }
}
