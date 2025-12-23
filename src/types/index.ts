import { Timestamp } from 'firebase/firestore';

export type UserRole = 'coach' | 'student';
export type WorkoutType = 'swim' | 'run' | 'bike' | 'strength';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  coachId?: string;
  coachCode?: string; // 6-letter code for coaches (except rsareen@gmail.com)
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

export type WorkoutRating = 'too_easy' | 'just_right' | 'too_hard';

export interface Workout {
  id: string;
  name: string;
  type: WorkoutType;
  description: string;
  date: Timestamp;
  duration?: number;
  createdBy: string;
  assignedTo: string;
  completed: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Strava sync fields
  source?: 'manual' | 'strava';
  stravaActivityId?: string;
  // Auto-completion fields
  completedAt?: Timestamp;
  completionStatus?: 'pending' | 'completed' | 'skipped';
  actualStats?: StravaActivityStats;
  // Manual completion fields
  completionNotes?: string;
  completedBy?: 'manual' | 'strava';
  // Reminder tracking
  reminderSent?: boolean;
}

export interface WorkoutComment {
  id: string;
  workoutId: string;
  userId: string;
  userRole: 'coach' | 'student';
  userName: string;
  text: string;
  rating?: WorkoutRating;
  createdAt: Timestamp;
  parentCommentId?: string;
  isCoachReply?: boolean;
}

export interface WorkoutFormData {
  name: string;
  type: WorkoutType;
  description: string;
  date: Date;
  duration?: number;
  assignedTo: string;
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
