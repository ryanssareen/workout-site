import { Timestamp } from 'firebase/firestore';

export type UserRole = 'coach' | 'athlete' | 'student'; // 'student' is legacy, use 'athlete'
export type WorkoutType = 'swim' | 'run' | 'walk' | 'bike' | 'strength' | 'other';

// Import and re-export workout tags
import { WORKOUT_TAGS, WorkoutTag } from './workout';
export { WORKOUT_TAGS };
export type { WorkoutTag };

export interface User {
  uid: string;
  username: string; // Document key in users/{username}
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  coachUsername?: string; // Username of coach (was coachId)
  coachCode?: string; // 6-letter code for coaches
  photoURL?: string; // Google profile photo
  // Strava integration fields
  stravaId?: string;
  stravaAccessToken?: string;
  stravaRefreshToken?: string;
  stravaTokenExpiresAt?: number;
  stravaConnectedAt?: Timestamp;
  // Email summary tracking
  lastSummaryDate?: Timestamp;
  // Profile & onboarding
  bio?: string;
  timezone?: string;
  sportPreferences?: string[];
  fitnessGoals?: string[]; // legacy, use trainingFor
  trainingFor?: string[];
  gender?: string;
  ageRange?: string;
  eventDate?: string;
  events?: Array<{ goal: string; eventName: string; eventDate?: string }>;
  experienceLevel?: string;
  weeklyAvailability?: string;
  notificationPreferences?: {
    emailSummary: boolean;
    workoutReminders: boolean;
    coachMessages: boolean;
  };
  profileCompleted?: number;
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
  height?: number; // in cm
  heightUnit?: 'cm' | 'ft';
  weight?: number; // in kg
  weightUnit?: 'kg' | 'lbs';
  // Public profile
  profileTagline?: string;    // AI-generated one-liner for public profile
  profilePublic?: boolean;    // Whether /athlete/username is accessible (default: true)
  // Push notification subscriptions
  pushSubscriptions?: Array<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
    createdAt: string;
  }>;
  // Strava sync tracking
  lastStravaSync?: number;         // epoch seconds — last successful recent sync
  lastStravaFullBackfill?: number; // epoch seconds — when full history backfill completed
  stravaBackfillPage?: number;     // tracks backfill progress for resume after rate limit
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
  aiComment?: string; // Fun AI-generated location comment
}

export interface StraveLap {
  index: number;
  name: string;              // e.g. "Lap 1"
  distance: number;          // meters
  elapsedTime: number;       // seconds
  movingTime: number;        // seconds
  avgSpeed: number;          // m/s
  maxSpeed: number;          // m/s
  avgCadence?: number;
  avgWatts?: number;
  totalElevationGain?: number;
}

export interface StravaSplit {
  split: number;             // split number (1-based)
  distance: number;          // meters
  elapsedTime: number;       // seconds
  movingTime: number;        // seconds
  avgSpeed: number;          // m/s
  elevationDifference?: number;
  paceZone?: number;
}

export interface StravaGear {
  id: string;
  name?: string;
  nickname?: string;
  brandName?: string;
  modelName?: string;
  distance?: number; // meters
  primary?: boolean;
  resourceState?: number;
}

export interface StravaBestEffort {
  id?: number;
  name?: string;
  elapsedTime?: number;
  movingTime?: number;
  startDate?: string;
  distance?: number;
  prRank?: number | null;
  achievementCount?: number;
}

export interface StravaSegmentEffort {
  id?: number;
  name?: string;
  elapsedTime?: number;
  movingTime?: number;
  startDate?: string;
  distance?: number;
  averageCadence?: number;
  averageWatts?: number;
  deviceWatts?: boolean;
  averageHeartrate?: number;
  maxHeartrate?: number;
  komRank?: number | null;
  prRank?: number | null;
  achievementCount?: number;
}

export interface StravaExtendedData {
  elapsedTime?: number; // total time including stops (seconds)
  sufferScore?: number;
  perceivedExertion?: number;
  description?: string;
  deviceName?: string;
  averageCadence?: number;
  averageTemp?: number;
  weightedAverageWatts?: number;
  kilojoules?: number;
  hasHeartrate?: boolean;
  prCount?: number;
  gear?: StravaGear | null;
  bestEfforts?: StravaBestEffort[];
  segmentEfforts?: StravaSegmentEffort[];
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
  ownerUsername: string; // Username of the athlete who owns this workout (subcollection parent)
  createdBy: string; // Username of creator (coach or self)
  assignedTo: string; // Username of assigned athlete
  assignedToName?: string; // athlete display name for coach view
  studentId?: string; // legacy alias for assignedTo
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
  source?: 'manual' | 'strava' | 'import';
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
  hasStravaPhotos?: boolean;
  photos?: string[]; // Photo URLs (from Strava or uploaded)
  // Strava detailed data (laps & splits) — fetched via GET /activities/{id}
  stravaDetailsFetched?: boolean; // true if detailed activity data has been fetched
  laps?: StraveLap[];
  splits?: StravaSplit[];
  splitsMetric?: StravaSplit[];
  splitsStandard?: StravaSplit[];
  stravaExtended?: StravaExtendedData;
  // Manual completion fields
  completionNotes?: string;
  completedBy?: 'manual' | 'strava';
  mergeMeta?: {
    method?: 'auto_planned' | 'auto_import' | 'manual' | 'duplicate_decision';
    mergedAt?: Timestamp;
    source?: 'strava';
    confidence?: number;
    candidateCount?: number;
    sourceWorkoutId?: string;
  };
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

// Achievements
export type { MilestoneCategory, Milestone, DetectedPR, ConfirmedPR, DetectedMilestone, AchievementResult } from './achievements';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, username: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}
