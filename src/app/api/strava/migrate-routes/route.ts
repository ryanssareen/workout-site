export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

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

    if (!response.ok) return null;

    const data = await response.json();
    
    // Update tokens in Firestore
    await adminDb.collection('users').doc(userId).update({
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token,
      stravaTokenExpiresAt: data.expires_at,
    });

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    console.log(`🗺️ Migrating route data for user: ${userId}`);

    // Get user's Strava credentials
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    if (!userData?.stravaAccessToken) {
      return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
    }

    // Check/refresh token
    let accessToken = userData.stravaAccessToken;
    const currentTime = Math.floor(Date.now() / 1000);
    const expiresAt = userData.stravaTokenExpiresAt?.toDate
      ? Math.floor(userData.stravaTokenExpiresAt.toDate().getTime() / 1000)
      : userData.stravaTokenExpiresAt;

    if (expiresAt && expiresAt < currentTime) {
      const newToken = await refreshStravaToken(userId, userData.stravaRefreshToken);
      if (!newToken) {
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
      }
      accessToken = newToken;
    }

    // Find all Strava workouts WITHOUT routeData
    const workoutsSnapshot = await adminDb
      .collection('workouts')
      .where('assignedTo', '==', userId)
      .where('source', '==', 'strava')
      .get();

    const workoutsToUpdate = workoutsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.stravaActivityId && !data.routeData?.polyline;
    });

    console.log(`📊 Found ${workoutsToUpdate.length} workouts needing route data`);

    let updated = 0;
    let failed = 0;

    for (const workoutDoc of workoutsToUpdate) {
      const workout = workoutDoc.data();
      const activityId = workout.stravaActivityId;

      try {
        // Fetch activity details from Strava
        const response = await fetch(
          `https://www.strava.com/api/v3/activities/${activityId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
          console.log(`❌ Failed to fetch activity ${activityId}: ${response.status}`);
          failed++;
          continue;
        }

        const activity = await response.json();

        // Extract route data
        const routeData: any = {};
        if (activity.map?.summary_polyline) {
          routeData.polyline = activity.map.summary_polyline;
        }
        if (activity.start_latlng) {
          routeData.startLatLng = activity.start_latlng;
        }
        if (activity.end_latlng) {
          routeData.endLatLng = activity.end_latlng;
        }

        if (routeData.polyline) {
          await adminDb.collection('workouts').doc(workoutDoc.id).update({
            routeData,
          });
          console.log(`✅ Updated: ${workout.name}`);
          updated++;
        } else {
          console.log(`⚠️ No polyline for: ${workout.name}`);
        }

        // Rate limit: Strava allows 100 requests per 15 min
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error updating ${workout.name}:`, error);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      total: workoutsToUpdate.length,
      updated,
      failed,
      message: `Updated ${updated} workouts with route data`,
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
