export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// GET: Clean up duplicate Strava workouts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get('userId');
    const email = searchParams.get('email');

    // If email provided, look up user ID
    if (!userId && email) {
      const usersSnapshot = await adminDb
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
      }

      userId = usersSnapshot.docs[0].id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID or email is required' }, { status: 400 });
    }

    // Get all Strava workouts for this user
    const workoutsSnapshot = await adminDb
      .collection('users').doc(userId).collection('workouts')
      .where('source', '==', 'strava')
      .get();

    // Group by stravaActivityId
    const workoutsByStravaId: Record<string, { id: string; createdAt: any }[]> = {};

    for (const doc of workoutsSnapshot.docs) {
      const data = doc.data();
      const stravaId = data.stravaActivityId;
      if (!stravaId) continue;

      if (!workoutsByStravaId[stravaId]) {
        workoutsByStravaId[stravaId] = [];
      }
      workoutsByStravaId[stravaId].push({
        id: doc.id,
        createdAt: data.createdAt,
      });
    }

    // Find duplicates and batch delete
    const toDelete: string[] = [];

    for (const [, workouts] of Object.entries(workoutsByStravaId)) {
      if (workouts.length > 1) {
        // Sort by createdAt to keep the oldest one
        workouts.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return aTime - bTime;
        });

        // Mark all except the first (oldest) for deletion
        for (let i = 1; i < workouts.length; i++) {
          toDelete.push(workouts[i].id);
        }
      }
    }

    // Batch delete in chunks of 500 (Firestore limit)
    let deletedCount = 0;
    for (let i = 0; i < toDelete.length; i += 500) {
      const chunk = toDelete.slice(i, i + 500);
      const batch = adminDb.batch();

      for (const docId of chunk) {
        batch.delete(adminDb.collection('users').doc(userId).collection('workouts').doc(docId));
      }

      await batch.commit();
      deletedCount += chunk.length;
    }

    return NextResponse.json({
      success: true,
      totalWorkouts: workoutsSnapshot.size,
      deletedWorkouts: deletedCount,
      remainingWorkouts: workoutsSnapshot.size - deletedCount,
      message: deletedCount > 0
        ? `Deleted ${deletedCount} duplicates. ${workoutsSnapshot.size - deletedCount} workouts remain.`
        : 'No duplicates found',
    });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cleanup duplicates' },
      { status: 500 }
    );
  }
}
