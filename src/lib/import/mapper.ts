import Groq from 'groq-sdk';
import { ColumnMapping, RawRow } from './types';

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'day', 'when', 'workout date', 'activity date', 'timestamp'],
  name: ['name', 'title', 'workout', 'activity', 'activity name', 'exercise', 'workout name', 'what'],
  type: ['type', 'category', 'sport', 'activity type', 'workout type'],
  duration: ['duration', 'time', 'elapsed', 'elapsed time', 'moving time', 'total time', 'workout time', 'minutes', 'mins'],
  distance: ['distance', 'dist', 'km', 'miles', 'mi', 'meters', 'total distance'],
  description: ['description', 'notes', 'comments', 'details', 'note', 'workout notes'],
  sets: ['sets', 'set', 'set count'],
  reps: ['reps', 'repetitions', 'rep', 'rep count'],
  weight: ['weight', 'load', 'kg', 'lbs', 'pounds', 'kilos'],
  heartRate: ['heart rate', 'hr', 'avg hr', 'average heart rate', 'avg heart rate', 'bpm'],
  pace: ['pace', 'avg pace', 'average pace', 'min/km', 'min/mi'],
  elevation: ['elevation', 'elev', 'elevation gain', 'ascent', 'total ascent'],
  calories: ['calories', 'cals', 'kcal', 'energy', 'cal'],
  rpe: ['rpe', 'effort', 'intensity', 'perceived exertion'],
};

function heuristicMapping(headers: string[]): ColumnMapping {
  const mapping: Record<string, string | null> = {};
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = lowerHeaders.findIndex(h => aliases.includes(h));
    mapping[field] = idx >= 0 ? headers[idx] : null;
  }

  return {
    name: mapping.name || null,
    type: mapping.type || null,
    date: mapping.date || null,
    duration: mapping.duration || null,
    distance: mapping.distance || null,
    distanceUnit: null,
    description: mapping.description || null,
    sets: mapping.sets || null,
    reps: mapping.reps || null,
    weight: mapping.weight || null,
    weightUnit: null,
    heartRate: mapping.heartRate || null,
    pace: mapping.pace || null,
    elevation: mapping.elevation || null,
    calories: mapping.calories || null,
    rpe: mapping.rpe || null,
    confidence: 0.3,
    assumptions: ['AI unavailable — used heuristic header matching'],
    detectedFormat: 'unknown',
  };
}

export async function mapColumns(headers: string[], sampleRows: RawRow[]): Promise<ColumnMapping> {
  if (!process.env.GROQ_API_KEY) {
    console.warn('GROQ_API_KEY not set — falling back to heuristic mapping');
    return heuristicMapping(headers);
  }

  const prompt = `You are analyzing a workout spreadsheet to map its columns to a fitness tracking app.

HEADERS: ${JSON.stringify(headers)}

SAMPLE DATA (first ${sampleRows.length} rows):
${sampleRows.map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join('\n')}

Map each column to the closest field. The app tracks these workout types: swim, run, bike, strength, other.

Return ONLY valid JSON matching this schema:
{
  "name": "column header for workout name/title, or null",
  "type": "column header for workout type/category, or null",
  "date": "column header for date, or null",
  "duration": "column header for duration/time, or null",
  "distance": "column header for distance, or null",
  "distanceUnit": "km|miles|meters|yards or null (infer from sample data)",
  "description": "column header for notes/description, or null",
  "sets": "column header for sets, or null",
  "reps": "column header for reps, or null",
  "weight": "column header for weight lifted, or null",
  "weightUnit": "kg|lbs or null",
  "heartRate": "column header for heart rate, or null",
  "pace": "column header for pace, or null",
  "elevation": "column header for elevation gain, or null",
  "calories": "column header for calories, or null",
  "rpe": "column header for RPE/effort, or null",
  "confidence": 0.0-1.0,
  "assumptions": ["list of assumptions you made"],
  "detectedFormat": "training_log|strava_export|garmin_export|strong_app|generic|unknown",
  "typeInference": {
    "column": "which column to derive workout type from, if 'type' column doesn't exist",
    "rules": [
      {"pattern": "regex or keyword", "type": "run|bike|swim|strength|other"}
    ]
  },
  "tagSuggestions": [
    {"pattern": "regex or keyword in name/description", "tags": ["easy","hard","recovery","intervals","tempo","long","speed","endurance"]}
  ]
}

Important:
- Column values are EXACT header strings from the spreadsheet
- If a column doesn't exist, set it to null
- Look at actual data values to infer units, not just headers
- typeInference is critical when there's no explicit type column
- tagSuggestions gives keyword→tag rules from patterns you see in the data`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an expert at analyzing workout spreadsheets. Return ONLY valid JSON, no markdown or explanations.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const text = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);

    // Validate that column references actually exist in headers
    const validatedMapping: ColumnMapping = {
      name: headers.includes(parsed.name) ? parsed.name : null,
      type: headers.includes(parsed.type) ? parsed.type : null,
      date: headers.includes(parsed.date) ? parsed.date : null,
      duration: headers.includes(parsed.duration) ? parsed.duration : null,
      distance: headers.includes(parsed.distance) ? parsed.distance : null,
      distanceUnit: ['km', 'miles', 'meters', 'yards'].includes(parsed.distanceUnit) ? parsed.distanceUnit : null,
      description: headers.includes(parsed.description) ? parsed.description : null,
      sets: headers.includes(parsed.sets) ? parsed.sets : null,
      reps: headers.includes(parsed.reps) ? parsed.reps : null,
      weight: headers.includes(parsed.weight) ? parsed.weight : null,
      weightUnit: ['kg', 'lbs'].includes(parsed.weightUnit) ? parsed.weightUnit : null,
      heartRate: headers.includes(parsed.heartRate) ? parsed.heartRate : null,
      pace: headers.includes(parsed.pace) ? parsed.pace : null,
      elevation: headers.includes(parsed.elevation) ? parsed.elevation : null,
      calories: headers.includes(parsed.calories) ? parsed.calories : null,
      rpe: headers.includes(parsed.rpe) ? parsed.rpe : null,
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
      detectedFormat: parsed.detectedFormat || 'unknown',
      typeInference: parsed.typeInference && parsed.typeInference.column ? parsed.typeInference : undefined,
      tagSuggestions: Array.isArray(parsed.tagSuggestions) ? parsed.tagSuggestions : undefined,
    };

    // If AI missed critical fields, try heuristic fill
    if (!validatedMapping.date) {
      const heuristic = heuristicMapping(headers);
      if (heuristic.date) validatedMapping.date = heuristic.date;
    }

    return validatedMapping;
  } catch (error) {
    console.error('Groq mapping failed, falling back to heuristics:', error);
    return heuristicMapping(headers);
  }
}
