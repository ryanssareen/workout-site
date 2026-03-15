export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// ── Strava rate-limit header parser ──────────────────────────────────────────
function getRateLimitMessage(resp: Response): { message: string; isDaily: boolean; isCooldown: boolean } {
  const limitHeader = resp.headers.get('x-ratelimit-limit');   // e.g. "100,1000"
  const usageHeader = resp.headers.get('x-ratelimit-usage');   // e.g. "34,562"
  if (limitHeader && usageHeader) {
    const [fifteenMinLimit, dailyLimit] = limitHeader.split(',').map(Number);
    const [fifteenMinUsage, dailyUsage] = usageHeader.split(',').map(Number);
    console.log(`📊 Strava rate limits: ${fifteenMinUsage}/${fifteenMinLimit} (15-min), ${dailyUsage}/${dailyLimit} (daily)`);
    if (dailyUsage >= dailyLimit) {
      return { message: `Strava daily limit reached (${dailyUsage}/${dailyLimit}). Resets at midnight UTC.`, isDaily: true, isCooldown: false };
    }
    if (fifteenMinUsage >= fifteenMinLimit) {
      return { message: `Strava 15-min limit reached (${fifteenMinUsage}/${fifteenMinLimit}). Try again in ~15 minutes.`, isDaily: false, isCooldown: false };
    }
    // 429 but counters under limit — window rollover cooldown
    return {
      message: `Strava rate limit cooldown (${fifteenMinUsage}/${fifteenMinLimit} 15-min, ${dailyUsage}/${dailyLimit} daily). Try again in a minute.`,
      isDaily: false,
      isCooldown: true,
    };
  }
  return { message: 'Strava rate limit reached. Try again in a few minutes.', isDaily: false, isCooldown: false };
}

async function fetchGearDetails(gearId: string | undefined, accessToken: string): Promise<any | null> {
  if (!gearId) return null;
  try {
    const resp = await fetch(
      `https://www.strava.com/api/v3/gear/${gearId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
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
        splitsMetric: workout.splitsMetric || [],
        splitsStandard: workout.splitsStandard || [],
        bestEfforts: workout.stravaExtended?.bestEfforts || [],
        segmentEfforts: workout.stravaExtended?.segmentEfforts || [],
        stravaExtended: workout.stravaExtended || null,
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
      try {
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

        if (refreshResp.ok) {
          const refreshData = await refreshResp.json();
          accessToken = refreshData.access_token;

          // Update tokens in Firestore
          await adminDb.collection('users').doc(userId).update({
            stravaAccessToken: refreshData.access_token,
            stravaRefreshToken: refreshData.refresh_token,
            stravaTokenExpiresAt: refreshData.expires_at,
          });
        } else {
          // Refresh failed (429 or other) — continue with existing token.
          // Sync likely refreshed it recently; Strava tokens last ~6 hours.
          console.warn(`⚠️ Token refresh failed (${refreshResp.status}) — trying existing token`);
        }
      } catch (refreshErr) {
        console.warn('⚠️ Token refresh network error — trying existing token', refreshErr);
      }
    }

    // Fetch detailed activity from Strava
    const stravaResp = await fetch(
      `https://www.strava.com/api/v3/activities/${workout.stravaActivityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!stravaResp.ok) {
      if (stravaResp.status === 429) {
        const rl = getRateLimitMessage(stravaResp);
        return NextResponse.json({ error: rl.message, rateLimited: true, isDailyLimit: rl.isDaily, isCooldown: rl.isCooldown }, { status: 429 });
      }
      if (stravaResp.status === 401) {
        return NextResponse.json({ error: 'Strava token expired. Please reconnect Strava.', needsReconnect: true }, { status: 401 });
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

    const splitsMetric = (detail.splits_metric || []).map((s: any) => ({
      split: s.split,
      distance: s.distance,
      elapsedTime: s.elapsed_time,
      movingTime: s.moving_time,
      avgSpeed: s.average_speed,
      ...(s.elevation_difference != null ? { elevationDifference: s.elevation_difference } : {}),
      ...(s.pace_zone != null ? { paceZone: s.pace_zone } : {}),
    }));
    const splitsStandard = (detail.splits_standard || []).map((s: any) => ({
      split: s.split,
      distance: s.distance,
      elapsedTime: s.elapsed_time,
      movingTime: s.moving_time,
      avgSpeed: s.average_speed,
      ...(s.elevation_difference != null ? { elevationDifference: s.elevation_difference } : {}),
      ...(s.pace_zone != null ? { paceZone: s.pace_zone } : {}),
    }));
    const splits = splitsMetric.length > 0 ? splitsMetric : splitsStandard;

    const bestEfforts = Array.isArray(detail.best_efforts)
      ? detail.best_efforts.map((effort: any) => ({
          ...(effort.id != null ? { id: effort.id } : {}),
          ...(effort.name ? { name: effort.name } : {}),
          ...(effort.elapsed_time != null ? { elapsedTime: effort.elapsed_time } : {}),
          ...(effort.moving_time != null ? { movingTime: effort.moving_time } : {}),
          ...(effort.start_date ? { startDate: effort.start_date } : {}),
          ...(effort.distance != null ? { distance: effort.distance } : {}),
          ...(effort.pr_rank != null ? { prRank: effort.pr_rank } : {}),
          ...(effort.achievement_count != null ? { achievementCount: effort.achievement_count } : {}),
        }))
      : [];

    const segmentEfforts = Array.isArray(detail.segment_efforts)
      ? detail.segment_efforts.map((effort: any) => ({
          ...(effort.id != null ? { id: effort.id } : {}),
          ...(effort.name ? { name: effort.name } : {}),
          ...(effort.elapsed_time != null ? { elapsedTime: effort.elapsed_time } : {}),
          ...(effort.moving_time != null ? { movingTime: effort.moving_time } : {}),
          ...(effort.start_date ? { startDate: effort.start_date } : {}),
          ...(effort.distance != null ? { distance: effort.distance } : {}),
          ...(effort.average_cadence != null ? { averageCadence: effort.average_cadence } : {}),
          ...(effort.average_watts != null ? { averageWatts: effort.average_watts } : {}),
          ...(effort.device_watts != null ? { deviceWatts: effort.device_watts } : {}),
          ...(effort.average_heartrate != null ? { averageHeartrate: effort.average_heartrate } : {}),
          ...(effort.max_heartrate != null ? { maxHeartrate: effort.max_heartrate } : {}),
          ...(effort.kom_rank != null ? { komRank: effort.kom_rank } : {}),
          ...(effort.pr_rank != null ? { prRank: effort.pr_rank } : {}),
          ...(effort.achievement_count != null ? { achievementCount: effort.achievement_count } : {}),
        }))
      : [];

    const gearRaw = await fetchGearDetails(detail.gear_id, accessToken);
    const gear = detail.gear_id
      ? {
          id: String(detail.gear_id),
          ...(gearRaw?.name ? { name: gearRaw.name } : {}),
          ...(gearRaw?.nickname ? { nickname: gearRaw.nickname } : {}),
          ...(gearRaw?.brand_name ? { brandName: gearRaw.brand_name } : {}),
          ...(gearRaw?.model_name ? { modelName: gearRaw.model_name } : {}),
          ...(gearRaw?.distance != null ? { distance: gearRaw.distance } : {}),
          ...(gearRaw?.primary != null ? { primary: gearRaw.primary } : {}),
          ...(gearRaw?.resource_state != null ? { resourceState: gearRaw.resource_state } : {}),
        }
      : null;

    const stravaExtended: any = {
      ...(detail.elapsed_time != null ? { elapsedTime: detail.elapsed_time } : {}),
      ...(detail.suffer_score != null ? { sufferScore: detail.suffer_score } : {}),
      ...(detail.perceived_exertion != null ? { perceivedExertion: detail.perceived_exertion } : {}),
      ...(detail.description ? { description: detail.description } : {}),
      ...(detail.device_name ? { deviceName: detail.device_name } : {}),
      ...(detail.average_cadence != null ? { averageCadence: detail.average_cadence } : {}),
      ...(detail.average_temp != null ? { averageTemp: detail.average_temp } : {}),
      ...(detail.weighted_average_watts != null ? { weightedAverageWatts: detail.weighted_average_watts } : {}),
      ...(detail.kilojoules != null ? { kilojoules: detail.kilojoules } : {}),
      ...(detail.has_heartrate != null ? { hasHeartrate: detail.has_heartrate } : {}),
      ...(detail.pr_count != null ? { prCount: detail.pr_count } : {}),
      ...(gear ? { gear } : {}),
      ...(bestEfforts.length > 0 ? { bestEfforts } : {}),
      ...(segmentEfforts.length > 0 ? { segmentEfforts } : {}),
    };

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
    if (splitsMetric.length > 0) updateData.splitsMetric = splitsMetric;
    if (splitsStandard.length > 0) updateData.splitsStandard = splitsStandard;
    if (photos.length > 0) updateData.photos = photos;
    if (photos.length > 0 || detail.total_photo_count > 0 || workout.hasStravaPhotos) updateData.hasStravaPhotos = true;
    if (Object.keys(stravaExtended).length > 0) updateData.stravaExtended = stravaExtended;

    await workoutRef.update(updateData);

    return NextResponse.json({
      cached: false,
      laps,
      splits,
      splitsMetric,
      splitsStandard,
      bestEfforts,
      segmentEfforts,
      stravaExtended,
      photos,
    });
  } catch (error: any) {
    console.error('Activity details error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch activity details' }, { status: 500 });
  }
}
