import { getAuthInstance } from '@/lib/firebase/config';

/**
 * Create a workout via the server-side API route.
 * All workout writes go through the API for security (Firestore rules restrict client writes to owner).
 */
export async function createWorkoutViaApi(
  workoutData: Record<string, unknown>,
  createdByUsername: string
): Promise<string> {
  const auth = getAuthInstance();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Not authenticated');

  const response = await fetch('/api/workouts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      ...workoutData,
      createdBy: createdByUsername,
      // Convert Date objects to ISO strings for JSON serialization
      date: workoutData.date instanceof Date ? workoutData.date.toISOString() : workoutData.date,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create workout' }));
    throw new Error(error.error || 'Failed to create workout');
  }

  const result = await response.json();
  return result.id;
}
