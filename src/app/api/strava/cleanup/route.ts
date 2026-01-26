export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// GET: Clean up duplicate Strava workouts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`🧹 Cleaning up duplicate Strava workouts for user: ${userId}`);

    // Get all Strava workouts for this user
    const workoutsSnapshot = await adminDb
      .collection('workouts')
      .where('assignedTo', '==', userId)
      .where('source', '==', 'strava')
      .get();

    console.log(`📊 Found ${workoutsSnapshot.size} total Strava workouts`);

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

    // Find duplicates and delete all but the first one
    let deletedCount = 0;
    const duplicateStravaIds: string[] = [];

    for (const [stravaId, workouts] of Object.entries(workoutsByStravaId)) {
      if (workouts.length > 1) {
        duplicateStravaIds.push(stravaId);
        console.log(`🔍 Found ${workouts.length} duplicates for Strava activity ${stravaId}`);

        // Sort by createdAt to keep the oldest one
        workouts.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return aTime - bTime;
        });

        // Delete all except the first (oldest) one
        for (let i = 1; i < workouts.length; i++) {
          console.log(`  🗑️ Deleting duplicate: ${workouts[i].id}`);
          await adminDb.collection('workouts').doc(workouts[i].id).delete();
          deletedCount++;
        }
      }
    }

    console.log(`✅ Cleanup complete: Deleted ${deletedCount} duplicate workouts`);

    return NextResponse.json({
      success: true,
      totalWorkouts: workoutsSnapshot.size,
      duplicateActivities: duplicateStravaIds.length,
      deletedWorkouts: deletedCount,
      message: deletedCount > 0
        ? `Deleted ${deletedCount} duplicate workouts from ${duplicateStravaIds.length} activities`
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
