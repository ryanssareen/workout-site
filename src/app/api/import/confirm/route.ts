import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { SerializedWorkout } from '@/lib/import/types';
import { enrichWorkouts } from '@/lib/import/enricher';
import * as admin from 'firebase-admin';

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

    const db = getAdminDb();
    const sessionDoc = await db.collection('importSessions').doc(sessionId).get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session expired. Please re-upload your file.' }, { status: 404 });
    }

    const session = sessionDoc.data()!;
    if (session.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Deserialize workouts
    const allWorkouts: SerializedWorkout[] = JSON.parse(session.workouts);

    // Filter to selected valid workouts
    const toImport = allWorkouts.filter(
      w => selectedIndexes.includes(w.rowIndex) && w.status !== 'error'
    );

    if (toImport.length === 0) {
      return NextResponse.json({ error: 'No valid workouts to import' }, { status: 400 });
    }

    // Enrich workouts with Groq (standardize names, generate descriptions, suggest tags)
    const enrichments = await enrichWorkouts(toImport);

    const now = new Date();
    now.setHours(23, 59, 59, 999); // end of today
    const createdIds: string[] = [];

    // Firestore batch (max 500 per batch)
    const batchSize = 500;
    for (let i = 0; i < toImport.length; i += batchSize) {
      const chunk = toImport.slice(i, i + batchSize);
      const batch = db.batch();

      for (const workout of chunk) {
        const ref = db.collection('workouts').doc();
        createdIds.push(ref.id);

        // Apply Groq enrichments (better names, descriptions, tags)
        const enriched = enrichments.get(workout.rowIndex);

        const workoutDate = new Date(workout.date);
        const isPast = workoutDate <= now;
        const workoutTimestamp = admin.firestore.Timestamp.fromDate(workoutDate);

        const workoutDoc: Record<string, any> = {
          name: enriched?.name || workout.name,
          type: workout.type,
          date: workoutTimestamp,
          completed: isPast,
          ...(isPast ? {
            completedAt: workoutTimestamp,
            completedBy: 'import',
          } : {}),
          source: 'import',
          createdBy: userId,
          assignedTo: userId,
          assignedToName: userName || '',
          tags: enriched?.tags?.length ? enriched.tags : (workout.tags || []),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (workout.duration) workoutDoc.duration = workout.duration;
        // Use enriched description, fall back to original
        const desc = enriched?.description || workout.description;
        if (desc) workoutDoc.description = desc;
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
            exercises: workout.exercises.map((ex: { name: string; sets: number; reps: number; weight?: number; weightUnit?: string }) => ({
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
    await db.collection('importSessions').doc(sessionId).delete();

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
