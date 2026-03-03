import { WorkoutType, WorkoutTag } from '@/types';

// Raw spreadsheet row - every value is a string from the parser
export interface RawRow {
  [key: string]: string | number | null;
}

// Groq's interpretation of the spreadsheet structure
export interface ColumnMapping {
  name: string | null;
  type: string | null;
  date: string | null;
  duration: string | null;
  distance: string | null;
  distanceUnit: 'km' | 'miles' | 'meters' | 'yards' | null;
  description: string | null;
  sets: string | null;
  reps: string | null;
  weight: string | null;
  weightUnit: 'kg' | 'lbs' | null;
  heartRate: string | null;
  pace: string | null;
  elevation: string | null;
  calories: string | null;
  rpe: string | null;
  confidence: number;
  assumptions: string[];
  detectedFormat: 'training_log' | 'strava_export' | 'garmin_export' | 'strong_app' | 'generic' | 'unknown';
  typeInference?: {
    column: string;
    rules: Array<{ pattern: string; type: string }>;
  };
  tagSuggestions?: Array<{
    pattern: string;
    tags: string[];
  }>;
}

// A single parsed workout ready for validation
export interface ParsedWorkout {
  rowIndex: number;
  name: string;
  type: WorkoutType;
  date: Date;
  duration?: number;
  description?: string;
  tags?: WorkoutTag[];
  distance?: number;
  distanceUnit?: string;
  pace?: string;
  elevation?: number;
  avgHeartRate?: number;
  calories?: number;
  exercises?: Array<{
    name: string;
    sets: number;
    reps: number;
    weight?: number;
    weightUnit?: string;
  }>;
  aiGeneratedTags?: boolean;
  confidence: number;
}

// After validation
export interface ValidatedWorkout extends ParsedWorkout {
  status: 'valid' | 'warning' | 'error';
  warnings: string[];
  errors: string[];
  isDuplicate: boolean;
  duplicateOf?: string;
}

// Serialized workout (dates as ISO strings for JSON transport)
export interface SerializedWorkout extends Omit<ValidatedWorkout, 'date'> {
  date: string; // ISO string
}

// Full analysis response sent to client
export interface AnalysisResult {
  sessionId: string;
  totalRows: number;
  headers: string[]; // column headers from the parsed file
  mapping: ColumnMapping;
  workouts: ValidatedWorkout[];
  summary: {
    valid: number;
    warnings: number;
    errors: number;
    duplicates: number;
    byType: Record<string, number>;
    dateRange: { earliest: string; latest: string } | null;
  };
}

// Parse result from file parser
export interface ParseResult {
  headers: string[];
  rows: RawRow[];
  sheetName?: string;
  totalSheets?: number;
  totalRowsInFile: number;
  truncated: boolean;
}
