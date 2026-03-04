/**
 * Groq-based duplicate detection for workouts.
 * Runs after every Strava sync/webhook — sends full user activity dataset
 * to Groq, gets structured JSON of duplicates to delete.
 */

import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

interface WorkoutSummary {
  id: string;
  name: string;
  type: string;
  date: string;
  duration: number; // minutes
  distance: number; // meters
  source: string;
  stravaActivityId?: string;
  completed: boolean;
  avgHeartRate?: number;
  calories?: number;
}

export interface DedupResult {
  duplicatesFound: number;
  deletions: Array<{
    deleteId: string;
    keepId: string;
    reason: string;
  }>;
  analysisTimestamp: string;
  model: string;
  fallbackUsed: boolean;
}

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are a workout duplicate detection engine. You receive a JSON array of workout records for a single user and must identify duplicates.

DUPLICATE CRITERIA (in priority order):
1. EXACT STRAVA MATCH: Same stravaActivityId → always duplicates
2. STRAVA PROXIMITY: Same type, dates within 30 min, similar duration (±10 min) or distance (±5%)
3. MANUAL+STRAVA OVERLAP: Same type, same calendar day, similar duration (±30%) or distance (±15%), one is source "strava" and one is not
4. SAME NAME+DATE: Same name (case-insensitive), same type, same user, dates within 24 hours
5. CLOSE MATCH: Same type, dates within 2 hours, duration within 15%

For each duplicate pair, KEEP the record with richer data (prefer strava source, then the one with more stats). DELETE the other.

RESPOND WITH ONLY valid JSON — no markdown, no explanation, no backticks:
{
  "duplicates": [
    {
      "deleteId": "id_to_remove",
      "keepId": "id_to_keep", 
      "reason": "brief explanation"
    }
  ]
}

If no duplicates found, respond: {"duplicates":[]}`;

/**
 * Fetch all workouts for a user, formatted for Groq analysis
 */
async function fetchUserWorkouts(userId: string): Promise<WorkoutSummary[]> {
  const snapshot = await adminDb
    .collection('workouts')
    .where('assignedTo', '==', userId)
    .orderBy('date', 'desc')
    .limit(200) // Cap to keep under token limits
    .get();

  return snapshot.docs.map(doc => {
    const d = doc.data();
    const date = d.date?.toDate?.() ?? new Date(d.date);
    return {
      id: doc.id,
      name: d.name || '',
      type: d.type || 'other',
      date: date.toISOString(),
      duration: d.actualStats?.duration
        ? Math.round(d.actualStats.duration / 60)
        : d.duration || 0,
      distance: d.actualStats?.distance || 0,
      source: d.source || 'manual',
      stravaActivityId: d.stravaActivityId ? String(d.stravaActivityId) : undefined,
      completed: d.completed || false,
      avgHeartRate: d.actualStats?.avgHeartRate,
      calories: d.actualStats?.calories,
    };
  });
}

/**
 * Call Groq to analyze workouts for duplicates
 */
async function callGroqDedup(workouts: WorkoutSummary[]): Promise<DedupResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const userMessage = JSON.stringify(workouts);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{"duplicates":[]}';

  // Parse — strip markdown fences if present
  const clean = content.replace(/```json\s*|```/g, '').trim();
  const parsed = JSON.parse(clean);

  // Validate: only keep deletions that reference real workout IDs
  const validIds = new Set(workouts.map(w => w.id));
  const validDeletions = (parsed.duplicates || []).filter(
    (d: any) => validIds.has(d.deleteId) && validIds.has(d.keepId) && d.deleteId !== d.keepId
  );

  return {
    duplicatesFound: validDeletions.length,
    deletions: validDeletions,
    analysisTimestamp: new Date().toISOString(),
    model: GROQ_MODEL,
    fallbackUsed: false,
  };
}

/**
 * Deterministic fallback dedup (no AI needed)
 */
function deterministicDedup(workouts: WorkoutSummary[]): DedupResult {
  const deletions: DedupResult['deletions'] = [];
  const deleted = new Set<string>();

  // 1. Same stravaActivityId
  const byStravaId = new Map<string, WorkoutSummary[]>();
  for (const w of workouts) {
    if (w.stravaActivityId) {
      const key = w.stravaActivityId;
      if (!byStravaId.has(key)) byStravaId.set(key, []);
      byStravaId.get(key)!.push(w);
    }
  }
  for (const [, group] of byStravaId) {
    if (group.length > 1) {
      // Keep first, delete rest
      for (let i = 1; i < group.length; i++) {
        deletions.push({ deleteId: group[i].id, keepId: group[0].id, reason: 'Same Strava activity ID' });
        deleted.add(group[i].id);
      }
    }
  }

  // 2. Same type + close date + similar stats
  const remaining = workouts.filter(w => !deleted.has(w.id));
  for (let i = 0; i < remaining.length; i++) {
    if (deleted.has(remaining[i].id)) continue;
    for (let j = i + 1; j < remaining.length; j++) {
      if (deleted.has(remaining[j].id)) continue;
      const a = remaining[i], b = remaining[j];
      if (a.type !== b.type) continue;

      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      const hoursDiff = Math.abs(dateA - dateB) / (1000 * 60 * 60);

      // Same name + type + within 24h
      if (a.name.toLowerCase().trim() === b.name.toLowerCase().trim() && hoursDiff < 24) {
        const keep = a.source === 'strava' ? a : b;
        const del = keep === a ? b : a;
        deletions.push({ deleteId: del.id, keepId: keep.id, reason: `Same name "${a.name}" within 24h` });
        deleted.add(del.id);
        continue;
      }

      // Within 30 min + similar duration or distance
      if (hoursDiff < 0.5) {
        const durClose = a.duration > 0 && b.duration > 0 && Math.abs(a.duration - b.duration) < 10;
        const distClose = a.distance > 0 && b.distance > 0 &&
          Math.abs(a.distance - b.distance) / Math.max(a.distance, b.distance) < 0.05;
        if (durClose || distClose) {
          const keep = a.source === 'strava' ? a : b;
          const del = keep === a ? b : a;
          deletions.push({ deleteId: del.id, keepId: keep.id, reason: `Proximity match: ${hoursDiff.toFixed(1)}h apart, similar stats` });
          deleted.add(del.id);
        }
      }
    }
  }

  return {
    duplicatesFound: deletions.length,
    deletions,
    analysisTimestamp: new Date().toISOString(),
    model: 'deterministic',
    fallbackUsed: true,
  };
}

/**
 * Main dedup pipeline: Groq first, deterministic fallback.
 * Returns structured result. Does NOT delete — caller decides.
 */
export async function runDedupPipeline(userId: string): Promise<{
  workouts: WorkoutSummary[];
  result: DedupResult;
}> {
  const workouts = await fetchUserWorkouts(userId);
  if (workouts.length < 2) {
    return {
      workouts,
      result: {
        duplicatesFound: 0,
        deletions: [],
        analysisTimestamp: new Date().toISOString(),
        model: 'skipped',
        fallbackUsed: false,
      },
    };
  }

  let result: DedupResult;
  try {
    result = await callGroqDedup(workouts);
  } catch (err: any) {
    console.error('⚠️ Groq dedup failed, using deterministic fallback:', err.message);
    result = deterministicDedup(workouts);
  }

  return { workouts, result };
}

/**
 * Execute deletions from a dedup result
 */
export async function executeDedupDeletions(result: DedupResult): Promise<number> {
  if (result.deletions.length === 0) return 0;

  const batch = adminDb.batch();
  for (const d of result.deletions) {
    batch.delete(adminDb.collection('workouts').doc(d.deleteId));
  }
  await batch.commit();
  return result.deletions.length;
}
