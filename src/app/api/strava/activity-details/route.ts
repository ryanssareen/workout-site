export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// ── Strava rate-limit header parser ──────────────────────────────────────────
function getRateLimitMessage(resp: Response): { message: string; isDaily: boolean } {
  const limitHeader = resp.headers.get('x-ratelimit-limit');   // e.g. "100,1000"
  const usageHeader = resp.headers.get('x-ratelimit-usage');   // e.g. "34,562"
  if (limitHeader && usageHeader) {
    const [fifteenMinLimit, dailyLimit] = limitHeader.split(',').map(Number);
    const [fifteenMinUsage, dailyUsage] = usageHeader.split(',').map(Number);
    console.log(`📊 Strava rate limits: ${fifteenMinUsage}/${fifteenMinLimit} (15-min), ${dailyUsage}/${dailyLimit} (daily)`);
    if (dailyUsage >= dailyLimit) {
      return { message: `Strava daily limit reached (${dailyUsage}/${dailyLimit}). Resets at midnight UTC.`, isDaily: true };
    }
    if (fifteenMinUsage >= fifteenMinLimit) {
      return { message: `Strava 15-min limit reached (${fifteenMinUsage}/${fifteenMinLimit}). Try again in ~15 minutes.`, isDaily: false };
    }
  }
  return { message: 'Strava rate limit reached. Try again in a few minutes.', isDaily: false };
}

/**
 * On-demand endpoint to fetch detailed Strava activity data (laps & splits)
 * for a specific workout. Used when viewing older workouts that were synced
 * during backfill (without detailed data).
 *
 * GET /api/strava/activity-details?userId=X&workoutId=Y
 *
 * - If stravaDetailsFetched is already true, returns cached data from Firestore
 * - Otherwise, calls GET /activities/{id} on Strava, stores laps/splits, returns them
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const workoutId = searchParams.get('workoutId');

    if (!userId || !workoutId) {
      return NextResponse.json({ error: 'userId and workoutId are required' }, { status: 400 });
    }

    // Read workout doc
    const workoutRef = adminDb.collection('users').doc(userId).collection('workouts').doc(workoutId);
    const workoutDoc = await workoutRef.get();

    if (!workoutDoc.exists) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    const workout = workoutDoc.data()!;

    if (!workout.stravaActivityId) {
      return NextResponse.json({ error: 'Not a Strava workout' }, { status: 400 });
    }

    // If already fetched, return cached data
    if (workout.stravaDetailsFetched) {
      return NextResponse.json({
        cached: true,
        laps: workout.laps || [],
        splits: workout.splits || [],
        photos: workout.photos || [],
      });
    }

    // Read user's Strava tokens
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    let accessToken = userData.stravaAccessToken;

    if (!accessToken) {
      return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
    }

    // Check token expiry and refresh if needed
    const currentTime = Math.floor(Date.now() / 1000);
    const expiresAt = userData.stravaTokenExpiresAt?.toDate
      ? Math.floor(userData.stravaTokenExpiresAt.toDate().getTime() / 1000)
      : userData.stravaTokenExpiresAt instanceof Date
        ? Math.floor(userData.stravaTokenExpiresAt.getTime() / 1000)
        : userData.stravaTokenExpiresAt;

    if (expiresAt && expiresAt < currentTime && userData.stravaRefreshToken) {
      const refreshResp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: userData.stravaRefreshToken,
        }),
      });

      if (!refreshResp.ok) {
        if (refreshResp.status === 429) {
          const rl = getRateLimitMessage(refreshResp);
          return NextResponse.json({ error: rl.message, rateLimited: true, isDailyLimit: rl.isDaily }, { status: 429 });
        }
        return NextResponse.json({ error: 'Failed to refresh Strava token', needsReconnect: true }, { status: 401 });
      }

      const refreshData = await refreshResp.json();
      accessToken = refreshData.access_token;

      // Update tokens in Firestore
      await adminDb.collection('users').doc(userId).update({
        stravaAccessToken: refreshData.access_token,
        stravaRefreshToken: refreshData.refresh_token,
        stravaTokenExpiresAt: refreshData.expires_at,
      });
    }

    // Fetch detailed activity from Strava
    const stravaResp = await fetch(
      `https://www.strava.com/api/v3/activities/${workout.stravaActivityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!stravaResp.ok) {
      if (stravaResp.status === 429) {
        const rl = getRateLimitMessage(stravaResp);
        return NextResponse.json({ error: rl.message, rateLimited: true, isDailyLimit: rl.isDaily }, { status: 429 });
      }
      return NextResponse.json({ error: `Strava API error: ${stravaResp.status}` }, { status: 500 });
    }

    const detail = await stravaResp.json();

    // Map laps and splits
    const laps = (detail.laps || []).map((lap: any, idx: number) => ({
      index: idx + 1,
      name: lap.name || `Lap ${idx + 1}`,
      distance: lap.distance,
      elapsedTime: lap.elapsed_time,
      movingTime: lap.moving_time,
      avgSpeed: lap.average_speed,
      maxSpeed: lap.max_speed,
      ...(lap.average_cadence != null ? { avgCadence: lap.average_cadence } : {}),
      ...(lap.average_watts != null ? { avgWatts: lap.average_watts } : {}),
      ...(lap.total_elevation_gain != null ? { totalElevationGain: lap.total_elevation_gain } : {}),
    }));

    const splits = (detail.splits_metric || []).map((s: any) => ({
      split: s.split,
      distance: s.distance,
      elapsedTime: s.elapsed_time,
      movingTime: s.moving_time,
      avgSpeed: s.average_speed,
      ...(s.elevation_difference != null ? { elevationDifference: s.elevation_difference } : {}),
      ...(s.pace_zone != null ? { paceZone: s.pace_zone } : {}),
    }));

    // Fetch photos if activity has them (detail response includes photo count)
    let photos: string[] = [];
    if (detail.total_photo_count > 0 || workout.hasStravaPhotos) {
      try {
        const photosResp = await fetch(
          `https://www.strava.com/api/v3/activities/${workout.stravaActivityId}/photos?size=600&photo_sources=true`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (photosResp.ok) {
          const photosData = await photosResp.json();
          if (Array.isArray(photosData)) {
            for (const photo of photosData) {
              const url = photo.urls?.['600'] || photo.urls?.['100'] || photo.urls?.['0'];
              if (url) photos.push(url);
            }
          }
        }
      } catch {
        // Non-fatal — photos are optional
      }
    }

    // Store in Firestore for future use (cache)
    const updateData: any = { stravaDetailsFetched: true };
    if (laps.length > 0) updateData.laps = laps;
    if (splits.length > 0) updateData.splits = splits;
    if (photos.length > 0) updateData.photos = photos;

    await workoutRef.update(updateData);

    return NextResponse.json({
      cached: false,
      laps,
      splits,
      photos,
    });
  } catch (error: any) {
    console.error('Activity details error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch activity details' }, { status: 500 });
  }
}
