import type { Workout, PRCategory } from '@/types';
import type { DetectedPR } from '@/types/achievements';

/**
 * Extract PR candidates from a completed workout.
 * Each candidate will be checked against existing records via addPersonalRecord().
 */
export function extractPRCandidates(workout: Workout): DetectedPR[] {
  const candidates: DetectedPR[] = [];
  const wId = workout.id;

  // --- Run PRs ---
  if (workout.type === 'run' && workout.run) {
    const { distance, distanceUnit, time } = workout.run;
    const distKm = distance ? (distanceUnit === 'miles' ? distance * 1.60934 : distance) : 0;

    if (distKm > 0) {
      candidates.push({
        name: 'Longest Run',
        category: 'distance',
        value: Math.round(distKm * 100) / 100,
        unit: 'km',
        workoutId: wId,
      });
    }
    if (distKm > 0 && time > 0) {
      const pacePerKm = time / distKm; // min/km
      candidates.push({
        name: 'Fastest Run Pace',
        category: 'speed',
        value: Math.round(pacePerKm * 100) / 100,
        unit: 'min/km',
        workoutId: wId,
      });
    }
    if (time > 0) {
      candidates.push({
        name: 'Longest Run Duration',
        category: 'endurance',
        value: Math.round(time),
        unit: 'min',
        workoutId: wId,
      });
    }
  }

  // --- Bike PRs ---
  if (workout.type === 'bike' && workout.bike) {
    const { distance, distanceUnit, time, elevationGain, avgPower } = workout.bike;
    const distKm = distance ? (distanceUnit === 'miles' ? distance * 1.60934 : distance) : 0;

    if (distKm > 0) {
      candidates.push({
        name: 'Longest Ride',
        category: 'distance',
        value: Math.round(distKm * 100) / 100,
        unit: 'km',
        workoutId: wId,
      });
    }
    if (elevationGain && elevationGain > 0) {
      candidates.push({
        name: 'Most Climbing (Bike)',
        category: 'endurance',
        value: Math.round(elevationGain),
        unit: 'm',
        workoutId: wId,
      });
    }
    if (avgPower && avgPower > 0) {
      candidates.push({
        name: 'Highest Avg Power',
        category: 'endurance',
        value: Math.round(avgPower),
        unit: 'W',
        workoutId: wId,
      });
    }
    if (time > 0) {
      candidates.push({
        name: 'Longest Ride Duration',
        category: 'endurance',
        value: Math.round(time),
        unit: 'min',
        workoutId: wId,
      });
    }
  }

  // --- Swim PRs ---
  if (workout.type === 'swim' && workout.swim) {
    const { distance, distanceUnit, time } = workout.swim;
    const distM = distance ? (distanceUnit === 'yards' ? distance * 0.9144 : distance) : 0;

    if (distM > 0) {
      candidates.push({
        name: 'Longest Swim',
        category: 'distance',
        value: Math.round(distM),
        unit: 'm',
        workoutId: wId,
      });
    }
    if (distM >= 100 && time > 0) {
      const pacePer100 = (time / distM) * 100; // min per 100m
      candidates.push({
        name: 'Fastest Swim Pace',
        category: 'speed',
        value: Math.round(pacePer100 * 100) / 100,
        unit: 'min/100m',
        workoutId: wId,
      });
    }
  }

  // --- Strength PRs ---
  if (workout.type === 'strength' && workout.strength?.exercises) {
    for (const ex of workout.strength.exercises) {
      if (ex.weight && ex.weight > 0) {
        const weightKg = ex.weightUnit === 'lbs' ? ex.weight * 0.453592 : ex.weight;
        candidates.push({
          name: `${ex.name} (Max Weight)`,
          category: 'strength',
          value: Math.round(weightKg * 10) / 10,
          unit: 'kg',
          workoutId: wId,
        });
      }
    }
  }

  // --- Strava/actualStats fallback for distance ---
  const stravaDistance = workout.actualStats?.distance || workout.stravaData?.distance;
  if (stravaDistance && stravaDistance > 0 && workout.type !== 'strength') {
    const distKm = stravaDistance / 1000; // Strava stores in meters
    if (distKm > 0) {
      const typeName = workout.type === 'run' ? 'Run' : workout.type === 'bike' ? 'Ride' : workout.type === 'swim' ? 'Swim' : 'Activity';
      // Only add if we didn't already add a distance PR from type-specific data
      if (!candidates.some(c => c.name.startsWith('Longest'))) {
        candidates.push({
          name: `Longest ${typeName}`,
          category: 'distance',
          value: Math.round(distKm * 100) / 100,
          unit: 'km',
          workoutId: wId,
        });
      }
    }
  }

  return candidates;
}
