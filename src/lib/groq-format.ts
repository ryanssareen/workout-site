/**
 * Groq-powered workout formatter.
 * Ensures every workout has a clean, consistent name, description, and tags
 * regardless of source (import, Strava, manual).
 *
 * Called:
 *  - After file-import confirm (batch)
 *  - After Strava sync/webhook (single)
 *  - On-demand via /api/ai/format-workouts for existing data
 */

import Groq from 'groq-sdk';

const MODEL = 'llama-3.3-70b-versatile';

export interface WorkoutForFormat {
  id: string;
  name: string;
  type: string;
  description?: string;
  duration?: number;
  tags?: string[];
  source?: string;
  // type-specific summaries
  swim?: { distance?: number; distanceUnit?: string; time?: number; strokeType?: string; poolLength?: number };
  bike?: { distance?: number; distanceUnit?: string; time?: number; avgPower?: number; elevationGain?: number };
  run?: { distance?: number; distanceUnit?: string; time?: number; pace?: string; terrain?: string; elevationGain?: number };
  strength?: { exercises?: Array<{ name: string; sets: number; reps: number; weight?: number }> };
  other?: { description?: string };
}

export interface FormattedWorkout {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

const VALID_TAGS = [
  'easy', 'moderate', 'hard', 'recovery', 'speed',
  'endurance', 'intervals', 'tempo', 'long', 'strength',
  'technique', 'race',
] as const;

// ─── Single Groq call to format a batch of workouts ────────────────────

const SYSTEM_PROMPT = `You are a fitness app formatter. You receive workout records and return consistently formatted versions.

RULES:
- "name" should be short (2-5 words), descriptive, and follow Title Case. Examples: "Morning Tempo Run", "Pool Technique Drill", "Upper Body Strength", "Recovery Spin".
- "description" should be 1-2 sentences summarising the session. Include key stats (distance, time, pace, exercises) naturally. If the original description is just raw Strava import text, rewrite it to be human-friendly.
- "tags" should be 1-3 tags from ONLY these options: ${VALID_TAGS.join(', ')}. Pick based on intensity/purpose. Never invent new tags.
- Preserve the workout ID exactly as given.
- If a workout already has a great name/description/tags, keep them (don't change for the sake of changing).

Return ONLY a JSON object: { "workouts": [ { "id": "...", "name": "...", "description": "...", "tags": ["..."] } ] }`;

function buildUserPrompt(workouts: WorkoutForFormat[]): string {
  const summaries = workouts.map(w => {
    const parts: string[] = [`id: "${w.id}"`, `type: ${w.type}`, `current_name: "${w.name}"`];
    if (w.description) parts.push(`current_desc: "${w.description.slice(0, 200)}"`);
    if (w.duration) parts.push(`duration: ${w.duration}min`);
    if (w.tags?.length) parts.push(`current_tags: [${w.tags.join(', ')}]`);
    if (w.source) parts.push(`source: ${w.source}`);

    if (w.run) {
      const r = w.run;
      parts.push(`run: ${r.distance || '?'}${r.distanceUnit || 'km'} in ${r.time || '?'}min${r.pace ? ` @ ${r.pace}` : ''}${r.terrain ? ` (${r.terrain})` : ''}`);
    }
    if (w.bike) {
      const b = w.bike;
      parts.push(`bike: ${b.distance || '?'}${b.distanceUnit || 'km'} in ${b.time || '?'}min${b.avgPower ? ` ${b.avgPower}W` : ''}${b.elevationGain ? ` +${b.elevationGain}m` : ''}`);
    }
    if (w.swim) {
      const s = w.swim;
      parts.push(`swim: ${s.distance || '?'}${s.distanceUnit || 'm'} in ${s.time || '?'}min${s.strokeType ? ` (${s.strokeType})` : ''}${s.poolLength ? ` ${s.poolLength}m pool` : ''}`);
    }
    if (w.strength?.exercises?.length) {
      const exList = w.strength.exercises.slice(0, 5).map(e =>
        `${e.name} ${e.sets}x${e.reps}${e.weight ? ` @${e.weight}` : ''}`
      ).join(', ');
      parts.push(`strength: [${exList}]`);
    }
    if (w.other?.description) parts.push(`other: "${w.other.description.slice(0, 100)}"`);

    return `{ ${parts.join(', ')} }`;
  });

  return `Format these ${workouts.length} workouts:\n${summaries.join('\n')}`;
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Format a batch of workouts via Groq. Max ~25 per call for token safety.
 * Returns only the workouts whose formatting changed.
 */
export async function formatWorkouts(workouts: WorkoutForFormat[]): Promise<FormattedWorkout[]> {
  if (workouts.length === 0) return [];

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('GROQ_API_KEY not set — skipping workout formatting');
    return [];
  }

  const groq = new Groq({ apiKey: apiKey.trim() });
  const results: FormattedWorkout[] = [];

  // Process in batches of 25
  const BATCH = 25;
  for (let i = 0; i < workouts.length; i += BATCH) {
    const batch = workouts.slice(i, i + BATCH);

    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(batch) },
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const text = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(text);
      const formatted: any[] = parsed.workouts || [];

      for (const fw of formatted) {
        // Validate that the ID matches one we sent
        const original = batch.find(w => w.id === fw.id);
        if (!original) continue;

        // Validate tags
        const cleanTags = (Array.isArray(fw.tags) ? fw.tags : [])
          .filter((t: string) => (VALID_TAGS as readonly string[]).includes(t))
          .slice(0, 3);

        // Only include if something actually changed
        const nameChanged = fw.name && fw.name !== original.name;
        const descChanged = fw.description && fw.description !== original.description;
        const tagsChanged = cleanTags.length > 0 && JSON.stringify(cleanTags) !== JSON.stringify(original.tags || []);

        if (nameChanged || descChanged || tagsChanged) {
          results.push({
            id: fw.id,
            name: typeof fw.name === 'string' ? fw.name.slice(0, 100) : original.name,
            description: typeof fw.description === 'string' ? fw.description.slice(0, 500) : original.description || '',
            tags: cleanTags.length > 0 ? cleanTags : original.tags || [],
          });
        }
      }
    } catch (error: any) {
      console.error(`Groq format batch failed (batch ${Math.floor(i / BATCH) + 1}):`, error.message);
      // Continue with next batch — don't fail the whole operation
    }
  }

  return results;
}

/**
 * Deterministic fallback formatter when Groq is unavailable.
 * Cleans up Strava-style names and generates basic descriptions.
 */
export function formatWorkoutFallback(w: WorkoutForFormat): FormattedWorkout {
  let name = w.name || '';
  let description = w.description || '';

  // Clean Strava "Imported from Strava\nDistance: ..." descriptions
  if (description.startsWith('Imported from Strava')) {
    const stats: string[] = [];
    if (w.run) stats.push(`${w.run.distance || 0} ${w.run.distanceUnit || 'km'} run in ${w.run.time || 0} min`);
    if (w.bike) stats.push(`${w.bike.distance || 0} ${w.bike.distanceUnit || 'km'} ride in ${w.bike.time || 0} min`);
    if (w.swim) stats.push(`${w.swim.distance || 0} ${w.swim.distanceUnit || 'm'} swim in ${w.swim.time || 0} min`);
    description = stats.length > 0 ? stats.join('. ') + '.' : `${w.type} workout — ${w.duration || 0} min.`;
  }

  // If name is empty or generic, generate one
  if (!name || name === 'Untitled' || name === 'Workout') {
    const typeLabel = w.type.charAt(0).toUpperCase() + w.type.slice(1);
    name = `${typeLabel} Session`;
    if (w.duration && w.duration >= 60) name = `Long ${typeLabel}`;
  }

  // Basic tag inference
  const tags: string[] = w.tags?.length ? [...w.tags] : [];
  if (tags.length === 0) {
    if (w.duration && w.duration >= 75) tags.push('long');
    else if (w.duration && w.duration <= 30) tags.push('easy');
    if (w.type === 'strength') tags.push('strength');
    if (tags.length === 0) tags.push('moderate');
  }

  return {
    id: w.id,
    name,
    description,
    tags: tags.filter(t => (VALID_TAGS as readonly string[]).includes(t)).slice(0, 3),
  };
}
