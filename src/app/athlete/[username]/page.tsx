import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import { notFound } from 'next/navigation';
import { AthleteProfileClient, type AthleteProfileData } from './AthleteProfileClient';

interface AthletePageProps {
  params: Promise<{ username: string }>;
}

interface SerializedWorkout {
  id: string;
  name: string;
  type: string;
  date: string;
  completed: boolean;
  duration?: number;
  actualStats?: {
    distance?: number;
    duration?: number;
    calories?: number;
    avgHeartRate?: number;
    elevationGain?: number;
  };
  strength?: {
    exercises?: {
      name: string;
      sets: number;
      reps: number;
      weight?: number;
      weightUnit?: string;
    }[];
  };
}

interface SerializedPR {
  id: string;
  name: string;
  value: number;
  unit: string;
  category: string;
  date: string;
}

async function getAthleteProfile(username: string): Promise<AthleteProfileData | null> {
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
        photoURL: null,
        bio: null,
        ageRange: null,
        experienceLevel: null,
        sportPreferences: [],
        trainingFor: [],
        profileTagline: null,
        stravaConnected: false,
        memberSince: null,
        workouts: [],
        personalRecords: [],
      };
    }

    // Fetch completed workouts
    const workoutsSnap = await db
      .collection('users').doc(username).collection('workouts')
      .where('completed', '==', true)
      .get();

    const workouts: SerializedWorkout[] = workoutsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || 'Workout',
        type: d.type || 'other',
        date: d.date?.toDate?.()?.toISOString() || new Date().toISOString(),
        completed: true,
        duration: d.duration || undefined,
        actualStats: d.actualStats ? {
          distance: d.actualStats.distance || undefined,
          duration: d.actualStats.duration || undefined,
          calories: d.actualStats.calories || undefined,
          avgHeartRate: d.actualStats.avgHeartRate || undefined,
          elevationGain: d.actualStats.elevationGain || undefined,
        } : undefined,
        strength: d.strength?.exercises ? {
          exercises: d.strength.exercises.map((ex: any) => ({
            name: ex.name,
            sets: ex.sets || 0,
            reps: ex.reps || 0,
            weight: ex.weight || undefined,
            weightUnit: ex.weightUnit || undefined,
          })),
        } : undefined,
      };
    });

    // Fetch personal records
    const prsSnap = await db.collection('personalRecords')
      .where('userId', '==', username)
      .limit(10)
      .get();

    const personalRecords: SerializedPR[] = prsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || 'Record',
        value: d.value || 0,
        unit: d.unit || '',
        category: d.category || 'other',
        date: d.date?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return {
      isPrivate: false,
      displayName: userData.displayName || username,
      username,
      photoURL: userData.photoURL || null,
      bio: userData.bio || null,
      ageRange: userData.ageRange || null,
      experienceLevel: userData.experienceLevel || null,
      sportPreferences: userData.sportPreferences || [],
      trainingFor: userData.trainingFor || [],
      profileTagline: userData.profileTagline || null,
      stravaConnected: !!userData.stravaId,
      memberSince: userData.createdAt?.toDate?.()?.toISOString() || null,
      workouts,
      personalRecords,
    };
  } catch (error) {
    console.error('Error fetching athlete profile:', error);
    return null;
  }
}

export async function generateMetadata({ params }: AthletePageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getAthleteProfile(username);

  if (!profile || profile.isPrivate) {
    return { title: 'Athlete Profile | The Daily Athlete' };
  }

  const title = `${profile.displayName} (@${profile.username}) | The Daily Athlete`;
  const description = profile.profileTagline
    || `${profile.displayName} trains on The Daily Athlete. ${profile.workouts.length} workouts and counting.`;

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

export default async function AthletePage({ params }: AthletePageProps) {
  const { username } = await params;
  const profile = await getAthleteProfile(username);

  if (!profile) {
    notFound();
  }

  return <AthleteProfileClient profile={profile} />;
}
