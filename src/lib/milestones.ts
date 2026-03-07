import type { Milestone } from '@/types';
import type { DetectedMilestone, MilestoneCategory } from '@/types/achievements';

interface MilestoneDef {
  threshold: number;
  name: string;
  description: string;
  icon: string;
}

interface FirstEverDef {
  type: string;
  name: string;
  description: string;
  icon: string;
}

export const WORKOUT_COUNT_MILESTONES: MilestoneDef[] = [
  { threshold: 10, name: 'First Ten', description: 'Completed 10 workouts', icon: 'star' },
  { threshold: 25, name: 'Quarter Century', description: 'Completed 25 workouts', icon: 'medal' },
  { threshold: 50, name: 'Half Century', description: 'Completed 50 workouts', icon: 'award' },
  { threshold: 100, name: 'Century Club', description: 'Completed 100 workouts', icon: 'trophy' },
  { threshold: 250, name: 'Seasoned Athlete', description: 'Completed 250 workouts', icon: 'crown' },
  { threshold: 500, name: 'Iron Will', description: 'Completed 500 workouts', icon: 'flame' },
  { threshold: 1000, name: 'Legendary', description: 'Completed 1,000 workouts', icon: 'zap' },
];

export const DISTANCE_MILESTONES: MilestoneDef[] = [
  { threshold: 100, name: '100km Club', description: 'Covered 100 km total', icon: 'map-pin' },
  { threshold: 500, name: '500km Explorer', description: 'Covered 500 km total', icon: 'compass' },
  { threshold: 1000, name: '1,000km Voyager', description: 'Covered 1,000 km total', icon: 'globe' },
  { threshold: 5000, name: '5,000km Legend', description: 'Covered 5,000 km total', icon: 'earth' },
];

export const STREAK_MILESTONES: MilestoneDef[] = [
  { threshold: 7, name: 'Week Warrior', description: '7-day workout streak', icon: 'flame' },
  { threshold: 14, name: 'Two-Week Terror', description: '14-day workout streak', icon: 'flame' },
  { threshold: 30, name: 'Monthly Machine', description: '30-day workout streak', icon: 'flame' },
  { threshold: 60, name: 'Two-Month Monster', description: '60-day workout streak', icon: 'flame' },
  { threshold: 100, name: 'Centurion', description: '100-day workout streak', icon: 'crown' },
  { threshold: 365, name: 'Year-Round Athlete', description: '365-day workout streak', icon: 'trophy' },
];

export const FIRST_EVER_MILESTONES: FirstEverDef[] = [
  { type: 'run', name: 'First Run', description: 'Completed your first run', icon: 'footprints' },
  { type: 'bike', name: 'First Ride', description: 'Completed your first ride', icon: 'bike' },
  { type: 'swim', name: 'First Swim', description: 'Completed your first swim', icon: 'waves' },
  { type: 'strength', name: 'First Lift', description: 'Completed your first strength session', icon: 'dumbbell' },
];

export interface MilestoneStats {
  completedCount: number;
  totalDistanceKm: number;
  currentStreak: number;
  typeCounts: Record<string, number>; // e.g., { run: 5, bike: 3, swim: 1 }
}

/**
 * Pure function: detect which milestones the user has newly earned.
 * Filters out any milestones already in existingMilestones.
 */
export function detectNewMilestones(
  stats: MilestoneStats,
  existingMilestones: Milestone[],
): DetectedMilestone[] {
  const earned: DetectedMilestone[] = [];

  const alreadyHas = (category: MilestoneCategory, value: number) =>
    existingMilestones.some(m => m.category === category && m.value === value);

  // Workout count milestones
  for (const m of WORKOUT_COUNT_MILESTONES) {
    if (stats.completedCount >= m.threshold && !alreadyHas('workout_count', m.threshold)) {
      earned.push({
        category: 'workout_count',
        name: m.name,
        description: m.description,
        value: m.threshold,
        unit: 'workouts',
        icon: m.icon,
      });
    }
  }

  // Distance milestones
  for (const m of DISTANCE_MILESTONES) {
    if (stats.totalDistanceKm >= m.threshold && !alreadyHas('distance', m.threshold)) {
      earned.push({
        category: 'distance',
        name: m.name,
        description: m.description,
        value: m.threshold,
        unit: 'km',
        icon: m.icon,
      });
    }
  }

  // Streak milestones
  for (const m of STREAK_MILESTONES) {
    if (stats.currentStreak >= m.threshold && !alreadyHas('streak', m.threshold)) {
      earned.push({
        category: 'streak',
        name: m.name,
        description: m.description,
        value: m.threshold,
        unit: 'days',
        icon: m.icon,
      });
    }
  }

  // First-ever milestones
  for (const m of FIRST_EVER_MILESTONES) {
    if ((stats.typeCounts[m.type] || 0) >= 1 && !alreadyHas('first_ever', m.type.length)) {
      // Use a unique value per type: hash of type string length won't work, use index
      const typeIndex = FIRST_EVER_MILESTONES.findIndex(f => f.type === m.type) + 1;
      if (!existingMilestones.some(em => em.category === 'first_ever' && em.name === m.name)) {
        earned.push({
          category: 'first_ever',
          name: m.name,
          description: m.description,
          value: typeIndex,
          unit: m.type,
          icon: m.icon,
        });
      }
    }
  }

  return earned;
}
