export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min max for Vercel Pro, adjust if on hobby (60s)

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/strava/sync-all?after=2025-01-01
 *
 * Finds every user with Strava connected and triggers the per-user sync
 * endpoint for each one sequentially.  Pass ?after=YYYY-MM-DD to control
 * how far back to fetch (defaults to 1 year).
 *
 * Usage: paste this in your browser:
 *   https://your-site.vercel.app/api/strava/sync-all?after=2025-01-01
 */
export async function GET(request: NextRequest) {
  // Auth guard — require CRON_SECRET or ADMIN_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET;
  const token = authHeader?.replace('Bearer ', '');
  if (!token || (token !== cronSecret && token !== adminSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const after = searchParams.get('after'); // e.g. '2025-01-01'

  try {
    console.log('🔄 Strava sync-all requested');

    // Find all users who have Strava connected
    const usersSnapshot = await adminDb
      .collection('users')
      .where('stravaAccessToken', '!=', null)
      .get();

    const stravaUsers = usersSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.stravaAccessToken && data.stravaAccessToken.length > 0;
    });

    console.log(`👥 Found ${stravaUsers.length} users with Strava connected`);

    if (stravaUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with Strava connected',
        users: 0,
      });
    }

    // Build the base URL for the per-user sync endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const results: {
      userId: string;
      displayName: string;
      status: 'success' | 'error';
      newWorkouts?: number;
      mergedWorkouts?: number;
      totalActivities?: number;
      message?: string;
      error?: string;
    }[] = [];

    // Process each user sequentially to avoid rate-limiting Strava API
    for (let i = 0; i < stravaUsers.length; i++) {
      const userDoc = stravaUsers[i];
      const userData = userDoc.data();
      const userId = userDoc.id;
      const displayName = userData.displayName || userData.email || userId;

      console.log(`\n━━━ [${i + 1}/${stravaUsers.length}] Syncing: ${displayName} (${userId}) ━━━`);

      try {
        // Call the existing per-user sync endpoint
        const syncUrl = new URL('/api/strava/sync', baseUrl);
        syncUrl.searchParams.set('userId', userId);
        if (after) syncUrl.searchParams.set('after', after);

        const response = await fetch(syncUrl.toString(), {
          headers: { Accept: 'application/json' },
        });

        const data = await response.json();

        if (response.ok && data.success) {
          console.log(`  ✅ ${displayName}: ${data.message}`);
          results.push({
            userId,
            displayName,
            status: 'success',
            newWorkouts: data.newWorkouts,
            mergedWorkouts: data.mergedWorkouts,
            totalActivities: data.totalActivities,
            message: data.message,
          });
        } else {
          console.error(`  ❌ ${displayName}: ${data.error || 'Unknown error'}`);
          results.push({
            userId,
            displayName,
            status: 'error',
            error: data.error || 'Unknown error',
          });
        }
      } catch (err: any) {
        console.error(`  ❌ ${displayName}: ${err.message}`);
        results.push({
          userId,
          displayName,
          status: 'error',
          error: err.message,
        });
      }

      // Small delay between users to be polite to Strava API
      if (i < stravaUsers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const totalNew = results.reduce((sum, r) => sum + (r.newWorkouts || 0), 0);
    const totalMerged = results.reduce((sum, r) => sum + (r.mergedWorkouts || 0), 0);

    console.log(`\n✅ Sync-all complete in ${elapsed}s: ${successCount} succeeded, ${errorCount} failed, ${totalNew} new, ${totalMerged} merged`);

    return NextResponse.json({
      success: true,
      elapsed: `${elapsed}s`,
      summary: {
        totalUsers: stravaUsers.length,
        succeeded: successCount,
        failed: errorCount,
        totalNewWorkouts: totalNew,
        totalMergedWorkouts: totalMerged,
      },
      results,
    });
  } catch (error: any) {
    console.error('❌ Sync-all error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run sync-all' },
      { status: 500 }
    );
  }
}
