export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

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
    'Swim': 'swim',
    'WeightTraining': 'strength',
    'Workout': 'strength',
    'CrossFit': 'strength',
    'Yoga': 'strength',
  };

  return typeMap[stravaType] || 'strength';
}

// Helper to get start and end of a day for date matching
function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
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

    // Update tokens in Firestore
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

// Find a matching coach-assigned workout for the given activity
async function findMatchingWorkout(
  userId: string,
  workoutType: string,
  activityDate: Date
): Promise<{ id: string; data: any } | null> {
  const { start, end } = getDayBounds(activityDate);

  // Query for workouts assigned to this user, same type, same day
  // that are NOT from Strava and NOT completed
  const workoutsSnapshot = await adminDb
    .collection('workouts')
    .where('assignedTo', '==', userId)
    .where('type', '==', workoutType)
    .where('completed', '==', false)
    .get();

  // Filter by date (same calendar day) and source (not strava)
  for (const doc of workoutsSnapshot.docs) {
    const data = doc.data();
    
    // Skip if it's a Strava import
    if (data.source === 'strava') continue;
    
    // Check if workout date is on the same day as the activity
    const workoutDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
    if (workoutDate >= start && workoutDate <= end) {
      console.log(`🔗 Found matching workout: ${data.name} (${doc.id})`);
      return { id: doc.id, data };
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Strava sync requested');
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      console.error('❌ No userId provided');
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`👤 Syncing for user: ${userId}`);

    // Get user's Strava credentials
    const userDoc = await adminDb.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.error('❌ User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userData = userDoc.data();

    if (!userData?.stravaAccessToken) {
      console.error('❌ Strava not connected');
      return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
    }

    console.log('✅ User has Strava connected');

    // Check if token is expired and refresh if needed
    let accessToken = userData.stravaAccessToken;
    const currentTime = Math.floor(Date.now() / 1000);

    if (userData.stravaTokenExpiresAt && userData.stravaTokenExpiresAt < currentTime) {
      console.log('🔄 Token expired, refreshing...');
      const newToken = await refreshStravaToken(userId, userData.stravaRefreshToken);
      if (!newToken) {
        console.error('❌ Failed to refresh token');
        return NextResponse.json({ error: 'Failed to refresh Strava token' }, { status: 401 });
      }
      accessToken = newToken;
      console.log('✅ Token refreshed');
    }

    // Fetch recent activities from Strava (last 30 days)
    console.log('📡 Fetching activities from Strava...');
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${thirtyDaysAgo}&per_page=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!activitiesResponse.ok) {
      const errorData = await activitiesResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('❌ Strava API error:', errorData);
      return NextResponse.json({ error: 'Failed to fetch Strava activities: ' + (errorData.message || 'Unknown error') }, { status: 500 });
    }

    const activities = await activitiesResponse.json();
    console.log(`✅ Fetched ${activities.length} activities from Strava`);

    // Get existing Strava workout IDs to avoid duplicates
    const existingWorkoutsSnapshot = await adminDb
      .collection('workouts')
      .where('assignedTo', '==', userId)
      .where('source', '==', 'strava')
      .get();

    const existingStravaIds = new Set(
      existingWorkoutsSnapshot.docs.map(doc => doc.data().stravaActivityId)
    );

    console.log(`📊 Found ${existingStravaIds.size} existing Strava workouts`);

    // Process activities
    const batch = adminDb.batch();
    let newWorkoutsCount = 0;
    let mergedWorkoutsCount = 0;
    const activitiesToProcess: any[] = [];

    for (const activity of activities) {
      // Skip if we already have this activity
      if (existingStravaIds.has(String(activity.id))) {
        console.log(`⏭️ Skipping activity ${activity.id} - already imported`);
        continue;
      }

      activitiesToProcess.push(activity);
    }

    console.log(`🆕 Processing ${activitiesToProcess.length} new activities`);

    for (const activity of activitiesToProcess) {
      const activityDate = new Date(activity.start_date_local);
      const workoutType = mapStravaType(activity.type);

      // Prepare stats from Strava
      const actualStats: any = {};
      if (activity.distance) actualStats.distance = activity.distance;
      if (activity.moving_time) actualStats.duration = activity.moving_time;
      if (activity.calories) actualStats.calories = activity.calories;
      if (activity.average_heartrate) actualStats.avgHeartRate = activity.average_heartrate;
      if (activity.max_heartrate) actualStats.maxHeartRate = activity.max_heartrate;
      if (activity.average_speed) actualStats.avgSpeed = activity.average_speed;
      if (activity.max_speed) actualStats.maxSpeed = activity.max_speed;
      if (activity.total_elevation_gain) actualStats.elevationGain = activity.total_elevation_gain;

      // Try to find a matching coach-assigned workout
      const matchingWorkout = await findMatchingWorkout(userId, workoutType, activityDate);

      if (matchingWorkout) {
        // MERGE: Update existing workout with Strava data
        console.log(`🔗 Merging Strava activity "${activity.name}" with existing workout "${matchingWorkout.data.name}"`);
        
        const workoutRef = adminDb.collection('workouts').doc(matchingWorkout.id);
        batch.update(workoutRef, {
          completed: true,
          completedAt: admin.firestore.Timestamp.fromDate(activityDate),
          completedBy: 'strava',
          stravaActivityId: String(activity.id),
          actualStats,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          // Keep original name, description, createdBy from coach
        });
        mergedWorkoutsCount++;
      } else {
        // CREATE: New workout from Strava
        console.log(`➕ Creating new workout from Strava: ${activity.name}`);
        
        const workoutRef = adminDb.collection('workouts').doc();
        const workoutData = {
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
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          source: 'strava',
          stravaActivityId: String(activity.id),
          actualStats,
        };

        batch.set(workoutRef, workoutData);
        newWorkoutsCount++;
      }
    }

    // Commit all changes
    if (newWorkoutsCount > 0 || mergedWorkoutsCount > 0) {
      await batch.commit();
      console.log(`✅ Created ${newWorkoutsCount} new workouts, merged ${mergedWorkoutsCount} existing workouts`);
    }

    // Build response message
    let message = '';
    if (mergedWorkoutsCount > 0 && newWorkoutsCount > 0) {
      message = `Merged ${mergedWorkoutsCount} workout${mergedWorkoutsCount > 1 ? 's' : ''} and created ${newWorkoutsCount} new`;
    } else if (mergedWorkoutsCount > 0) {
      message = `Merged ${mergedWorkoutsCount} workout${mergedWorkoutsCount > 1 ? 's' : ''} with Strava data`;
    } else if (newWorkoutsCount > 0) {
      message = `Created ${newWorkoutsCount} new workout${newWorkoutsCount > 1 ? 's' : ''} from Strava`;
    } else {
      message = 'No new activities to sync';
    }

    // Redirect back to settings or return JSON based on request type
    const acceptHeader = request.headers.get('accept');
    if (acceptHeader?.includes('text/html')) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      return NextResponse.redirect(
        new URL(`/settings?synced=${newWorkoutsCount}&merged=${mergedWorkoutsCount}`, baseUrl)
      );
    }

    return NextResponse.json({
      success: true,
      newWorkouts: newWorkoutsCount,
      mergedWorkouts: mergedWorkoutsCount,
      totalActivities: activities.length,
      message,
    });
  } catch (error: any) {
    console.error('Strava sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync Strava activities' },
      { status: 500 }
    );
  }
}
