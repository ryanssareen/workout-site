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
}

export interface WorkoutFormData {
  name: string;
  type: WorkoutType;
  description: string;
  date: Date;
  duration?: number;
  assignedTo: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}
