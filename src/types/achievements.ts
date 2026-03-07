import { Timestamp } from 'firebase/firestore';
import type { PRCategory } from './index';

// Milestone Categories
export type MilestoneCategory = 'workout_count' | 'distance' | 'streak' | 'first_ever';

export interface Milestone {
  id: string;
  userId: string;
  category: MilestoneCategory;
  name: string;
  description: string;
  value: number;
  unit: string;
  icon: string; // lucide icon name
  date: Timestamp;
  workoutId?: string;
  createdAt: Timestamp;
}

export interface DetectedPR {
  name: string;
  category: PRCategory;
  value: number;
  unit: string;
  workoutId: string;
}

export interface ConfirmedPR {
  name: string;
  value: number;
  unit: string;
  previousValue?: number;
  improvement?: string; // e.g., "+12%"
}

export interface DetectedMilestone {
  category: MilestoneCategory;
  name: string;
  description: string;
  value: number;
  unit: string;
  icon: string;
}

export interface AchievementResult {
  newPRs: ConfirmedPR[];
  newMilestones: DetectedMilestone[];
}
