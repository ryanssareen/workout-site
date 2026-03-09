export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import Groq from 'groq-sdk';

const WORKOUT_TAGS = [
  'easy', 'moderate', 'hard', 'recovery', 'speed',
  'endurance', 'intervals', 'tempo', 'long', 'strength',
  'technique', 'race'
] as const;

type WorkoutTag = typeof WORKOUT_TAGS[number];

/**
 * POST /api/import/format-description
 * 
 * Reads workout descriptions and uses Groq AI to parse them into
 * structured type-specific data (run/bike/swim/strength/other).
 * 
 * Body:
 *   { workoutId: string }           — format a single workout
 *   { userId: string }              — format all description-only workouts for a user
 *   { all: true }                   — format all description-only workouts across ALL users
 *   { dryRun: true, ... }           — preview without writing to Firestore
 * 
 * Returns: { formatted: number, skipped: number, errors: number, results: [...] }
 */

async function parseDescriptionWithGroq(workout: any): Promise<any> {
  if (!process.env.GROQ_API_KEY) {
    return { error: 'GROQ_API_KEY not configured' };
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

  const prompt = `Analyze this workout description and extract structured data.

Workout name: "${workout.name || 'Untitled'}"
Workout type: "${workout.type || 'unknown'}"
Description: "${workout.description || ''}"
Duration (if set): ${workout.duration ? workout.duration + ' minutes' : 'not set'}

Extract the following into a JSON object:
{
  "type": "swim|run|bike|strength|other",
  "name": "cleaned up workout name if the original is vague, otherwise keep it",
  "duration": number_in_minutes_or_null,
  "tags": ["up to 3 tags from: easy, moderate, hard, recovery, speed, endurance, intervals, tempo, long, strength, technique, race"],
  "run": { "distance": number, "distanceUnit": "km|miles", "time": number_minutes, "pace": "M:SS/unit", "terrain": "road|trail|track|treadmill", "elevationGain": number_or_null } | null,
  "bike": { "distance": number, "distanceUnit": "km|miles", "time": number_minutes, "avgPower": number_or_null, "avgCadence": number_or_null, "elevationGain": number_or_null } | null,
  "swim": { "distance": number, "distanceUnit": "meters|yards", "time": number_minutes, "strokeType": "freestyle|backstroke|breaststroke|butterfly|mixed", "poolLength": number_or_null } | null,
  "strength": { "exercises": [{ "name": "string", "sets": number, "reps": number, "weight": number_or_null, "weightUnit": "kg|lbs" }], "totalTime": number_minutes_or_null, "rpe": number_1_to_10_or_null } | null,
  "other": { "description": "string", "duration": number_or_null } | null
}

Rules:
- Only populate ONE of run/bike/swim/strength/other based on the workout type
- If the description doesn't contain enough info for structured data, set the type-specific field to null
- Parse distances like "5k" as 5 km, "3mi" as 3 miles, "1500m" as 1500 meters
- Parse times like "1:30:00" as 90 minutes, "45min" as 45, "1h15m" as 75
- Parse strength like "Bench 3x8 185lbs" as { name: "Bench Press", sets: 3, reps: 8, weight: 185, weightUnit: "lbs" }
- If type is unknown, infer from description keywords
- Be conservative — if you can't parse a number, leave it null rather than guess

Return ONLY valid JSON, no explanation.`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a workout data parser. Return only valid JSON. Be precise with numbers.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '{}';
    return JSON.parse(response);
  } catch (error: any) {
    console.error('Groq parse error:', error.message);
    return { error: error.message };
  }
}

/**
 * Clean Groq output: strip undefined/null fields so Firestore doesn't choke.
 */
function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore).filter(x => x !== undefined);
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [k, v] of Object.entries(obj)) {
      const cv = cleanForFirestore(v);
      if (cv !== undefined) cleaned[k] = cv;
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  return obj;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workoutId, userId, all, dryRun } = body;

    if (!workoutId && !userId && !all) {
      return NextResponse.json(
        { error: 'Provide workoutId, userId, or all: true' },
        { status: 400 }
      );
    }

    // Gather workouts to process
    let workoutsSnap: admin.firestore.QuerySnapshot;

    if (workoutId) {
      const docSnap = await adminDb.collection('workouts').doc(workoutId).get();
      if (!docSnap.exists) {
        return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
      }
      // Wrap single doc in array-like for uniform processing
      workoutsSnap = { docs: [docSnap], size: 1 } as any;
    } else if (userId) {
      workoutsSnap = await adminDb
        .collection('workouts')
        .where('assignedTo', '==', userId)
        .get();
    } else {
      workoutsSnap = await adminDb.collection('workouts').get();
    }

    const results: any[] = [];
    let formatted = 0;
    let skipped = 0;
    let errors = 0;

    for (const docSnap of workoutsSnap.docs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const workout = { id: docSnap.id, ...docSnap.data() } as any;

      // Skip workouts that already have structured type-specific data
      const hasStructured = workout.swim || workout.bike || workout.run || workout.strength || workout.other;
      if (hasStructured && !workoutId) {
        // If processing a specific workout, always re-analyze; for bulk, skip existing
        skipped++;
        results.push({ id: workout.id, status: 'skipped', reason: 'already has structured data' });
        continue;
      }

      // Skip if no description and no useful data to parse
      if (!workout.description && !workout.name) {
        skipped++;
        results.push({ id: workout.id, status: 'skipped', reason: 'no description or name' });
        continue;
      }

      // Call Groq
      const parsed = await parseDescriptionWithGroq(workout);

      if (parsed.error) {
        errors++;
        results.push({ id: workout.id, status: 'error', error: parsed.error });
        continue;
      }

      // Build the update object
      const update: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

      // Update type if Groq inferred one and current is missing/unknown
      if (parsed.type && ['swim', 'run', 'bike', 'strength', 'other'].includes(parsed.type)) {
        update.type = parsed.type;
      }

      // Update name if Groq cleaned it up
      if (parsed.name && parsed.name !== workout.name) {
        update.name = parsed.name;
      }

      // Set duration if parsed and not already set
      if (parsed.duration && !workout.duration) {
        update.duration = parsed.duration;
      }

      // Add tags (merge with existing, cap at 5)
      if (parsed.tags && Array.isArray(parsed.tags)) {
        const validTags = parsed.tags.filter((t: string) => WORKOUT_TAGS.includes(t as WorkoutTag));
        const existingTags: string[] = workout.tags || [];
        const merged = [...new Set([...existingTags, ...validTags])].slice(0, 5);
        if (merged.length > 0) update.tags = merged;
      }

      // Set type-specific data
      const typeKey = parsed.type || workout.type;
      const TYPE_FIELDS = ['swim', 'bike', 'run', 'strength', 'other'] as const;
      for (const field of TYPE_FIELDS) {
        if (field === typeKey && parsed[field]) {
          const cleaned = cleanForFirestore(parsed[field]);
          if (cleaned) update[field] = cleaned;
        } else if (field !== typeKey) {
          // Clear mismatched type fields
          update[field] = admin.firestore.FieldValue.delete();
        }
      }

      if (dryRun) {
        formatted++;
        results.push({ id: workout.id, status: 'dry-run', parsed, wouldUpdate: update });
      } else {
        try {
          await adminDb.collection('workouts').doc(workout.id).update(update);
          formatted++;
          results.push({ id: workout.id, status: 'formatted', parsed });
        } catch (writeErr: any) {
          errors++;
          results.push({ id: workout.id, status: 'write-error', error: writeErr.message });
        }
      }

      // Rate limit: 100ms between Groq calls to avoid hitting limits
      if (workoutsSnap.docs.indexOf(docSnap) < workoutsSnap.docs.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return NextResponse.json({
      formatted,
      skipped,
      errors,
      total: workoutsSnap.size,
      dryRun: !!dryRun,
      results,
    });
  } catch (error: any) {
    console.error('Format description error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
