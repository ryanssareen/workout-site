import { SerializedWorkout } from './types';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const BATCH_SIZE = 25; // max workouts per Groq call

export interface EnrichedWorkout {
  rowIndex: number;
  name: string;         // standardized name
  description: string;  // generated description
  tags: string[];       // suggested tags
}

/**
 * Enrich a batch of workouts using Groq.
 * Single API call per batch — returns standardised names, descriptions, and tags.
 * Falls back gracefully if Groq is unavailable.
 */
export async function enrichWorkouts(workouts: SerializedWorkout[]): Promise<Map<number, EnrichedWorkout>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || workouts.length === 0) return new Map();

  const enriched = new Map<number, EnrichedWorkout>();

  // Process in batches
  for (let i = 0; i < workouts.length; i += BATCH_SIZE) {
    const batch = workouts.slice(i, i + BATCH_SIZE);
    try {
      const result = await callGroqEnrich(apiKey, batch);
      for (const item of result) {
        enriched.set(item.rowIndex, item);
      }
    } catch (err: any) {
      console.error(`⚠️ Groq enrichment failed for batch ${i}-${i + batch.length}:`, err.message);
      // Fallback: generate basic enrichments deterministically
      for (const w of batch) {
        enriched.set(w.rowIndex, deterministicEnrich(w));
      }
    }
  }

  return enriched;
}

async function callGroqEnrich(apiKey: string, workouts: SerializedWorkout[]): Promise<EnrichedWorkout[]> {
  const summaries = workouts.map(w => ({
    rowIndex: w.rowIndex,
    name: w.name,
    type: w.type,
    date: w.date,
    duration: w.duration,
    distance: w.distance,
    distanceUnit: w.distanceUnit,
    pace: w.pace,
    elevation: w.elevation,
    exercises: w.exercises?.map(e => `${e.name} ${e.sets}x${e.reps}${e.weight ? ` @${e.weight}${e.weightUnit || 'kg'}` : ''}`),
  }));

  const prompt = `You are a fitness coach formatting imported workout data for a training platform.

For each workout, produce:
1. **name**: A clean, consistent title. Rules:
   - Capitalize properly (title case)
   - Include the key metric if available (e.g. "5K Easy Run", "10x100m Freestyle", "Upper Body Strength")
   - Keep it concise (max 40 chars)
   - Don't repeat the sport type if it's already clear
2. **description**: A 1-2 sentence summary of the workout. Include available stats (distance, pace, duration, exercises).
3. **tags**: 1-3 tags from ONLY this list: ["easy","moderate","hard","recovery","speed","endurance","intervals","tempo","long","strength","technique","race"]

Respond ONLY with a JSON array, no markdown fences, no extra text:
[{"rowIndex": 0, "name": "...", "description": "...", "tags": ["...", "..."]}]

Workouts to format:
${JSON.stringify(summaries)}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '[]';

  // Strip markdown fences if present
  const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const parsed: EnrichedWorkout[] = JSON.parse(cleaned);
    // Validate tags against allowed list
    const ALLOWED_TAGS = new Set(['easy','moderate','hard','recovery','speed','endurance','intervals','tempo','long','strength','technique','race']);
    return parsed.map(item => ({
      ...item,
      tags: (item.tags || []).filter(t => ALLOWED_TAGS.has(t)).slice(0, 3),
      name: (item.name || '').slice(0, 60),
      description: (item.description || '').slice(0, 300),
    }));
  } catch {
    console.error('⚠️ Failed to parse Groq enrichment response');
    return workouts.map(w => deterministicEnrich(w));
  }
}

/** Fallback enrichment when Groq is unavailable */
function deterministicEnrich(w: SerializedWorkout): EnrichedWorkout {
  let name = toTitleCase(w.name || w.type);
  let description = '';
  const tags: string[] = [];

  // Build better name from data
  if (w.type === 'run' || w.type === 'bike') {
    const dist = w.distance ? `${w.distance}${w.distanceUnit === 'miles' ? 'mi' : 'km'}` : '';
    if (dist && !name.toLowerCase().includes(String(w.distance))) {
      name = `${dist} ${toTitleCase(w.type)}`;
    }
    description = [
      dist ? `Distance: ${dist}` : '',
      w.duration ? `Duration: ${w.duration} min` : '',
      w.pace ? `Pace: ${w.pace}` : '',
    ].filter(Boolean).join(' · ');
  } else if (w.type === 'swim') {
    const dist = w.distance ? `${w.distance}${w.distanceUnit || 'm'}` : '';
    if (dist) name = `${dist} Swim`;
    description = [
      dist ? `Distance: ${dist}` : '',
      w.duration ? `Duration: ${w.duration} min` : '',
    ].filter(Boolean).join(' · ');
  } else if (w.type === 'strength' && w.exercises?.length) {
    name = w.exercises.length <= 2
      ? w.exercises.map(e => toTitleCase(e.name)).join(' & ')
      : `${toTitleCase(w.type)} - ${w.exercises.length} Exercises`;
    description = w.exercises.map(e => `${e.name} ${e.sets}x${e.reps}`).join(', ');
    tags.push('strength');
  }

  // Guess intensity from duration/distance
  if (w.type === 'run') {
    if (w.distance && w.distance >= 15) tags.push('long', 'endurance');
    else if (w.duration && w.duration <= 25) tags.push('easy');
    else tags.push('moderate');
  }

  return {
    rowIndex: w.rowIndex,
    name: name.slice(0, 60),
    description: description.slice(0, 300),
    tags: tags.slice(0, 3),
  };
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, c => c.toUpperCase());
}
