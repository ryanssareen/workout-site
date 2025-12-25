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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get user's Strava credentials
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.stravaAccessToken) {
      return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
    }

    // Check if token is expired and refresh if needed
    let accessToken = userData.stravaAccessToken;
    const currentTime = Math.floor(Date.now() / 1000);

    if (userData.stravaTokenExpiresAt && userData.stravaTokenExpiresAt < currentTime) {
      const newToken = await refreshStravaToken(userId, userData.stravaRefreshToken);
      if (!newToken) {
        return NextResponse.json({ error: 'Failed to refresh Strava token' }, { status: 401 });
      }
      accessToken = newToken;
    }

    // Fetch recent activities from Strava (last 30 days)
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${thirtyDaysAgo}&per_page=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!activitiesResponse.ok) {
      const errorData = await activitiesResponse.json();
      console.error('Strava API error:', errorData);
      return NextResponse.json({ error: 'Failed to fetch Strava activities' }, { status: 500 });
    }

    const activities = await activitiesResponse.json();

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

    // Create workouts for new activities and delete old incomplete ones
    const batch = adminDb.batch();
    let newWorkoutsCount = 0;
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

      // CREATE NEW WORKOUT
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
      console.log(`✅ Queued workout: ${activity.name} (${workoutType}) on ${activityDate.toDateString()}`);
    }

    if (newWorkoutsCount > 0) {
      await batch.commit();
      console.log(`✅ Created ${newWorkoutsCount} new workouts from Strava`);
    }

    // DELETE old incomplete workouts that might match these new ones
    // (within ±2 days of each new activity)
    let deletedCount = 0;
    for (const activity of activitiesToProcess) {
      const activityDate = new Date(activity.start_date_local);
      const workoutType = mapStravaType(activity.type);
      
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
        const deleteBatch = adminDb.batch();
        oldWorkoutsSnapshot.docs.forEach(doc => {
          // Filter out Strava imports in code (avoid complex Firestore query)
          if (doc.data().source === 'strava') {
            console.log(`⏭️ Skipping Strava workout: ${doc.data().name}`);
            return;
          }
          
          console.log(`🗑️ Deleting old workout: ${doc.data().name} (${doc.id})`);
          deleteBatch.delete(doc.ref);
          deletedCount++;
        });
        
        if (deletedCount > 0) {
          await deleteBatch.commit();
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ Deleted ${deletedCount} old incomplete workouts`);
    }

    // Redirect back to settings or return JSON based on request type
    const acceptHeader = request.headers.get('accept');
    if (acceptHeader?.includes('text/html')) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      return NextResponse.redirect(
        new URL(`/settings?synced=${newWorkoutsCount}`, baseUrl)
      );
    }

    return NextResponse.json({
      success: true,
      newWorkouts: newWorkoutsCount,
      deletedWorkouts: deletedCount,
      totalActivities: activities.length,
      message: `Created ${newWorkoutsCount} new workouts${deletedCount > 0 ? ` and deleted ${deletedCount} old incomplete workouts` : ''}`,
    });
  } catch (error: any) {
    console.error('Strava sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync Strava activities' },
      { status: 500 }
    );
  }
}
