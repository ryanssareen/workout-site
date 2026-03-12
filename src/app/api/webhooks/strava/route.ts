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

    // Check if we already imported this activity (STRICT CHECK)
    const existingWorkout = await adminDb
      .collection('users').doc(username).collection('workouts')
      .where('stravaActivityId', '==', stravaActivityId)
      .limit(1)
      .get();

    if (!existingWorkout.empty) {
      console.log(`✅ Activity ${stravaActivityId} already imported as workout ${existingWorkout.docs[0].id} - SKIPPING`);
      return { success: true, message: 'Activity already imported (duplicate prevented)' };
    }

    // DOUBLE CHECK: Also check by activity ID string conversion
    const existingWorkout2 = await adminDb
      .collection('users').doc(username).collection('workouts')
      .where('stravaActivityId', '==', String(stravaActivityId))
      .limit(1)
      .get();

    if (!existingWorkout2.empty) {
      console.log(`✅ Activity ${stravaActivityId} already imported (string check) - SKIPPING`);
      return { success: true, message: 'Activity already imported (duplicate prevented)' };
    }

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

    const workoutType = mapStravaType(activity.type);
    const activityDate = new Date(activity.start_date);
    
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

    if (!proximityCheck.empty) {
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

    // Prepare stats
    const actualStats: any = {};
    if (activity.distance) actualStats.distance = activity.distance;
    if (activity.moving_time) actualStats.duration = activity.moving_time;
    if (activity.calories) actualStats.calories = activity.calories;
    if (activity.average_heartrate) actualStats.avgHeartRate = activity.average_heartrate;
    if (activity.max_heartrate) actualStats.maxHeartRate = activity.max_heartrate;
    if (activity.average_speed) actualStats.avgSpeed = activity.average_speed;
    if (activity.max_speed) actualStats.maxSpeed = activity.max_speed;
    if (activity.total_elevation_gain) actualStats.elevationGain = activity.total_elevation_gain;

    // Capture route/map data
    const routeData: any = {};
    if (activity.map?.summary_polyline) routeData.polyline = activity.map.summary_polyline;
    if (activity.start_latlng) routeData.startLatLng = activity.start_latlng;
    if (activity.end_latlng) routeData.endLatLng = activity.end_latlng;

    // Build type-specific sub-objects from Strava data
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

    // TRY TO MATCH with an existing planned workout on the same day
    const dayStart = new Date(activityDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(activityDate);
    dayEnd.setHours(23, 59, 59, 999);

    const plannedSnapshot = await adminDb
      .collection('users').doc(username).collection('workouts')
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

      // Add Strava stats under stravaData for detail panel
      mergeData.stravaData = {
        ...(activity.distance ? { distance: activity.distance } : {}),
        ...(activity.moving_time ? { time: activity.moving_time } : {}),
        ...(activity.total_elevation_gain ? { elevationGain: Math.round(activity.total_elevation_gain) } : {}),
        ...(activity.average_heartrate ? { avgHeartRate: Math.round(activity.average_heartrate) } : {}),
        ...(activity.max_heartrate ? { maxHeartRate: Math.round(activity.max_heartrate) } : {}),
        ...(activity.average_watts ? { avgPower: Math.round(activity.average_watts) } : {}),
      };

      await matchedDoc.ref.update(mergeData);
      console.log(`✅ Merged Strava data into planned workout ${matchedDoc.id}`);

      return {
        success: true,
        message: `Matched "${activity.name}" with planned workout "${matchedDoc.data().name}"`
      };
    }

    // CHECK FOR MATCHING IMPORTED (CSV/XLSX) WORKOUT — same day, type, near distance
    try {
      const importedSnapshot = await adminDb
        .collection('users').doc(username).collection('workouts')
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
          mergeUpdate.stravaData = {
            ...(activity.distance ? { distance: activity.distance } : {}),
            ...(activity.moving_time ? { time: activity.moving_time } : {}),
            ...(activity.total_elevation_gain ? { elevationGain: Math.round(activity.total_elevation_gain) } : {}),
            ...(activity.average_heartrate ? { avgHeartRate: Math.round(activity.average_heartrate) } : {}),
            ...(activity.max_heartrate ? { maxHeartRate: Math.round(activity.max_heartrate) } : {}),
            ...(activity.average_watts ? { avgPower: Math.round(activity.average_watts) } : {}),
          };
          await iDoc.ref.update(mergeUpdate);
          return {
            success: true,
            message: `Merged "${activity.name}" with imported workout "${iData.name}"`
          };
        }
      }
    } catch (e: any) {
      console.log(`⚠️ Import merge check failed (non-fatal): ${e.message}`);
    }

    // NO MATCH — create a new Strava workout entry
    // Use deterministic doc ID to prevent duplicates from concurrent webhook retries
    const workoutId = `strava_${stravaActivityId}`;
    const newWorkoutRef = adminDb.collection('users').doc(username).collection('workouts').doc(workoutId);

    const newWorkoutData: any = {
      name: activity.name,
      type: workoutType,
      description: `Imported from Strava\nDistance: ${((activity.distance || 0) / 1000).toFixed(2)} km\nMoving time: ${timeMin} min`,
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

    // Add Strava stats
    newWorkoutData.stravaData = {
      ...(activity.distance ? { distance: activity.distance } : {}),
      ...(activity.moving_time ? { time: activity.moving_time } : {}),
      ...(activity.total_elevation_gain ? { elevationGain: Math.round(activity.total_elevation_gain) } : {}),
      ...(activity.average_heartrate ? { avgHeartRate: Math.round(activity.average_heartrate) } : {}),
      ...(activity.max_heartrate ? { maxHeartRate: Math.round(activity.max_heartrate) } : {}),
      ...(activity.average_watts ? { avgPower: Math.round(activity.average_watts) } : {}),
    };

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

    // We only care about new activities
    if (object_type !== 'activity' || aspect_type !== 'create') {
      console.log(`⏭️ Ignoring event: ${object_type}.${aspect_type}`);
      return NextResponse.json({ status: 'ignored' });
    }

    // Return 200 immediately so Strava doesn't timeout.
    // Use waitUntil() to keep the serverless function alive for background processing.
    waitUntil(
      processActivity(String(owner_id), String(object_id))
        .then(async (result) => {
          console.log('✅ Webhook processing result:', JSON.stringify(result));
          if (result.success) {
            const userSnap = await adminDb.collection('users')
              .where('stravaId', '==', String(owner_id)).limit(1).get();
            if (!userSnap.empty) {
              const username = userSnap.docs[0].id;

              // Send push notification for new Strava workout
              await sendPushNotification(username, {
                title: '🏃 New Strava Workout',
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
