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

    // Create workouts for new activities
    const batch = adminDb.batch();
    let newWorkoutsCount = 0;

    for (const activity of activities) {
      // Skip if we already have this activity
      if (existingStravaIds.has(String(activity.id))) {
        continue;
      }

      const workoutRef = adminDb.collection('workouts').doc();
      const workoutData = {
        name: activity.name,
        type: mapStravaType(activity.type),
        description: `Imported from Strava. Distance: ${(activity.distance / 1000).toFixed(2)} km`,
        date: admin.firestore.Timestamp.fromDate(new Date(activity.start_date)),
        duration: Math.round(activity.moving_time / 60), // Convert seconds to minutes
        createdBy: userId,
        assignedTo: userId,
        completed: true, // Strava activities are always completed
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'strava',
        stravaActivityId: String(activity.id),
      };

      batch.set(workoutRef, workoutData);
      newWorkoutsCount++;
    }

    if (newWorkoutsCount > 0) {
      await batch.commit();
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
      totalActivities: activities.length,
    });
  } catch (error: any) {
    console.error('Strava sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync Strava activities' },
      { status: 500 }
    );
  }
}
