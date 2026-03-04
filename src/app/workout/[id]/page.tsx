import { getAdminDb } from '@/lib/firebase/admin';
import { redirect, notFound } from 'next/navigation';

interface WorkoutPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Legacy /workout/[id] route -- redirects to /preview/[username]/[id].
 * Scans the 'workouts' collectionGroup to locate the workout by document ID,
 * then extracts the owner username from the document path.
 *
 * Note: This is a legacy compatibility route. New share URLs use the format
 * /preview/[username]/[id] which allows direct document lookup.
 */
async function findWorkoutOwner(workoutId: string): Promise<string | null> {
  try {
    const db = getAdminDb();
    // Scan workouts collectionGroup to find the document by ID.
    // This is acceptable for a legacy redirect route that will see minimal traffic.
    const snapshot = await db.collectionGroup('workouts').select().get();

    for (const doc of snapshot.docs) {
      if (doc.id === workoutId) {
        // Document path: users/{username}/workouts/{workoutId}
        const segments = doc.ref.path.split('/');
        return segments[1] || null;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding workout owner:', error);
    return null;
  }
}

export default async function PublicWorkoutPage({ params }: WorkoutPageProps) {
  const { id } = await params;
  const ownerUsername = await findWorkoutOwner(id);

  if (!ownerUsername) {
    notFound();
  }

  redirect(`/preview/${ownerUsername}/${id}`);
}
