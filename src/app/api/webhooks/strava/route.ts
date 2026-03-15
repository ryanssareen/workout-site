export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import crypto from 'crypto';
import { sendPushNotification } from '@/lib/push';

// Map Strava activity types to our workout types
function mapStravaType(stravaType: string): 'swim' | 'run' | 'bike' | 'strength' {
  const typeMap: Record<string, 'swim' | 'run' | 'bike' | 'strength'> = {
    'Run': 'run',
    'TrailRun': 'run',
    'VirtualRun': 'run',
    'Ride': 'bike',
    'VirtualRide': 'bike',
    'MountainBikeRide': 'bike',
    'GravelRide': 'bike',
    'EBikeRide': 'bike',
    'Swim': 'swim',
    'OpenWaterSwim': 'swim',
    'WeightTraining': 'strength',
    'Workout': 'strength',
    'CrossFit': 'strength',
    'Yoga': 'strength',
    'HIIT': 'strength',
    'Elliptical': 'strength',
    'StairStepper': 'strength',
    'Rowing': 'strength',
  };

  return typeMap[stravaType] || 'strength';
}

// Verify Strava webhook signature
function verifyWebhookSignature(body: string, signature: string): boolean {
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    console.warn('STRAVA_WEBHOOK_VERIFY_TOKEN not set - rejecting webhook for safety');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', verifyToken)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Refresh Strava access token if expired
async function refreshStravaToken(userId: string, refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('Failed to refresh Strava token');
      return null;
    }

    const data = await response.json();

    await adminDb.collection('users').doc(userId).update({
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token,
      stravaTokenExpiresAt: data.expires_at,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing Strava token:', error);
    return null;
  }
}

// Get access token for a user (refresh if needed)
async function getAccessToken(userId: string, userData: any): Promise<string | null> {
  let accessToken = userData.stravaAccessToken;
  const currentTime = Math.floor(Date.now() / 1000);

  // Handle stravaTokenExpiresAt stored as number, Date, or Firestore Timestamp
  const expiresAt = userData.stravaTokenExpiresAt?.toDate
    ? Math.floor(userData.stravaTokenExpiresAt.toDate().getTime() / 1000)
    : userData.stravaTokenExpiresAt instanceof Date
      ? Math.floor(userData.stravaTokenExpiresAt.getTime() / 1000)
      : userData.stravaTokenExpiresAt;

  if (expiresAt && expiresAt < currentTime) {
    const newToken = await refreshStravaToken(userId, userData.stravaRefreshToken);
    if (!newToken) {
      return null;
    }
    accessToken = newToken;
  }

  return accessToken;
}

// Fetch detailed activity data from Strava
async function fetchActivityDetails(activityId: string, accessToken: string) {
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch activity details:', await response.text());
    return null;
  }

  return response.json();
}

async function fetchActivityPhotos(activityId: string, accessToken: string): Promise<string[]> {
  try {
    const resp = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/photos?size=600&photo_sources=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data)) return [];

    const photos: string[] = [];
    for (const photo of data) {
      const url = photo?.urls?.['600'] || photo?.urls?.['100'] || photo?.urls?.['0'];
      if (typeof url === 'string' && url.length > 0) photos.push(url);
    }
    return photos;
  } catch {
    return [];
  }
}

/** Fetch gear details — best-effort, returns null on any error or rate limit. */
async function fetchGearDetails(gearId: string | undefined, accessToken: string): Promise<any | null> {
  if (!gearId) return null;
  try {
    const resp = await fetch(
      `https://www.strava.com/api/v3/gear/${gearId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!resp.ok) {
      if (resp.status === 429) console.log('⚠️ Gear fetch rate-limited — skipping');
      return null;
    }
    return resp.json();
  } catch {
    return null;
  }
}

function mapLaps(lapsRaw: any): any[] {
  if (!Array.isArray(lapsRaw)) return [];
  return lapsRaw.map((lap: any, idx: number) => ({
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
}

function mapSplits(splitsRaw: any): any[] {
  if (!Array.isArray(splitsRaw)) return [];
  return splitsRaw.map((split: any) => ({
    split: split.split,
    distance: split.distance,
    elapsedTime: split.elapsed_time,
    movingTime: split.moving_time,
    avgSpeed: split.average_speed,
    ...(split.elevation_difference != null ? { elevationDifference: split.elevation_difference } : {}),
    ...(split.pace_zone != null ? { paceZone: split.pace_zone } : {}),
  }));
}

function mapBestEfforts(bestEffortsRaw: any): any[] {
  if (!Array.isArray(bestEffortsRaw)) return [];
  return bestEffortsRaw.map((effort: any) => ({
    ...(effort.id != null ? { id: effort.id } : {}),
    ...(effort.name ? { name: effort.name } : {}),
    ...(effort.elapsed_time != null ? { elapsedTime: effort.elapsed_time } : {}),
    ...(effort.moving_time != null ? { movingTime: effort.moving_time } : {}),
    ...(effort.start_date ? { startDate: effort.start_date } : {}),
    ...(effort.distance != null ? { distance: effort.distance } : {}),
    ...(effort.pr_rank != null ? { prRank: effort.pr_rank } : {}),
    ...(effort.achievement_count != null ? { achievementCount: effort.achievement_count } : {}),
  }));
}

function mapSegmentEfforts(segmentEffortsRaw: any): any[] {
  if (!Array.isArray(segmentEffortsRaw)) return [];
  return segmentEffortsRaw.map((effort: any) => ({
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
  }));
}

// ── Shared helpers for building workout fields from Strava activity data ──

interface WorkoutFields {
  actualStats: Record<string, any>;
  routeData: Record<string, any>;
  typeData: Record<string, any>;
  stravaData: Record<string, any>;
  stravaExtended: Record<string, any>;
  laps: any[];
  splits: any[];
  splitsMetric: any[];
  splitsStandard: any[];
  timeMin: number;
}

function buildWorkoutFields(
  activity: any,
  workoutType: string,
  photos: string[],
  gearRaw: any | null,
): WorkoutFields {
  const actualStats: any = {};
  if (activity.distance) actualStats.distance = activity.distance;
  if (activity.moving_time) actualStats.duration = activity.moving_time;
  if (activity.calories) actualStats.calories = activity.calories;
  if (activity.average_heartrate) actualStats.avgHeartRate = activity.average_heartrate;
  if (activity.max_heartrate) actualStats.maxHeartRate = activity.max_heartrate;
  if (activity.average_speed) actualStats.avgSpeed = activity.average_speed;
  if (activity.max_speed) actualStats.maxSpeed = activity.max_speed;
  if (activity.total_elevation_gain) actualStats.elevationGain = activity.total_elevation_gain;

  const routeData: any = {};
  if (activity.map?.summary_polyline) routeData.polyline = activity.map.summary_polyline;
  if (activity.start_latlng) routeData.startLatLng = activity.start_latlng;
  if (activity.end_latlng) routeData.endLatLng = activity.end_latlng;

  const distKm = (activity.distance || 0) / 1000;
  const timeMin = Math.round((activity.moving_time || 0) / 60);

  const typeData: any = {};
  if (workoutType === 'run') {
    typeData.run = {
      distance: Math.round(distKm * 100) / 100,
      distanceUnit: 'km',
      time: timeMin,
      ...(activity.total_elevation_gain ? { elevationGain: Math.round(activity.total_elevation_gain) } : {}),
      ...(activity.average_heartrate ? { avgHeartRate: Math.round(activity.average_heartrate) } : {}),
      ...(distKm > 0 && timeMin > 0 ? {
        pace: `${Math.floor(timeMin / distKm)}:${String(Math.round(((timeMin / distKm) % 1) * 60)).padStart(2, '0')}/km`
      } : {}),
    };
  } else if (workoutType === 'bike') {
    typeData.bike = {
      distance: Math.round(distKm * 100) / 100,
      distanceUnit: 'km',
      time: timeMin,
      ...(activity.total_elevation_gain ? { elevationGain: Math.round(activity.total_elevation_gain) } : {}),
      ...(activity.average_watts ? { avgPower: Math.round(activity.average_watts) } : {}),
    };
  } else if (workoutType === 'swim') {
    typeData.swim = {
      distance: Math.round(activity.distance || 0),
      distanceUnit: 'meters',
      time: timeMin,
      ...(activity.average_heartrate ? { avgHeartRate: Math.round(activity.average_heartrate) } : {}),
    };
  }

  const laps = mapLaps(activity.laps);
  const splitsMetric = mapSplits(activity.splits_metric);
  const splitsStandard = mapSplits(activity.splits_standard);
  const splits = splitsMetric.length > 0 ? splitsMetric : splitsStandard;
  const bestEfforts = mapBestEfforts(activity.best_efforts);
  const segmentEfforts = mapSegmentEfforts(activity.segment_efforts);

  const gear = activity.gear_id
    ? {
        id: String(activity.gear_id),
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
    ...(activity.elapsed_time != null ? { elapsedTime: activity.elapsed_time } : {}),
    ...(activity.suffer_score != null ? { sufferScore: activity.suffer_score } : {}),
    ...(activity.perceived_exertion != null ? { perceivedExertion: activity.perceived_exertion } : {}),
    ...(activity.description ? { description: activity.description } : {}),
    ...(activity.device_name ? { deviceName: activity.device_name } : {}),
    ...(activity.average_cadence != null ? { averageCadence: activity.average_cadence } : {}),
    ...(activity.average_temp != null ? { averageTemp: activity.average_temp } : {}),
    ...(activity.weighted_average_watts != null ? { weightedAverageWatts: activity.weighted_average_watts } : {}),
    ...(activity.kilojoules != null ? { kilojoules: activity.kilojoules } : {}),
    ...(activity.has_heartrate != null ? { hasHeartrate: activity.has_heartrate } : {}),
    ...(activity.pr_count != null ? { prCount: activity.pr_count } : {}),
    ...(gear ? { gear } : {}),
    ...(bestEfforts.length > 0 ? { bestEfforts } : {}),
    ...(segmentEfforts.length > 0 ? { segmentEfforts } : {}),
  };

  const stravaData = {
    ...(activity.distance ? { distance: activity.distance } : {}),
    ...(activity.moving_time ? { time: activity.moving_time } : {}),
    ...(activity.total_elevation_gain ? { elevationGain: Math.round(activity.total_elevation_gain) } : {}),
    ...(activity.average_heartrate ? { avgHeartRate: Math.round(activity.average_heartrate) } : {}),
    ...(activity.max_heartrate ? { maxHeartRate: Math.round(activity.max_heartrate) } : {}),
    ...(activity.average_watts ? { avgPower: Math.round(activity.average_watts) } : {}),
  };

  return { actualStats, routeData, typeData, stravaData, stravaExtended, laps, splits, splitsMetric, splitsStandard, timeMin };
}

/** Apply detailed fields (laps, splits, photos, stravaExtended) to a Firestore write target. */
function applyDetailedFields(target: Record<string, any>, built: WorkoutFields, activity: any) {
  target.stravaDetailsFetched = true;
  if (Object.keys(built.stravaExtended).length > 0) target.stravaExtended = built.stravaExtended;
  if (built.laps.length > 0) target.laps = built.laps;
  if (built.splits.length > 0) target.splits = built.splits;
  if (built.splitsMetric.length > 0) target.splitsMetric = built.splitsMetric;
  if (built.splitsStandard.length > 0) target.splitsStandard = built.splitsStandard;
  // Photos are passed via the activity's fetched photos array stored on the built object
  // but photos are fetched separately and passed to the caller — check activity-level flag
  if (activity.total_photo_count > 0) target.hasStravaPhotos = true;
}

// Process a new Strava activity - CLEAN VERSION
async function processActivity(
  stravaAthleteId: string,
  stravaActivityId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`\n🏃 Processing Strava activity ${stravaActivityId} for athlete ${stravaAthleteId}`);

    // Find user by Strava ID
    const usersSnapshot = await adminDb
      .collection('users')
      .where('stravaId', '==', stravaAthleteId)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return { success: false, message: `No user found with Strava ID ${stravaAthleteId}` };
    }

    const userDoc = usersSnapshot.docs[0];
    const username = userDoc.id;
    const userData = userDoc.data();

    console.log(`👤 Found user: ${userData.displayName} (${username})`);

    const workoutsCollection = adminDb.collection('users').doc(username).collection('workouts');
    const existingByStravaIdSnapshot = await workoutsCollection
      .where('stravaActivityId', '==', String(stravaActivityId))
      .get();

    const existingByStravaIdDocs = existingByStravaIdSnapshot.docs;
    const standaloneId = `strava_${stravaActivityId}`;

    // TRIPLE CHECK: Check if ANY workout for this user was created in last 60 seconds
    // This catches rapid duplicate webhooks
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const recentWorkouts = await adminDb
      .collection('users').doc(username).collection('workouts')
      .where('source', '==', 'strava')
      .where('createdAt', '>', admin.firestore.Timestamp.fromDate(sixtySecondsAgo))
      .get();

    if (!recentWorkouts.empty) {
      console.log(`⚠️ Found ${recentWorkouts.size} Strava workouts created in last 60 seconds`);
    }

    // Get access token
    const accessToken = await getAccessToken(username, userData);
    if (!accessToken) {
      return { success: false, message: 'Failed to get access token' };
    }

    // Fetch activity details
    const activity = await fetchActivityDetails(stravaActivityId, accessToken);
    if (!activity) {
      return { success: false, message: 'Failed to fetch activity details' };
    }

    const [photos, gearRaw] = await Promise.all([
      fetchActivityPhotos(stravaActivityId, accessToken),
      fetchGearDetails(activity.gear_id, accessToken),
    ]);

    const workoutType = mapStravaType(activity.type);
    // Use start_date_local to avoid timezone offset bugs (e.g. IST users shifted by 5.5h)
    const activityDate = new Date(activity.start_date_local || activity.start_date);

    console.log(`📅 Activity: ${activity.name} (${activity.type} → ${workoutType}) on ${activityDate.toISOString()}`);

    // FINAL CHECK: Current-day duplicate detection only (webhook path).
    // Restricts reads to the activity day instead of broad/rolling windows.
    const duplicateDayStart = new Date(activityDate);
    duplicateDayStart.setHours(0, 0, 0, 0);
    const duplicateDayEnd = new Date(activityDate);
    duplicateDayEnd.setHours(23, 59, 59, 999);

    const proximityCheck = await adminDb
      .collection('users').doc(username).collection('workouts')
      .where('type', '==', workoutType)
      .where('source', '==', 'strava')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(duplicateDayStart))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(duplicateDayEnd))
      .get();

    if (existingByStravaIdDocs.length === 0 && !proximityCheck.empty) {
      for (const doc of proximityCheck.docs) {
        const data = doc.data();
        // Check duration proximity (within 10 minutes / 600 seconds)
        const existingDur = data.actualStats?.duration || (data.duration || 0) * 60;
        const newDur = activity.moving_time || 0;
        const durationClose = existingDur > 0 && newDur > 0 && Math.abs(existingDur - newDur) < 600;
        // Check distance proximity (within 5%)
        const existingDist = data.actualStats?.distance || 0;
        const newDist = activity.distance || 0;
        const distanceClose = existingDist > 0 && newDist > 0 && Math.abs(existingDist - newDist) / Math.max(existingDist, newDist) < 0.05;
        
        if (durationClose && distanceClose) {
          console.log(`🛑 PROXIMITY DUPLICATE: "${activity.name}" ~= "${data.name}" (${doc.id}) — dur diff: ${Math.abs(existingDur - newDur)}s, dist diff: ${Math.abs(existingDist - newDist)}m — SKIPPING`);
          return { success: true, message: 'Duplicate prevented (proximity match)' };
        }
      }
    }

    // Build all workout fields from Strava activity data
    const built = buildWorkoutFields(activity, workoutType, photos, gearRaw);
    const { actualStats, routeData, typeData, stravaData, timeMin } = built;

    // TRY TO MATCH with an existing planned workout on the same day
    const dayStart = new Date(activityDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(activityDate);
    dayEnd.setHours(23, 59, 59, 999);

    const plannedSnapshot = await workoutsCollection
      .where('type', '==', workoutType)
      .where('completed', '==', false)
      .get();

    // Find a planned workout on the same day (not from Strava)
    let matchedDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    for (const doc of plannedSnapshot.docs) {
      const data = doc.data();
      if (data.source === 'strava') continue;
      const workoutDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
      if (workoutDate >= dayStart && workoutDate <= dayEnd) {
        matchedDoc = doc;
        break;
      }
    }

    if (matchedDoc) {
      // MATCH FOUND — update the planned workout with Strava data
      console.log(`🔗 Matched Strava activity with planned workout: ${matchedDoc.data().name} (${matchedDoc.id})`);

      const mergeData: any = {
        completed: true,
        completedAt: admin.firestore.Timestamp.fromDate(activityDate),
        completedBy: 'strava',
        stravaActivityId: stravaActivityId,
        actualStats,
        duration: timeMin,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...typeData,
      };

      // Add route data if available
      if (Object.keys(routeData).length > 0) {
        mergeData.routeData = routeData;
      }

      mergeData.stravaData = stravaData;
      applyDetailedFields(mergeData, built, activity);
      if (photos.length > 0) mergeData.photos = photos;

      const batch = adminDb.batch();
      batch.update(matchedDoc.ref, mergeData);

      for (const existingDoc of existingByStravaIdDocs) {
        if (existingDoc.id !== matchedDoc.id) {
          batch.delete(existingDoc.ref);
        }
      }

      await batch.commit();
      console.log(`✅ Merged Strava data into planned workout ${matchedDoc.id}`);

      return {
        success: true,
        message: `Matched "${activity.name}" with planned workout "${matchedDoc.data().name}"`
      };
    }

    // CHECK FOR MATCHING IMPORTED (CSV/XLSX) WORKOUT — same day, type, near distance
    try {
      const importedSnapshot = await workoutsCollection
        .where('type', '==', workoutType)
        .where('source', '==', 'import')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(dayStart))
        .where('date', '<=', admin.firestore.Timestamp.fromDate(dayEnd))
        .get();

      for (const iDoc of importedSnapshot.docs) {
        const iData = iDoc.data();
        if (iData.stravaActivityId) continue; // already merged

        const iDist = iData.actualStats?.distance || 0;
        const aDist = activity.distance || 0;

        // Match if distance within 10%, or both have no distance (e.g. strength)
        const distMatch = (aDist > 0 && iDist > 0 && Math.abs(aDist - iDist) / Math.max(aDist, iDist) < 0.10)
          || (aDist === 0 && iDist === 0);

        if (distMatch) {
          console.log(`📎 Merging Strava activity with imported workout: ${iData.name} (${iDoc.id})`);
          const mergeUpdate: any = {
            stravaActivityId,
            actualStats,
            source: 'strava',
            completedBy: 'strava',
            completedAt: admin.firestore.Timestamp.fromDate(activityDate),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...typeData,
          };
          if (Object.keys(routeData).length > 0) mergeUpdate.routeData = routeData;
          mergeUpdate.stravaData = stravaData;
          applyDetailedFields(mergeUpdate, built, activity);
          if (photos.length > 0) mergeUpdate.photos = photos;
          const batch = adminDb.batch();
          batch.update(iDoc.ref, mergeUpdate);
          for (const existingDoc of existingByStravaIdDocs) {
            if (existingDoc.id !== iDoc.id) {
              batch.delete(existingDoc.ref);
            }
          }
          await batch.commit();
          return {
            success: true,
            message: `Merged "${activity.name}" with imported workout "${iData.name}"`
          };
        }
      }
    } catch (e: any) {
      console.log(`⚠️ Import merge check failed (non-fatal): ${e.message}`);
    }

    const newWorkoutData: any = {
      name: activity.name,
      type: workoutType,
      description: activity.description?.trim()
        ? activity.description.trim()
        : `Imported from Strava\nDistance: ${((activity.distance || 0) / 1000).toFixed(2)} km\nMoving time: ${timeMin} min`,
      date: admin.firestore.Timestamp.fromDate(activityDate),
      duration: timeMin,
      ownerUsername: username,
      createdBy: username,
      assignedTo: username,
      completed: true,
      completedAt: admin.firestore.Timestamp.fromDate(activityDate),
      completedBy: 'strava',
      stravaActivityId: stravaActivityId,
      actualStats,
      source: 'strava',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...typeData,
    };

    // Add route data if available
    if (Object.keys(routeData).length > 0) {
      newWorkoutData.routeData = routeData;
      console.log(`🗺️ Route data captured: ${routeData.polyline ? 'polyline available' : 'no polyline'}`);
    }

    newWorkoutData.stravaData = stravaData;
    applyDetailedFields(newWorkoutData, built, activity);
    if (photos.length > 0) newWorkoutData.photos = photos;
    // NO MATCH — if this Strava activity already exists anywhere, update canonical and deduplicate.
    if (existingByStravaIdDocs.length > 0) {
      const canonicalDoc =
        existingByStravaIdDocs.find((d) => d.id !== standaloneId) ||
        existingByStravaIdDocs.find((d) => d.id === standaloneId) ||
        existingByStravaIdDocs[0];

      const batch = adminDb.batch();
      if (canonicalDoc.id === standaloneId) {
        batch.set(canonicalDoc.ref, newWorkoutData, { merge: true });
      } else {
        const updateData: any = {
          completed: true,
          completedAt: admin.firestore.Timestamp.fromDate(activityDate),
          completedBy: 'strava',
          stravaActivityId: String(stravaActivityId),
          actualStats,
          stravaData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...typeData,
        };
        if (activity.description?.trim()) updateData.description = activity.description.trim();
        if (Object.keys(routeData).length > 0) updateData.routeData = routeData;
        applyDetailedFields(updateData, built, activity);
        if (photos.length > 0) updateData.photos = photos;
        batch.update(canonicalDoc.ref, updateData);
      }

      for (const existingDoc of existingByStravaIdDocs) {
        if (existingDoc.id !== canonicalDoc.id) {
          batch.delete(existingDoc.ref);
        }
      }
      await batch.commit();

      return {
        success: true,
        message: `Reconciled Strava activity into workout "${canonicalDoc.data().name || activity.name}"`
      };
    }

    // Truly new: create deterministic standalone Strava workout
    const workoutId = standaloneId;
    const newWorkoutRef = workoutsCollection.doc(workoutId);
    await newWorkoutRef.set(newWorkoutData);
    console.log(`✅ Created new workout ${workoutId} from Strava activity (no planned match)`);

    return {
      success: true,
      message: `Created workout "${activity.name}" from Strava`
    };
  } catch (error: any) {
    console.error('❌ Error processing activity:', error);
    return { success: false, message: error.message || 'Unknown error' };
  }
}

async function processActivityUpdate(
  stravaAthleteId: string,
  stravaActivityId: string
): Promise<{ success: boolean; message: string }> {
  console.log(`\n🔄 Processing Strava activity update ${stravaActivityId} for athlete ${stravaAthleteId}`);
  // Reuse the create-path reconciliation logic:
  // it updates existing docs, promotes planned when available, and removes redundant standalone copies.
  return processActivity(stravaAthleteId, stravaActivityId);
}

async function processActivityDelete(
  stravaAthleteId: string,
  stravaActivityId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`\n🗑️ Processing Strava activity delete ${stravaActivityId} for athlete ${stravaAthleteId}`);

    const usersSnapshot = await adminDb
      .collection('users')
      .where('stravaId', '==', stravaAthleteId)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return { success: false, message: `No user found with Strava ID ${stravaAthleteId}` };
    }

    const userDoc = usersSnapshot.docs[0];
    const username = userDoc.id;

    const matches = await adminDb
      .collection('users').doc(username).collection('workouts')
      .where('stravaActivityId', '==', String(stravaActivityId))
      .get();

    if (matches.empty) {
      return { success: true, message: 'No linked workouts found for deleted Strava activity' };
    }

    let deletedCount = 0;
    let unlinkedCount = 0;
    for (const workoutDoc of matches.docs) {
      const data = workoutDoc.data();
      const isStandalone = workoutDoc.id === `strava_${stravaActivityId}`;

      if (isStandalone) {
        await workoutDoc.ref.delete();
        deletedCount++;
        continue;
      }

      const unlinkData: any = {
        stravaActivityId: admin.firestore.FieldValue.delete(),
        actualStats: admin.firestore.FieldValue.delete(),
        stravaData: admin.firestore.FieldValue.delete(),
        routeData: admin.firestore.FieldValue.delete(),
        stravaExtended: admin.firestore.FieldValue.delete(),
        laps: admin.firestore.FieldValue.delete(),
        splits: admin.firestore.FieldValue.delete(),
        splitsMetric: admin.firestore.FieldValue.delete(),
        splitsStandard: admin.firestore.FieldValue.delete(),
        photos: admin.firestore.FieldValue.delete(),
        hasStravaPhotos: admin.firestore.FieldValue.delete(),
        stravaDetailsFetched: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (data.completedBy === 'strava') {
        unlinkData.completed = false;
        unlinkData.completedBy = admin.firestore.FieldValue.delete();
        unlinkData.completedAt = admin.firestore.FieldValue.delete();
      }

      // Prevent orphan "strava" source after unlink.
      if (data.source === 'strava') {
        unlinkData.source = 'manual';
      }

      await workoutDoc.ref.update(unlinkData);
      unlinkedCount++;
    }

    return {
      success: true,
      message: `Strava delete processed: removed ${deletedCount}, unlinked ${unlinkedCount}`
    };
  } catch (error: any) {
    console.error('❌ Error processing activity delete:', error);
    return { success: false, message: error.message || 'Unknown error' };
  }
}

// GET: Webhook verification (Strava sends this when setting up subscription)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('Strava webhook verification request:', { mode, token, challenge });

  // Verify this is a subscription verification request
  if (mode === 'subscribe') {
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

    if (!verifyToken) {
      console.error('STRAVA_WEBHOOK_VERIFY_TOKEN not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    if (token === verifyToken) {
      console.log('Webhook verification successful');
      return NextResponse.json({ 'hub.challenge': challenge });
    } else {
      console.error('Webhook verification failed: token mismatch');
      return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
    }
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

// POST: Handle webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);

    console.log('📨 Strava webhook event received:', JSON.stringify(event));

    const { object_type, aspect_type, object_id, owner_id } = event;

    // We only care about activity create/update/delete events.
    if (object_type !== 'activity') {
      console.log(`⏭️ Ignoring event: ${object_type}.${aspect_type}`);
      return NextResponse.json({ status: 'ignored' });
    }

    if (!['create', 'update', 'delete'].includes(aspect_type)) {
      console.log(`⏭️ Ignoring activity aspect: ${aspect_type}`);
      return NextResponse.json({ status: 'ignored' });
    }

    const ownerId = String(owner_id);
    const activityId = String(object_id);

    // Return 200 immediately so Strava doesn't timeout.
    // Use waitUntil() to keep the serverless function alive for background processing.
    waitUntil(
      (aspect_type === 'create'
        ? processActivity(ownerId, activityId)
        : aspect_type === 'update'
          ? processActivityUpdate(ownerId, activityId)
          : processActivityDelete(ownerId, activityId))
        .then(async (result) => {
          console.log('✅ Webhook processing result:', JSON.stringify(result));
          if (result.success) {
            const userSnap = await adminDb.collection('users')
              .where('stravaId', '==', ownerId).limit(1).get();
            if (!userSnap.empty) {
              const username = userSnap.docs[0].id;

              const titleByAspect: Record<string, string> = {
                create: '🏃 New Strava Workout',
                update: '🔄 Strava Workout Updated',
                delete: '🗑️ Strava Workout Removed',
              };

              await sendPushNotification(username, {
                title: titleByAspect[aspect_type] || '🔄 Strava Sync',
                body: result.message || 'A new workout was synced from Strava',
                url: '/workouts',
              }).catch(() => {}); // non-fatal
            }
          }
        })
        .catch(err => console.error('❌ Webhook processing error:', err))
    );

    return NextResponse.json({ status: 'accepted', message: 'Processing in background' });
  } catch (error: any) {
    console.error('❌ Webhook parse error:', error);
    // Still return 200 to prevent Strava from retrying
    return NextResponse.json({ status: 'error', message: error.message });
  }
}
