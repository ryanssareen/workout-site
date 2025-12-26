export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

// Test endpoint to manually trigger workout matching
// Usage: GET /api/strava/test-match?userId=xxx&activityId=xxx
// Or: POST with body { userId, activityId } or { userId, mockActivity: {...} }

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
  };

  return typeMap[stravaType] || 'strength';
}

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

    if (!response.ok) return null;

    const data = await response.json();

    await adminDb.collection('users').doc(userId).update({
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token,
      stravaTokenExpiresAt: data.expires_at,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

async function getAccessToken(userId: string, userData: any): Promise<string | null> {
  let accessToken = userData.stravaAccessToken;
  const currentTime = Math.floor(Date.now() / 1000);

  if (userData.stravaTokenExpiresAt && userData.stravaTokenExpiresAt < currentTime) {
    const newToken = await refreshStravaToken(userId, userData.stravaRefreshToken);
    if (!newToken) return null;
    accessToken = newToken;
  }

  return accessToken;
}

async function findMatchingWorkout(
  userId: string,
  activityDate: Date,
  activityType: 'swim' | 'run' | 'bike' | 'strength',
  stravaActivityId: string
) {
  const startOfDay = new Date(activityDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(activityDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Check if already linked
  const existingLinkSnapshot = await adminDb
    .collection('workouts')
    .where('stravaActivityId', '==', stravaActivityId)
    .limit(1)
    .get();

  if (!existingLinkSnapshot.empty) {
    return { alreadyLinked: true, workoutId: existingLinkSnapshot.docs[0].id };
  }

  // Find uncompleted workouts for this day
  const workoutsSnapshot = await adminDb
    .collection('workouts')
    .where('assignedTo', '==', userId)
    .where('date', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
    .where('date', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
    .where('completed', '==', false)
    .get();

  if (workoutsSnapshot.empty) {
    return { noWorkouts: true };
  }

  let exactMatch: any = null;
  let fallbackMatch: any = null;

  for (const doc of workoutsSnapshot.docs) {
    const workoutData = doc.data();
    if (workoutData.stravaActivityId) continue;

    if (workoutData.type === activityType) {
      exactMatch = { workoutId: doc.id, workoutData, matchType: 'exact' };
      break;
    } else if (!fallbackMatch) {
      fallbackMatch = { workoutId: doc.id, workoutData, matchType: 'fallback' };
    }
  }

  return exactMatch || fallbackMatch || { noMatch: true };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const activityId = searchParams.get('activityId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    if (!userData?.stravaAccessToken) {
      return NextResponse.json({ error: 'User not connected to Strava' }, { status: 400 });
    }

    // Get access token
    const accessToken = await getAccessToken(userId, userData);
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 401 });
    }

    // Fetch activity or recent activities
    let activity;
    if (activityId) {
      const response = await fetch(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
      }
      activity = await response.json();
    } else {
      // Get most recent activity
      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?per_page=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
      }
      const activities = await response.json();
      if (activities.length === 0) {
        return NextResponse.json({ error: 'No activities found' }, { status: 404 });
      }
      activity = activities[0];

      // Fetch full details
      const detailResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${activity.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (detailResponse.ok) {
        activity = await detailResponse.json();
      }
    }

    const workoutType = mapStravaType(activity.type);
    const activityDate = new Date(activity.start_date_local);

    // Find matching workout
    const match = await findMatchingWorkout(userId, activityDate, workoutType, String(activity.id));

    return NextResponse.json({
      activity: {
        id: activity.id,
        name: activity.name,
        type: activity.type,
        mappedType: workoutType,
        date: activity.start_date_local,
        distance: activity.distance,
        duration: activity.moving_time,
        calories: activity.calories,
        avgHeartRate: activity.average_heartrate,
      },
      match,
      hint: match.noWorkouts
        ? 'No uncompleted workouts found for this date. Create a workout first.'
        : match.alreadyLinked
        ? 'This activity is already linked to a workout.'
        : match.noMatch
        ? 'Found workouts but none matched (all may already have Strava activities linked).'
        : `Found ${match.matchType} match! POST to /api/strava/test-match to complete it.`,
    });
  } catch (error: any) {
    console.error('Test match error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Actually mark the workout as complete
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, activityId, dryRun = false } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    if (!userData?.stravaAccessToken) {
      return NextResponse.json({ error: 'User not connected to Strava' }, { status: 400 });
    }

    // Get access token
    const accessToken = await getAccessToken(userId, userData);
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 401 });
    }

    // Fetch activity
    let activity;
    if (activityId) {
      const response = await fetch(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
      }
      activity = await response.json();
    } else {
      // Get most recent activity
      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?per_page=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const activities = await response.json();
      if (activities.length === 0) {
        return NextResponse.json({ error: 'No activities found' }, { status: 404 });
      }

      const detailResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${activities[0].id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      activity = await detailResponse.json();
    }

    const workoutType = mapStravaType(activity.type);
    const activityDate = new Date(activity.start_date_local);

    // Find matching workout
    const match = await findMatchingWorkout(userId, activityDate, workoutType, String(activity.id));

    if (match.alreadyLinked || match.noWorkouts || match.noMatch) {
      return NextResponse.json({
        success: false,
        activity: { id: activity.id, name: activity.name, type: activity.type },
        match,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        wouldComplete: match.workoutId,
        activity: { id: activity.id, name: activity.name },
      });
    }

    // Mark workout as completed
    const actualStats: Record<string, any> = {};
    if (activity.distance) actualStats.distance = activity.distance;
    if (activity.moving_time) actualStats.duration = activity.moving_time;
    if (activity.calories) actualStats.calories = activity.calories;
    if (activity.average_heartrate) actualStats.avgHeartRate = activity.average_heartrate;
    if (activity.max_heartrate) actualStats.maxHeartRate = activity.max_heartrate;
    if (activity.average_speed) actualStats.avgSpeed = activity.average_speed;
    if (activity.max_speed) actualStats.maxSpeed = activity.max_speed;
    if (activity.total_elevation_gain) actualStats.elevationGain = activity.total_elevation_gain;

    await adminDb.collection('workouts').doc(match.workoutId).update({
      completed: true,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completionStatus: 'completed',
      stravaActivityId: String(activity.id),
      actualStats,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      completedWorkout: match.workoutId,
      activity: {
        id: activity.id,
        name: activity.name,
        type: activity.type,
      },
      stats: actualStats,
    });
  } catch (error: any) {
    console.error('Test match POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
