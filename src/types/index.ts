import { Timestamp } from 'firebase/firestore';

export type UserRole = 'coach' | 'athlete' | 'student'; // 'student' is legacy, use 'athlete'
export type WorkoutType = 'swim' | 'run' | 'bike' | 'strength' | 'other';

// Import and re-export workout tags
import { WORKOUT_TAGS, WorkoutTag } from './workout';
export { WORKOUT_TAGS };
export type { WorkoutTag };

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  coachId?: string;
  coachCode?: string; // 6-letter code for coaches (except rsareen@gmail.com)
  photoURL?: string; // Google profile photo
  // Strava integration fields
  stravaId?: string;
  stravaAccessToken?: string;
  stravaRefreshToken?: string;
  stravaTokenExpiresAt?: number;
  stravaConnectedAt?: Timestamp;
  // Email summary tracking
  lastSummaryDate?: Timestamp;
}

export interface StravaActivityStats {
  distance?: number; // in meters
  duration?: number; // in seconds
  calories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgSpeed?: number; // in m/s
  maxSpeed?: number; // in m/s
  elevationGain?: number; // in meters
}

export interface RouteData {
  polyline?: string; // Encoded polyline from Strava
  startLatLng?: [number, number];
  endLatLng?: [number, number];
}

export type WorkoutRating = 'too_easy' | 'just_right' | 'too_hard';

export interface Workout {
  id: string;
  name: string;
  type: WorkoutType;
  description: string;
  date: Timestamp;
  duration?: number;
  tags?: WorkoutTag[]; // NEW: Workout tags
  createdBy: string;
  assignedTo: string;
  studentId?: string; // alias for assignedTo used in some components
  completed: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Type-specific data
  swim?: SwimData;
  bike?: BikeData;
  run?: RunData;
  strength?: StrengthData;
  other?: OtherData;
  // Strava sync fields
  source?: 'manual' | 'strava';
  stravaActivityId?: string;
  stravaData?: {
    distance?: number;
    time?: number;
    elevationGain?: number;
    avgPower?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
  };
  // Auto-completion fields
  completedAt?: Timestamp;
  completionStatus?: 'pending' | 'completed' | 'skipped';
  actualStats?: StravaActivityStats;
  routeData?: RouteData; // Map route from Strava
  // Manual completion fields
  completionNotes?: string;
  completedBy?: 'manual' | 'strava';
  completedLate?: boolean; // True if completed after due date
  rating?: number;
  feedback?: string;
  prs?: {
    exerciseName: string;
    previousValue: number;
    newValue: number;
    unit: string;
  }[];
  // Reminder tracking
  reminderSent?: boolean;
  // Template tracking
  templateId?: string; // ID of template created from this workout
}

export interface WorkoutComment {
  id: string;
  workoutId: string;
  userId: string;
  userRole: 'coach' | 'athlete' | 'student'; // 'student' is legacy
  userName: string;
  text: string;
  rating?: WorkoutRating;
  createdAt: Timestamp;
  parentCommentId?: string;
  isCoachReply?: boolean;
}

// Import enhanced workout types
import type {
  SwimData,
  BikeData,
  RunData,
  StrengthData,
  OtherData,
  StrengthExercise,
} from './workout';

// Re-export for convenience
export type { SwimData, BikeData, RunData, StrengthData, OtherData, StrengthExercise };

export interface WorkoutFormData {
  name: string;
  type: WorkoutType;
  date: Date;
  assignedTo: string;
  tags?: WorkoutTag[]; // NEW: Tags in form data
  // Legacy fields
  description?: string;
  duration?: number;
  // Type-specific data
  swim?: SwimData;
  bike?: BikeData;
  run?: RunData;
  strength?: StrengthData;
  other?: OtherData;
}

// Personal Records
export type PRCategory = 'distance' | 'speed' | 'strength' | 'endurance';

export interface PersonalRecord {
  id: string;
  userId: string;
  category: PRCategory;
  name: string; // e.g., "Fastest 5K", "Longest Run", "Heaviest Squat"
  value: number;
  unit: string; // e.g., "km", "min", "kg", "lbs"
  date: Timestamp;
  workoutId?: string;
  stravaActivityId?: string;
  notes?: string;
  previousValue?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}
