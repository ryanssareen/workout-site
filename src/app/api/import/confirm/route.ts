import { NextRequest, NextResponse } from 'next/server';
import { sessionCache } from '../analyze/route';
import { collection, doc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, selectedIndexes, userId, userName } = body as {
      sessionId: string;
      selectedIndexes: number[];
      userId: string;
      userName?: string;
    };

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'Missing sessionId or userId' }, { status: 400 });
    }

    const session = sessionCache.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session expired. Please re-upload your file.' }, { status: 404 });
    }
    if (session.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Filter to selected valid workouts
    const toImport = session.workouts.filter(
      w => selectedIndexes.includes(w.rowIndex) && w.status !== 'error'
    );

    if (toImport.length === 0) {
      return NextResponse.json({ error: 'No valid workouts to import' }, { status: 400 });
    }

    const db = getDbInstance();
    const workoutsRef = collection(db, 'workouts');
    const createdIds: string[] = [];

    // Firestore batch (max 500 per batch)
    const batchSize = 500;
    for (let i = 0; i < toImport.length; i += batchSize) {
      const chunk = toImport.slice(i, i + batchSize);
      const batch = writeBatch(db);

      for (const workout of chunk) {
        const ref = doc(workoutsRef);
        createdIds.push(ref.id);

        const workoutDate = Timestamp.fromDate(workout.date);
        const workoutDoc: Record<string, any> = {
          name: workout.name,
          type: workout.type,
          date: workoutDate,
          completed: true,
          completedAt: workoutDate,
          completedBy: 'import',
          source: 'import',
          createdBy: userId,
          assignedTo: userId,
          assignedToName: userName || '',
          tags: workout.tags || [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (workout.duration) workoutDoc.duration = workout.duration;
        if (workout.description) workoutDoc.description = workout.description;
        if (workout.calories) workoutDoc.calories = workout.calories;

        // Type-specific data
        if ((workout.type === 'run' || workout.type === 'bike') && workout.distance) {
          workoutDoc[workout.type] = {
            distance: workout.distance,
            distanceUnit: workout.distanceUnit || 'km',
            ...(workout.duration ? { time: workout.duration } : {}),
            ...(workout.pace ? { pace: workout.pace } : {}),
            ...(workout.elevation ? { elevationGain: workout.elevation } : {}),
            ...(workout.avgHeartRate ? { avgHeartRate: workout.avgHeartRate } : {}),
          };
        }

        if (workout.type === 'swim' && workout.distance) {
          workoutDoc.swim = {
            distance: workout.distance,
            distanceUnit: workout.distanceUnit || 'meters',
            ...(workout.duration ? { time: workout.duration } : {}),
            ...(workout.pace ? { pace: workout.pace } : {}),
          };
        }

        if (workout.type === 'strength' && workout.exercises?.length) {
          workoutDoc.strength = {
            exercises: workout.exercises.map(ex => ({
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              ...(ex.weight ? { weight: ex.weight } : {}),
              ...(ex.weightUnit ? { weightUnit: ex.weightUnit } : {}),
            })),
          };
        }

        batch.set(ref, workoutDoc);
      }

      await batch.commit();
    }

    // Clean up session
    sessionCache.delete(sessionId);

    return NextResponse.json({
      success: true,
      imported: createdIds.length,
      workoutIds: createdIds,
    });
  } catch (error: any) {
    console.error('Import confirm failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import workouts' },
      { status: 500 }
    );
  }
}
