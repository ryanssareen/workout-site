import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import { notFound } from 'next/navigation';
import { PreviewClient } from './PreviewClient';

interface PreviewPageProps {
  params: Promise<{ username: string; id: string }>;
}

async function getWorkout(username: string, id: string) {
  try {
    const db = getAdminDb();
    const doc = await db.collection('users').doc(username).collection('workouts').doc(id).get();
    if (!doc.exists) return null;

    const data = doc.data()!;

    // Get coach name
    let coachName: string | null = null;
    if (data.createdBy) {
      const coachDoc = await db.collection('users').doc(data.createdBy).get();
      if (coachDoc.exists) {
        coachName = coachDoc.data()?.displayName || null;
      }
    }

    return {
      id: doc.id,
      ownerUsername: username,
      name: data.name || 'Untitled Workout',
      type: data.type || 'other',
      description: data.description || '',
      date: data.date?.toDate?.()?.toISOString() || new Date().toISOString(),
      duration: data.duration || null,
      completed: data.completed || false,
      source: data.source || 'manual',
      tags: data.tags || [],
      photos: data.photos || [],
      coachName,
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
            aiComment: data.routeData.aiComment || null,
          }
        : null,
    };
  } catch (error) {
    console.error('Error fetching workout for preview:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PreviewPageProps): Promise<Metadata> {
  const { username, id } = await params;
  const workout = await getWorkout(username, id);

  if (!workout) {
    return { title: 'Workout Not Found | The Daily Athlete' };
  }

  const typeEmoji: Record<string, string> = { run: '🏃', bike: '🚴', swim: '🏊', strength: '💪', other: '⚡' };
  const emoji = typeEmoji[workout.type] || '⚡';
  const title = `${emoji} ${workout.name} | The Daily Athlete`;

  const description = workout.description
    ? workout.description.slice(0, 160)
    : `${workout.type.charAt(0).toUpperCase() + workout.type.slice(1)} workout on The Daily Athlete`;

  return {
    title,
    description,
    openGraph: {
      title: `${emoji} ${workout.name}`,
      description,
      type: 'article',
      siteName: 'The Daily Athlete',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${emoji} ${workout.name}`,
      description,
    },
  };
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { username, id } = await params;
  const workout = await getWorkout(username, id);

  if (!workout) {
    notFound();
  }

  return <PreviewClient workout={workout} />;
}
