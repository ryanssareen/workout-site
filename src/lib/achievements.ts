import type { Workout } from '@/types';
import type { AchievementResult, ConfirmedPR, DetectedMilestone } from '@/types/achievements';
import { extractPRCandidates } from './pr-detection';
import { detectNewMilestones, type MilestoneStats } from './milestones';
import { computeSummary } from './analytics';
import { addPersonalRecord, getMilestones, addMilestone } from './firebase/firestore';
import { isSameDay, subDays } from 'date-fns';

function toDate(w: Workout): Date {
  try {
    const d = (w.date as any)?.toDate?.() ?? new Date(w.date as any);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch { return new Date(0); }
}

function calculateStreak(workouts: Workout[]): number {
  const completed = workouts
    .filter(w => w.completed)
    .map(w => toDate(w))
    .sort((a, b) => b.getTime() - a.getTime());
  if (completed.length === 0) return 0;

  let streak = 0;
  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  if (!completed.some(d => isSameDay(d, checkDate))) {
    checkDate = subDays(checkDate, 1);
  }

  for (let i = 0; i < 365; i++) {
    const dayDate = subDays(checkDate, i);
    if (completed.some(d => isSameDay(d, dayDate))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Main achievement detection orchestrator.
 * Call after a workout is completed. Checks for new PRs and milestones.
 */
export async function checkAchievements(
  username: string,
  userId: string,
  workout: Workout,
  allWorkouts: Workout[],
): Promise<AchievementResult> {
  const newPRs: ConfirmedPR[] = [];
  const newMilestones: DetectedMilestone[] = [];

  // 1. PR Detection
  const candidates = extractPRCandidates(workout);
  const workoutDate = toDate(workout);

  for (const candidate of candidates) {
    try {
      const result = await addPersonalRecord(userId, {
        category: candidate.category,
        name: candidate.name,
        value: candidate.value,
        unit: candidate.unit,
        date: workoutDate,
        workoutId: candidate.workoutId,
      });

      if (result.isNewRecord) {
        let improvement: string | undefined;
        if (result.previousValue !== undefined && result.previousValue > 0) {
          if (candidate.category === 'speed') {
            const pct = ((result.previousValue - candidate.value) / result.previousValue) * 100;
            improvement = `${Math.round(pct)}% faster`;
          } else {
            const pct = ((candidate.value - result.previousValue) / result.previousValue) * 100;
            improvement = `+${Math.round(pct)}%`;
          }
        }

        newPRs.push({
          name: candidate.name,
          value: candidate.value,
          unit: candidate.unit,
          previousValue: result.previousValue,
          improvement,
        });
      }
    } catch (error) {
      console.error(`PR check failed for ${candidate.name}:`, error);
    }
  }

  // 2. Milestone Detection
  try {
    const completedWorkouts = allWorkouts.filter(w => w.completed);
    const summary = computeSummary(allWorkouts);
    const streak = calculateStreak(allWorkouts);

    // Count completed workouts by type
    const typeCounts: Record<string, number> = {};
    for (const w of completedWorkouts) {
      typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
    }

    const stats: MilestoneStats = {
      completedCount: completedWorkouts.length,
      totalDistanceKm: summary.totalDistanceKm,
      currentStreak: streak,
      typeCounts,
    };

    const existingMilestones = await getMilestones(username);
    const detected = detectNewMilestones(stats, existingMilestones);

    for (const milestone of detected) {
      const id = await addMilestone(username, {
        userId,
        category: milestone.category,
        name: milestone.name,
        description: milestone.description,
        value: milestone.value,
        unit: milestone.unit,
        icon: milestone.icon,
        date: workoutDate,
        workoutId: workout.id,
      });
      if (id) {
        newMilestones.push(milestone);
      }
    }
  } catch (error) {
    console.error('Milestone detection failed:', error);
  }

  return { newPRs, newMilestones };
}
