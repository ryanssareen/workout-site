import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import crypto from 'crypto';

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
    console.warn('STRAVA_WEBHOOK_VERIFY_TOKEN not set, skipping signature verification');
    return true;
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

  if (userData.stravaTokenExpiresAt && userData.stravaTokenExpiresAt < currentTime) {
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

// Find matching workout for the activity
async function findMatchingWorkout(
  userId: string,
  activityDate: Date,
  activityType: 'swim' | 'run' | 'bike' | 'strength',
  stravaActivityId: string
): Promise<{ workoutId: string; workoutData: any } | null> {
  // FLEXIBLE MATCHING: Check ±1 day from activity date  
  const dayBefore = new Date(activityDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(0, 0, 0, 0);

  const dayAfter = new Date(activityDate);
  dayAfter.setDate(dayAfter.getDate() + 1);
  dayAfter.setHours(23, 59, 59, 999);

  console.log(`🔍 Looking for workouts between ${dayBefore.toISOString()} and ${dayAfter.toISOString()}`);

  // Check if this activity has already been linked to a workout
  const existingLinkSnapshot = await adminDb
    .collection('workouts')
    .where('stravaActivityId', '==', stravaActivityId)
    .limit(1)
    .get();

  if (!existingLinkSnapshot.empty) {
    console.log(`✅ Activity ${stravaActivityId} already linked to workout ${existingLinkSnapshot.docs[0].id}`);
    return null;
  }

  // Find workouts for this user within date range that are not yet completed
  const workoutsSnapshot = await adminDb
    .collection('workouts')
    .where('assignedTo', '==', userId)
    .where('date', '>=', admin.firestore.Timestamp.fromDate(dayBefore))
    .where('date', '<=', admin.firestore.Timestamp.fromDate(dayAfter))
    .where('completed', '==', false)
    .get();

  console.log(`📊 Found ${workoutsSnapshot.size} uncompleted workouts in date range`);

  if (workoutsSnapshot.empty) {
    console.log(`⚠️ No uncompleted workouts found for user ${userId}`);
    return null;
  }

  // Priority: exact type match, then any unmatched workout
  let exactMatch: { workoutId: string; workoutData: any } | null = null;
  let fallbackMatch: { workoutId: string; workoutData: any } | null = null;

  for (const doc of workoutsSnapshot.docs) {
    const workoutData = doc.data();

    // Skip workouts that already have a Strava activity linked
    if (workoutData.stravaActivityId) {
      console.log(`⏭️ Skipping workout ${doc.id} - already linked to Strava`);
      continue;
    }

    console.log(`🔎 Checking workout ${doc.id}: ${workoutData.name} (${workoutData.type})`);

    if (workoutData.type === activityType) {
      exactMatch = { workoutId: doc.id, workoutData };
      console.log(`✅ EXACT MATCH: Workout ${doc.id} matches activity type ${activityType}`);
      break; // Exact match found, use it
    } else if (!fallbackMatch) {
      fallbackMatch = { workoutId: doc.id, workoutData };
      console.log(`🔄 FALLBACK: Workout ${doc.id} is type ${workoutData.type} (activity is ${activityType})`);
    }
  }

  const result = exactMatch || fallbackMatch;
  if (result) {
    console.log(`🎯 SELECTED: Workout ${result.workoutId} (${exactMatch ? 'exact match' : 'fallback match'})`);
  } else {
    console.log(`❌ No suitable workout found`);
  }

  return result;
}

// Mark workout as completed with Strava data
async function markWorkoutCompleted(
  workoutId: string,
  stravaActivityId: string,
  activity: any
): Promise<void> {
  const actualStats = {
    distance: activity.distance || undefined,
    duration: activity.moving_time || undefined,
    calories: activity.calories || undefined,
    avgHeartRate: activity.average_heartrate || undefined,
    maxHeartRate: activity.max_heartrate || undefined,
    avgSpeed: activity.average_speed || undefined,
    maxSpeed: activity.max_speed || undefined,
    elevationGain: activity.total_elevation_gain || undefined,
  };

  // Remove undefined values
  Object.keys(actualStats).forEach(key => {
    if (actualStats[key as keyof typeof actualStats] === undefined) {
      delete actualStats[key as keyof typeof actualStats];
    }
  });

  await adminDb.collection('workouts').doc(workoutId).update({
    completed: true,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    completedBy: 'strava', // This makes it show "via Strava" in UI
    stravaActivityId,
    actualStats,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Workout ${workoutId} marked as completed with Strava activity ${stravaActivityId}`);
}

// Process a new Strava activity - SIMPLE APPROACH
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
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log(`👤 Found user: ${userData.displayName} (${userId})`);

    // Get access token
    const accessToken = await getAccessToken(userId, userData);
    if (!accessToken) {
      return { success: false, message: 'Failed to get access token' };
    }

    // Fetch activity details
    const activity = await fetchActivityDetails(stravaActivityId, accessToken);
    if (!activity) {
      return { success: false, message: 'Failed to fetch activity details' };
    }

    const workoutType = mapStravaType(activity.type);
    const activityDate = new Date(activity.start_date_local);
    
    console.log(`📅 Activity: ${activity.name} (${activity.type} → ${workoutType}) on ${activityDate.toISOString()}`);

    // Prepare stats BEFORE transaction
    const actualStats: any = {};
    if (activity.distance) actualStats.distance = activity.distance;
    if (activity.moving_time) actualStats.duration = activity.moving_time;
    if (activity.calories) actualStats.calories = activity.calories;
    if (activity.average_heartrate) actualStats.avgHeartRate = activity.average_heartrate;
    if (activity.max_heartrate) actualStats.maxHeartRate = activity.max_heartrate;
    if (activity.average_speed) actualStats.avgSpeed = activity.average_speed;
    if (activity.max_speed) actualStats.maxSpeed = activity.max_speed;
    if (activity.total_elevation_gain) actualStats.elevationGain = activity.total_elevation_gain;

    // TRIPLE CHECK: Use a transaction to prevent race conditions
    let workoutId: string | null = null;
    
    try {
      await adminDb.runTransaction(async (transaction) => {
        // Check one more time inside transaction
        const existingCheck = await adminDb
          .collection('workouts')
          .where('stravaActivityId', '==', stravaActivityId)
          .limit(1)
          .get();

        if (!existingCheck.empty) {
          console.log(`⚠️ Race condition detected! Activity ${stravaActivityId} already being processed - ABORTING`);
          throw new Error('Already processing');
        }

        // Create the workout inside transaction
        const newWorkoutRef = adminDb.collection('workouts').doc();
        workoutId = newWorkoutRef.id;

    // Check if we already imported this activity (STRICT CHECK)
    const existingWorkout = await adminDb
      .collection('workouts')
      .where('stravaActivityId', '==', stravaActivityId)
      .limit(1)
      .get();

    if (!existingWorkout.empty) {
      console.log(`✅ Activity ${stravaActivityId} already imported as workout ${existingWorkout.docs[0].id} - SKIPPING`);
      return { success: true, message: 'Activity already imported (duplicate prevented)' };
    }

    // DOUBLE CHECK: Also check by activity ID string conversion
    const existingWorkout2 = await adminDb
      .collection('workouts')
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
      .collection('workouts')
      .where('assignedTo', '==', userId)
      .where('source', '==', 'strava')
      .where('createdAt', '>', admin.firestore.Timestamp.fromDate(sixtySecondsAgo))
      .get();

    if (!recentWorkouts.empty) {
      console.log(`⚠️ Found ${recentWorkouts.size} Strava workouts created in last 60 seconds - checking for exact match`);
      for (const doc of recentWorkouts.docs) {
        const data = doc.data();
        // Check if it's the exact same activity (same name and date)
        const existingDate = data.date?.toDate?.();
        if (data.name === activity.name && existingDate && 
            Math.abs(existingDate.getTime() - activityDate.getTime()) < 60000) {
          console.log(`🛑 DUPLICATE DETECTED: Same workout created ${Math.round((Date.now() - data.createdAt.toMillis()) / 1000)}s ago - SKIPPING`);
          return { success: true, message: 'Duplicate prevented (recent webhook)' };
        }
      }
    }

        // Create the workout inside transaction
        const newWorkoutRef = adminDb.collection('workouts').doc();
        workoutId = newWorkoutRef.id;

        // Prepare workout data
        const newWorkoutData = {
          name: activity.name,
          type: workoutType,
          description: `Imported from Strava\nDistance: ${(activity.distance / 1000).toFixed(2)} km\nMoving time: ${Math.round(activity.moving_time / 60)} min`,
          date: admin.firestore.Timestamp.fromDate(activityDate),
          duration: Math.round(activity.moving_time / 60),
          createdBy: userId,
          assignedTo: userId,
          completed: true,
          completedAt: admin.firestore.Timestamp.fromDate(activityDate),
          completedBy: 'strava',
          stravaActivityId: stravaActivityId,
          actualStats,
          source: 'strava',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        transaction.set(newWorkoutRef, newWorkoutData);
      });

      console.log(`✅ Transaction successful - created workout ${workoutId}`);
    } catch (error: any) {
      if (error.message === 'Already processing') {
        return { success: true, message: 'Duplicate prevented by transaction' };
      }
      throw error;
    }

    if (!workoutId) {
      return { success: false, message: 'Failed to create workout' };
    }

    console.log(`✅ Created new workout ${workoutId} from Strava activity`);


    // DELETE old incomplete workouts of same type within ±2 days (optional cleanup)
    const twoDaysBefore = new Date(activityDate);
    twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
    const twoDaysAfter = new Date(activityDate);
    twoDaysAfter.setDate(twoDaysAfter.getDate() + 2);

    const oldWorkoutsSnapshot = await adminDb
      .collection('workouts')
      .where('assignedTo', '==', userId)
      .where('type', '==', workoutType)
      .where('completed', '==', false)
      .where('date', '>=', admin.firestore.Timestamp.fromDate(twoDaysBefore))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(twoDaysAfter))
      .get();

    if (!oldWorkoutsSnapshot.empty) {
      console.log(`🗑️ Found ${oldWorkoutsSnapshot.size} workouts to check for deletion`);
      
      const batch = adminDb.batch();
      let deleteCount = 0;
      
      oldWorkoutsSnapshot.docs.forEach(doc => {
        // Filter out Strava imports in code (avoid complex Firestore query)
        if (doc.data().source === 'strava') {
          console.log(`  ⏭️ Skipping Strava workout: ${doc.data().name}`);
          return;
        }
        
        console.log(`  ❌ Deleting old workout: ${doc.data().name} (${doc.id})`);
        batch.delete(doc.ref);
        deleteCount++;
      });
      
      if (deleteCount > 0) {
        await batch.commit();
        console.log(`✅ Deleted ${deleteCount} old workouts`);
      } else {
        console.log(`ℹ️ No workouts to delete (all were Strava imports)`);
      }
    }

    return {
      success: true,
      message: `Created workout "${activity.name}" from Strava${oldWorkoutsSnapshot.size > 0 ? ` and deleted ${oldWorkoutsSnapshot.size} old workout(s)` : ''}`
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

    console.log('Strava webhook event received:', event);

    // Strava sends these event types:
    // - activity: create, update, delete
    // - athlete: update, deauthorize

    const { object_type, aspect_type, object_id, owner_id } = event;

    // We only care about new activities
    if (object_type !== 'activity' || aspect_type !== 'create') {
      console.log(`Ignoring event: ${object_type}.${aspect_type}`);
      return NextResponse.json({ status: 'ignored' });
    }

    // Process the activity asynchronously
    // Return 200 immediately to acknowledge receipt (Strava expects quick response)
    const result = await processActivity(String(owner_id), String(object_id));

    console.log('Activity processing result:', result);

    return NextResponse.json({ status: 'processed', ...result });
  } catch (error: any) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent Strava from retrying
    return NextResponse.json({ status: 'error', message: error.message });
  }
}
