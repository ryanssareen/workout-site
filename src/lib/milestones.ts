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

  // Workout count milestones — only award the highest new one
  const highestOwnedCount = existingMilestones
    .filter(m => m.category === 'workout_count')
    .reduce((max, m) => Math.max(max, m.value), 0);
  const newCountMilestones = WORKOUT_COUNT_MILESTONES
    .filter(m => stats.completedCount >= m.threshold && m.threshold > highestOwnedCount);
  if (newCountMilestones.length > 0) {
    const highest = newCountMilestones[newCountMilestones.length - 1];
    earned.push({
      category: 'workout_count',
      name: highest.name,
      description: highest.description,
      value: highest.threshold,
      unit: 'workouts',
      icon: highest.icon,
    });
  }

  // Distance milestones — only award the highest new one
  const highestOwnedDist = existingMilestones
    .filter(m => m.category === 'distance')
    .reduce((max, m) => Math.max(max, m.value), 0);
  const newDistMilestones = DISTANCE_MILESTONES
    .filter(m => stats.totalDistanceKm >= m.threshold && m.threshold > highestOwnedDist);
  if (newDistMilestones.length > 0) {
    const highest = newDistMilestones[newDistMilestones.length - 1];
    earned.push({
      category: 'distance',
      name: highest.name,
      description: highest.description,
      value: highest.threshold,
      unit: 'km',
      icon: highest.icon,
    });
  }

  // Streak milestones — only award the highest new one
  const highestOwnedStreak = existingMilestones
    .filter(m => m.category === 'streak')
    .reduce((max, m) => Math.max(max, m.value), 0);
  const newStreakMilestones = STREAK_MILESTONES
    .filter(m => stats.currentStreak >= m.threshold && m.threshold > highestOwnedStreak);
  if (newStreakMilestones.length > 0) {
    const highest = newStreakMilestones[newStreakMilestones.length - 1];
    earned.push({
      category: 'streak',
      name: highest.name,
      description: highest.description,
      value: highest.threshold,
      unit: 'days',
      icon: highest.icon,
    });
  }

  // First-ever milestones — check by name to avoid value mismatch bugs
  for (const m of FIRST_EVER_MILESTONES) {
    if ((stats.typeCounts[m.type] || 0) >= 1) {
      const alreadyEarned = existingMilestones.some(
        em => em.category === 'first_ever' && em.name === m.name
      );
      if (!alreadyEarned) {
        const typeIndex = FIRST_EVER_MILESTONES.findIndex(f => f.type === m.type) + 1;
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
