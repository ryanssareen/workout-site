export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

// IST offset: 5 hours 30 minutes in milliseconds
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19,800,000 ms

/**
 * One-time migration: Fix existing Strava workout dates.
 *
 * Old Strava sync code used `start_date_local` (local time tagged as UTC),
 * so a 6:00 AM IST run was stored as 6:00 AM UTC instead of 12:30 AM UTC.
 *
 * This endpoint subtracts 5h30m (IST offset) from `date` and `completedAt`
 * on all Strava workouts that haven't been fixed yet (timezoneFixed !== true).
 *
 * GET /api/workouts/fix-timezone?secret=fix-tz-2024
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Simple protection against accidental invocation
  if (secret !== 'fix-tz-2024') {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
  }

  const dryRun = searchParams.get('dryRun') === 'true';

  try {
    // Get all users
    const usersSnapshot = await adminDb.collection('users').get();
    console.log(`🔄 Timezone migration: found ${usersSnapshot.size} users`);

    let totalFixed = 0;
    let totalSkipped = 0;
    let totalAlreadyFixed = 0;
    const userSummaries: { userId: string; fixed: number; skipped: number; alreadyFixed: number }[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      // Query all Strava workouts for this user
      const workoutsSnapshot = await adminDb
        .collection('users')
        .doc(userId)
        .collection('workouts')
        .where('source', '==', 'strava')
        .get();

      if (workoutsSnapshot.empty) {
        continue;
      }

      let fixed = 0;
      let skipped = 0;
      let alreadyFixed = 0;

      // Process in batches of 490 (Firestore max is 500 per batch)
      let batch = adminDb.batch();
      let batchCount = 0;

      for (const workoutDoc of workoutsSnapshot.docs) {
        const data = workoutDoc.data();

        // Skip if already fixed
        if (data.timezoneFixed === true) {
          alreadyFixed++;
          continue;
        }

        // Get the current date timestamp
        const currentDate = data.date?.toDate?.();
        if (!currentDate) {
          skipped++;
          continue;
        }

        // Subtract IST offset to get actual UTC
        const correctedDate = new Date(currentDate.getTime() - IST_OFFSET_MS);

        // Also fix completedAt if it exists
        const currentCompletedAt = data.completedAt?.toDate?.();
        const correctedCompletedAt = currentCompletedAt
          ? new Date(currentCompletedAt.getTime() - IST_OFFSET_MS)
          : null;

        if (!dryRun) {
          const updateData: Record<string, any> = {
            date: admin.firestore.Timestamp.fromDate(correctedDate),
            timezoneFixed: true,
          };

          if (correctedCompletedAt) {
            updateData.completedAt = admin.firestore.Timestamp.fromDate(correctedCompletedAt);
          }

          batch.update(workoutDoc.ref, updateData);
          batchCount++;

          // Commit batch when it reaches 490
          if (batchCount >= 490) {
            await batch.commit();
            batch = adminDb.batch();
            batchCount = 0;
          }
        }

        fixed++;
      }

      // Commit remaining batch
      if (!dryRun && batchCount > 0) {
        await batch.commit();
      }

      if (fixed > 0 || alreadyFixed > 0) {
        console.log(`  👤 ${userId}: fixed=${fixed}, skipped=${skipped}, alreadyFixed=${alreadyFixed}`);
        userSummaries.push({ userId, fixed, skipped, alreadyFixed });
      }

      totalFixed += fixed;
      totalSkipped += skipped;
      totalAlreadyFixed += alreadyFixed;
    }

    console.log(`✅ Timezone migration complete: fixed=${totalFixed}, skipped=${totalSkipped}, alreadyFixed=${totalAlreadyFixed}`);

    return NextResponse.json({
      success: true,
      dryRun,
      totalUsers: usersSnapshot.size,
      totalFixed,
      totalSkipped,
      totalAlreadyFixed,
      users: userSummaries,
    });
  } catch (error: any) {
    console.error('❌ Timezone migration error:', error);
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    );
  }
}
