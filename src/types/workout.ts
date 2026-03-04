// Enhanced Workout Type System

export type WorkoutType = 'swim' | 'bike' | 'run' | 'strength' | 'other';

// Predefined workout tags
export const WORKOUT_TAGS = [
  'easy',
  'moderate',
  'hard',
  'recovery',
  'speed',
  'endurance',
  'intervals',
  'tempo',
  'long',
  'strength',
  'technique',
  'race',
] as const;

export type WorkoutTag = typeof WORKOUT_TAGS[number];

export interface SwimData {
  distance: number;
  distanceUnit: 'meters' | 'yards';
  time: number; // minutes
  strokes?: number;
  strokeType?: 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'mixed';
  poolLength?: number; // 20, 25, 30, 50, or custom
}

export interface BikeData {
  distance: number;
  distanceUnit: 'km' | 'miles';
  time: number; // minutes
  avgPower?: number; // watts
  avgCadence?: number; // RPM
  elevationGain?: number; // meters
  avgHeartRate?: number; // BPM from Strava
}

export interface RunData {
  distance?: number;
  distanceUnit: 'km' | 'miles';
  time: number; // minutes
  pace?: string; // e.g., "5:30/km"
  elevationGain?: number; // meters
  terrain?: 'road' | 'trail' | 'track' | 'treadmill';
  avgHeartRate?: number; // BPM from Strava
}

export interface StrengthExercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  weightUnit: 'kg' | 'lbs';
  restSeconds?: number;
  notes?: string;
}

export interface StrengthData {
  exercises: StrengthExercise[];
  totalTime?: number; // minutes
  rpe?: number; // 1-10 scale (Rate of Perceived Exertion)
}

export interface OtherData {
  description: string;
  duration?: number; // minutes
  notes?: string;
}

export interface Workout {
  id: string;
  name: string;
  type: WorkoutType;
  date: Date | { seconds: number };
  studentId?: string;
  createdBy: string;
  completed: boolean;
  completedAt?: Date | { seconds: number };
  completedLate?: boolean;
  description?: string;
  duration?: number;
  tags?: WorkoutTag[]; // NEW: Workout tags
  swim?: SwimData;
  bike?: BikeData;
  run?: RunData;
  strength?: StrengthData;
  other?: OtherData;
  rating?: number;
  feedback?: string;
  prs?: {
    exerciseName: string;
    previousValue: number;
    newValue: number;
    unit: string;
  }[];
  stravaActivityId?: string;
  stravaData?: {
    distance?: number;
    time?: number;
    elevationGain?: number;
    avgPower?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
  };
  createdAt: Date | { seconds: number };
  updatedAt: Date | { seconds: number };
}

export interface WorkoutFormData {
  name: string;
  type: WorkoutType;
  date: Date;
  studentId: string;
  tags?: WorkoutTag[]; // NEW: Tags in form data
  swim?: Partial<SwimData>;
  bike?: Partial<BikeData>;
  run?: Partial<RunData>;
  strength?: Partial<StrengthData>;
  other?: Partial<OtherData>;
}

export function getWorkoutSummary(workout: Workout): string {
  if (workout.swim) {
    return `${workout.swim.distance}${workout.swim.distanceUnit} in ${workout.swim.time} min`;
  }
  if (workout.bike) {
    return `${workout.bike.distance}${workout.bike.distanceUnit} in ${workout.bike.time} min`;
  }
  if (workout.run) {
    const pace = workout.run.pace ? ` (${workout.run.pace})` : '';
    const dist = workout.run.distance ? `${workout.run.distance}${workout.run.distanceUnit} in ` : '';
    return `${dist}${workout.run.time} min${pace}`;
  }
  if (workout.strength) {
    const exerciseCount = workout.strength.exercises.length;
    return `${exerciseCount} exercises${workout.strength.totalTime ? ` - ${workout.strength.totalTime} min` : ''}`;
  }
  if (workout.other) {
    return workout.other.description;
  }
  return workout.description || 'No details';
}
