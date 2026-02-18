import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import { WorkoutPreview } from '@/components/workouts/WorkoutPreview';
import { notFound } from 'next/navigation';

interface WorkoutPageProps {
  params: Promise<{ id: string }>;
}

async function getWorkout(id: string) {
  try {
    const db = getAdminDb();
    const doc = await db.collection('workouts').doc(id).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    return {
      id: doc.id,
      name: data.name || 'Untitled Workout',
      type: data.type || 'other',
      description: data.description || '',
      date: data.date?.toDate?.()?.toISOString() || new Date().toISOString(),
      duration: data.duration || null,
      completed: data.completed || false,
      source: data.source || 'manual',
      run: data.run || null,
      bike: data.bike || null,
      swim: data.swim || null,
      strength: data.strength || null,
      other: data.other || null,
      actualStats: data.actualStats
        ? {
            distance: data.actualStats.distance || null,
            duration: data.actualStats.duration || null,
            calories: data.actualStats.calories || null,
            avgHeartRate: data.actualStats.avgHeartRate || null,
          }
        : null,
      routeData: data.routeData
        ? {
            polyline: data.routeData.polyline || null,
            startLatLng: data.routeData.startLatLng || null,
          }
        : null,
      tags: data.tags || [],
    };
  } catch (error) {
    console.error('Error fetching workout for preview:', error);
    return null;
  }
}

export async function generateMetadata({ params }: WorkoutPageProps): Promise<Metadata> {
  const { id } = await params;
  const workout = await getWorkout(id);

  if (!workout) {
    return { title: 'Workout Not Found | CoachTrack' };
  }

  const description = workout.description
    ? workout.description.slice(0, 160)
    : `${workout.type.charAt(0).toUpperCase() + workout.type.slice(1)} workout on CoachTrack`;

  return {
    title: `${workout.name} | CoachTrack`,
    description,
    openGraph: {
      title: workout.name,
      description,
      type: 'article',
      siteName: 'CoachTrack',
    },
    twitter: {
      card: 'summary',
      title: workout.name,
      description,
    },
  };
}

export default async function PublicWorkoutPage({ params }: WorkoutPageProps) {
  const { id } = await params;
  const workout = await getWorkout(id);

  if (!workout) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <WorkoutPreview workout={workout} workoutId={id} />
      </div>
    </div>
  );
}
