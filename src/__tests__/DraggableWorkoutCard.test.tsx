import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Workout } from '@/types';
import { isDraggableWorkout } from '@/components/calendar/DraggableWorkoutCard';

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  const now = Timestamp.fromMillis(Date.UTC(2026, 3, 17, 7, 0));
  return {
    id: 'w1',
    name: 'Easy run',
    type: 'run',
    description: '',
    date: now,
    ownerUsername: 'alice',
    createdBy: 'alice',
    assignedTo: 'alice',
    completed: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Workout;
}

describe('isDraggableWorkout', () => {
  it('returns true for an uncompleted manual workout (planned or missed)', () => {
    expect(isDraggableWorkout(makeWorkout({ completed: false, source: 'manual' }))).toBe(true);
  });

  it('returns true when source is undefined (legacy docs)', () => {
    expect(isDraggableWorkout(makeWorkout({ completed: false }))).toBe(true);
  });

  it('returns false when workout is completed', () => {
    expect(isDraggableWorkout(makeWorkout({ completed: true }))).toBe(false);
  });

  it('returns false for Strava-standalone workouts', () => {
    expect(isDraggableWorkout(makeWorkout({ source: 'strava' }))).toBe(false);
  });

  it('returns false when completedBy is strava even if completed is false', () => {
    expect(isDraggableWorkout(makeWorkout({ completedBy: 'strava' }))).toBe(false);
  });

  it('returns true for imported workouts that are still uncompleted', () => {
    expect(isDraggableWorkout(makeWorkout({ source: 'import', completed: false }))).toBe(true);
  });
});
