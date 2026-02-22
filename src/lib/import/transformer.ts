import { ColumnMapping, ParsedWorkout, RawRow } from './types';
import { WorkoutType } from '@/types';

export function transformRows(rows: RawRow[], mapping: ColumnMapping): ParsedWorkout[] {
  const results: ParsedWorkout[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const workout = transformRow(row, i, mapping);
      if (workout) results.push(workout);
    } catch {
      // Skip rows that completely fail
    }
  }

  // Group strength exercises by date
  return groupStrengthByDate(results);
}

function transformRow(row: RawRow, index: number, mapping: ColumnMapping): ParsedWorkout | null {
  const date = parseDate(getVal(row, mapping.date));
  if (!date) return null; // Can't create workout without date

  const type = inferType(row, mapping);
  const name = getVal(row, mapping.name) || generateName(type, row, mapping);
  const duration = parseDuration(getVal(row, mapping.duration));
  const distance = parseNumber(getVal(row, mapping.distance));
  const description = getVal(row, mapping.description) || undefined;
  const calories = parseNumber(getVal(row, mapping.calories));
  const avgHeartRate = parseNumber(getVal(row, mapping.heartRate));
  const elevation = parseNumber(getVal(row, mapping.elevation));
  const pace = getVal(row, mapping.pace) || undefined;

  const tags = generateTags(name, description, duration, distance, type, mapping);

  const workout: ParsedWorkout = {
    rowIndex: index,
    name,
    type,
    date,
    duration: duration || undefined,
    description,
    tags: tags.length > 0 ? tags : undefined,
    distance: distance || undefined,
    distanceUnit: mapping.distanceUnit || 'km',
    pace,
    elevation: elevation || undefined,
    avgHeartRate: avgHeartRate || undefined,
    calories: calories || undefined,
    aiGeneratedTags: tags.length > 0,
    confidence: mapping.confidence,
  };

  // Strength specific
  if (type === 'strength') {
    const sets = parseNumber(getVal(row, mapping.sets));
    const reps = parseNumber(getVal(row, mapping.reps));
    const weight = parseNumber(getVal(row, mapping.weight));
    if (sets || reps) {
      workout.exercises = [{
        name: name,
        sets: sets || 1,
        reps: reps || 0,
        weight: weight || undefined,
        weightUnit: mapping.weightUnit || undefined,
      }];
    }
  }

  return workout;
}

function getVal(row: RawRow, key: string | null): string | null {
  if (!key || !row[key]) return null;
  return String(row[key]).trim();
}

// ── Date parsing ────────────────────────────────────────────────
function parseDate(val: string | null): Date | null {
  if (!val) return null;
  const s = val.trim();

  // ISO
  const iso = new Date(s);
  if (!isNaN(iso.getTime()) && s.match(/\d{4}/)) return iso;

  // US: MM/DD/YYYY or MM-DD-YYYY
  const us = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (us) {
    const year = us[3].length === 2 ? 2000 + parseInt(us[3]) : parseInt(us[3]);
    const d = new Date(year, parseInt(us[1]) - 1, parseInt(us[2]));
    if (!isNaN(d.getTime())) return d;
  }

  // EU: DD.MM.YYYY
  const eu = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (eu) {
    const year = eu[3].length === 2 ? 2000 + parseInt(eu[3]) : parseInt(eu[3]);
    const d = new Date(year, parseInt(eu[2]) - 1, parseInt(eu[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // Named: "Jan 15, 2025" or "15 January 2025"
  const named = new Date(s);
  if (!isNaN(named.getTime())) return named;

  // Excel serial date number
  const num = parseFloat(s);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    // Excel serial: days since 1899-12-30
    const d = new Date((num - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

// ── Duration parsing ────────────────────────────────────────────
function parseDuration(val: string | null): number | null {
  if (!val) return null;
  const s = val.trim();

  // "HH:MM:SS" or "MM:SS"
  const hms = s.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hms) return parseInt(hms[1]) * 60 + parseInt(hms[2]) + parseInt(hms[3]) / 60;

  const ms = s.match(/^(\d+):(\d{2})$/);
  if (ms) {
    const a = parseInt(ms[1]), b = parseInt(ms[2]);
    // If first part > 59, treat as MM:SS is unlikely, probably H:MM
    return a > 59 ? a * 60 + b : a + b / 60;
  }

  // "1h 30m" / "1hr30" / "1h30min"
  const hm = s.match(/(\d+)\s*h(?:r|rs|ours?)?\s*(\d+)?\s*m?/i);
  if (hm) return parseInt(hm[1]) * 60 + (parseInt(hm[2]) || 0);

  // "45 min" / "45 minutes" / "45m"
  const minOnly = s.match(/^(\d+(?:\.\d+)?)\s*(?:min|minutes?|m)$/i);
  if (minOnly) return parseFloat(minOnly[1]);

  // Plain number
  const num = parseFloat(s);
  if (!isNaN(num) && num > 0) return num;

  return null;
}

// ── Number parsing ──────────────────────────────────────────────
function parseNumber(val: string | null): number | null {
  if (!val) return null;
  // Strip units
  const cleaned = val.replace(/[a-zA-Z%°]+/g, '').trim().replace(/,/g, '');
  const num = parseFloat(cleaned);
  return !isNaN(num) ? num : null;
}

// ── Type inference ──────────────────────────────────────────────
const TYPE_KEYWORDS: Record<WorkoutType, string[]> = {
  run: ['run', 'jog', 'sprint', 'marathon', 'half marathon', '5k', '10k', 'trail', 'fartlek', 'tempo run'],
  bike: ['bike', 'cycle', 'cycling', 'ride', 'spin', 'zwift', 'peloton', 'century'],
  swim: ['swim', 'pool', 'open water', 'laps', 'freestyle', 'backstroke', 'butterfly'],
  strength: ['strength', 'lift', 'weight', 'gym', 'bench', 'squat', 'deadlift', 'press', 'curl', 'row', 'pullup', 'push-up', 'leg day', 'chest', 'back day', 'arms', 'shoulders'],
  other: ['yoga', 'stretch', 'rest', 'recovery', 'walk', 'hike', 'cross-train', 'pilates', 'mobility'],
};

function normalizeType(val: string): WorkoutType {
  const lower = val.toLowerCase().trim();
  // Direct match
  if (['run', 'bike', 'swim', 'strength', 'other'].includes(lower)) return lower as WorkoutType;
  if (lower === 'running' || lower === 'run') return 'run';
  if (lower === 'cycling' || lower === 'ride' || lower === 'biking') return 'bike';
  if (lower === 'swimming') return 'swim';
  if (lower === 'weight training' || lower === 'lifting' || lower === 'weights') return 'strength';

  // Keyword search
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return type as WorkoutType;
  }
  return 'other';
}

function inferType(row: RawRow, mapping: ColumnMapping): WorkoutType {
  // 1. Direct column
  if (mapping.type && row[mapping.type]) {
    return normalizeType(String(row[mapping.type]));
  }

  // 2. AI inference rules
  if (mapping.typeInference?.column && row[mapping.typeInference.column]) {
    const val = String(row[mapping.typeInference.column]).toLowerCase();
    for (const rule of mapping.typeInference.rules) {
      try {
        if (val.match(new RegExp(rule.pattern, 'i'))) return rule.type as WorkoutType;
      } catch { /* invalid regex from AI */ }
    }
  }

  // 3. Name/description fallback
  const text = [
    mapping.name ? row[mapping.name] : null,
    mapping.description ? row[mapping.description] : null,
  ].filter(Boolean).join(' ').toLowerCase();

  if (text) {
    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
      if (keywords.some(k => text.includes(k))) return type as WorkoutType;
    }
  }

  // 4. Structural hints
  if (row[mapping.sets!] || row[mapping.reps!] || row[mapping.weight!]) return 'strength';
  if (row[mapping.distance!]) return 'run'; // default cardio → run
  return 'other';
}

// ── Name generation ─────────────────────────────────────────────
function generateName(type: WorkoutType, row: RawRow, mapping: ColumnMapping): string {
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

  // Try to build from distance
  const dist = parseNumber(getVal(row, mapping.distance));
  if (dist) {
    const unit = mapping.distanceUnit || 'km';
    return `${typeLabel} — ${dist}${unit}`;
  }

  const dur = parseDuration(getVal(row, mapping.duration));
  if (dur) return `${typeLabel} — ${Math.round(dur)}min`;

  return `${typeLabel} Workout`;
}

// ── Tag generation ──────────────────────────────────────────────
function generateTags(
  name: string, description: string | undefined, duration: number | null,
  distance: number | null, type: WorkoutType, mapping: ColumnMapping
): string[] {
  const tags = new Set<string>();
  const text = `${name} ${description || ''}`.toLowerCase();

  // AI pattern matching
  if (mapping.tagSuggestions) {
    for (const sug of mapping.tagSuggestions) {
      try {
        if (text.match(new RegExp(sug.pattern, 'i'))) {
          sug.tags.forEach(t => tags.add(t));
        }
      } catch { /* invalid regex */ }
    }
  }

  // Keyword matching
  const tagKeywords: Record<string, string[]> = {
    easy: ['easy', 'recovery', 'chill', 'light'],
    hard: ['hard', 'intense', 'max', 'all out', 'threshold'],
    intervals: ['interval', 'fartlek', 'hiit', 'tabata', 'repeat'],
    tempo: ['tempo', 'threshold', 'lactate', 'steady state'],
    long: ['long', 'endurance'],
    speed: ['speed', 'sprint', 'fast', 'race pace'],
    recovery: ['recovery', 'easy', 'active recovery', 'rest day'],
    technique: ['technique', 'drill', 'form', 'skill'],
    race: ['race', 'event', 'competition', 'pr', 'personal best', 'pb'],
  };
  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some(k => text.includes(k))) tags.add(tag);
  }

  // Duration/distance based
  if (duration && duration > 60) tags.add('long');
  if (type === 'run' && distance && distance >= 15) tags.add('long');
  if (type === 'run' && distance && distance < 5 && text.includes('easy')) tags.add('recovery');

  return Array.from(tags).slice(0, 3);
}

// ── Strength grouping ───────────────────────────────────────────
function groupStrengthByDate(workouts: ParsedWorkout[]): ParsedWorkout[] {
  const nonStrength = workouts.filter(w => w.type !== 'strength' || !w.exercises?.length);
  const strength = workouts.filter(w => w.type === 'strength' && w.exercises?.length);

  // Group by date string
  const grouped = new Map<string, ParsedWorkout[]>();
  for (const w of strength) {
    const key = w.date.toISOString().slice(0, 10);
    const arr = grouped.get(key) || [];
    arr.push(w);
    grouped.set(key, arr);
  }

  const merged: ParsedWorkout[] = [];
  for (const [, group] of grouped) {
    if (group.length === 1) {
      merged.push(group[0]);
    } else {
      // Merge into single workout
      const first = group[0];
      const allExercises = group.flatMap(w => w.exercises || []);
      merged.push({
        ...first,
        name: 'Strength Session',
        exercises: allExercises,
        duration: group.reduce((sum, w) => sum + (w.duration || 0), 0) || undefined,
        rowIndex: first.rowIndex,
      });
    }
  }

  return [...nonStrength, ...merged].sort((a, b) => a.date.getTime() - b.date.getTime());
}
