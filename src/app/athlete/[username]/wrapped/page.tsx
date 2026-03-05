import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import { notFound } from 'next/navigation';
import { WrappedPublicClient } from './WrappedClient';

interface WrappedPageProps {
  params: Promise<{ username: string }>;
}

export interface SerializedWrappedWorkout {
  id: string;
  name: string;
  type: string;
  date: string;
  completed: boolean;
  duration?: number;
  tags?: string[];
  actualStats?: {
    distance?: number;
    duration?: number;
    calories?: number;
    elevationGain?: number;
  };
  stravaData?: {
    distance?: number;
    time?: number;
    elevationGain?: number;
    avgPower?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
  };
  swim?: {
    distance?: number;
    distanceUnit?: string;
    time?: number;
  };
  bike?: {
    distance?: number;
    distanceUnit?: string;
    time?: number;
    elevationGain?: number;
  };
  run?: {
    distance?: number;
    distanceUnit?: string;
    time?: number;
    elevationGain?: number;
  };
  strength?: {
    totalTime?: number;
    exercises?: { name: string; sets: number; reps: number; weight?: number; weightUnit?: string }[];
  };
  other?: {
    description?: string;
    duration?: number;
  };
  prs?: { exerciseName: string; previousValue: number; newValue: number; unit: string }[];
}

export interface WrappedPublicData {
  isPrivate: boolean;
  displayName: string;
  username: string;
  workouts: SerializedWrappedWorkout[];
}

async function getWrappedData(username: string): Promise<WrappedPublicData | null> {
  try {
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(username).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data()!;

    // Privacy gate
    if (userData.profilePublic === false) {
      return {
        isPrivate: true,
        displayName: userData.displayName || username,
        username,
        workouts: [],
      };
    }

    // Fetch all workouts for the user (we filter by year on the client)
    const workoutsSnap = await db
      .collection('users').doc(username).collection('workouts')
      .get();

    const workouts: SerializedWrappedWorkout[] = workoutsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || 'Workout',
        type: d.type || 'other',
        date: d.date?.toDate?.()?.toISOString() || new Date().toISOString(),
        completed: d.completed || false,
        duration: d.duration || undefined,
        tags: d.tags || undefined,
        actualStats: d.actualStats ? {
          distance: d.actualStats.distance || undefined,
          duration: d.actualStats.duration || undefined,
          calories: d.actualStats.calories || undefined,
          elevationGain: d.actualStats.elevationGain || undefined,
        } : undefined,
        stravaData: d.stravaData ? {
          distance: d.stravaData.distance || undefined,
          time: d.stravaData.time || undefined,
          elevationGain: d.stravaData.elevationGain || undefined,
          avgPower: d.stravaData.avgPower || undefined,
          avgHeartRate: d.stravaData.avgHeartRate || undefined,
          maxHeartRate: d.stravaData.maxHeartRate || undefined,
        } : undefined,
        swim: d.swim ? {
          distance: d.swim.distance || undefined,
          distanceUnit: d.swim.distanceUnit || undefined,
          time: d.swim.time || undefined,
        } : undefined,
        bike: d.bike ? {
          distance: d.bike.distance || undefined,
          distanceUnit: d.bike.distanceUnit || undefined,
          time: d.bike.time || undefined,
          elevationGain: d.bike.elevationGain || undefined,
        } : undefined,
        run: d.run ? {
          distance: d.run.distance || undefined,
          distanceUnit: d.run.distanceUnit || undefined,
          time: d.run.time || undefined,
          elevationGain: d.run.elevationGain || undefined,
        } : undefined,
        strength: d.strength ? {
          totalTime: d.strength.totalTime || undefined,
          exercises: d.strength.exercises?.map((ex: any) => ({
            name: ex.name,
            sets: ex.sets || 0,
            reps: ex.reps || 0,
            weight: ex.weight || undefined,
            weightUnit: ex.weightUnit || undefined,
          })),
        } : undefined,
        other: d.other ? {
          description: d.other.description || undefined,
          duration: d.other.duration || undefined,
        } : undefined,
        prs: d.prs || undefined,
      };
    });

    return {
      isPrivate: false,
      displayName: userData.displayName || username,
      username,
      workouts,
    };
  } catch (error) {
    console.error('Error fetching wrapped data:', error);
    return null;
  }
}

export async function generateMetadata({ params }: WrappedPageProps): Promise<Metadata> {
  const { username } = await params;
  const data = await getWrappedData(username);

  if (!data || data.isPrivate) {
    return { title: '2025 Wrapped | The Daily Athlete' };
  }

  const title = `${data.displayName}'s 2025 Wrapped | The Daily Athlete`;
  const description = `Check out ${data.displayName}'s 2025 year in review on The Daily Athlete.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'The Daily Athlete',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function WrappedPublicPage({ params }: WrappedPageProps) {
  const { username } = await params;
  const data = await getWrappedData(username);

  if (!data) {
    notFound();
  }

  return <WrappedPublicClient data={data} />;
}
