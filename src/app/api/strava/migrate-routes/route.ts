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

async function getValidToken(userData: any, userId: string): Promise<string | null> {
  let accessToken = userData.stravaAccessToken;
  const currentTime = Math.floor(Date.now() / 1000);
  const expiresAt = userData.stravaTokenExpiresAt?.toDate
    ? Math.floor(userData.stravaTokenExpiresAt.toDate().getTime() / 1000)
    : userData.stravaTokenExpiresAt;

  if (expiresAt && expiresAt < currentTime) {
    accessToken = await refreshStravaToken(userId, userData.stravaRefreshToken);
  }
  return accessToken;
}

export async function POST(request: NextRequest) {
  try {
    // Optional: pass a secret to prevent abuse
    const { adminSecret } = await request.json().catch(() => ({}));
    
    // Simple protection - you can change this
    if (adminSecret !== process.env.ADMIN_SECRET && adminSecret !== 'migrate-all-routes') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🗺️ Starting route migration for ALL users...');

    // Get all users with Strava connected
    const usersSnapshot = await adminDb
      .collection('users')
      .where('stravaAccessToken', '!=', null)
      .get();

    console.log(`👥 Found ${usersSnapshot.size} users with Strava connected`);

    const results: any[] = [];
    let totalUpdated = 0;
    let totalFailed = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      console.log(`\n👤 Processing user: ${userData.displayName || userId}`);

      const accessToken = await getValidToken(userData, userId);
      if (!accessToken) {
        console.log(`  ⚠️ Could not get valid token, skipping`);
        results.push({ userId, status: 'token_error', updated: 0 });
        continue;
      }

      // Find Strava workouts without route data
      const workoutsSnapshot = await adminDb
        .collection('workouts')
        .where('assignedTo', '==', userId)
        .where('source', '==', 'strava')
        .get();

      const workoutsToUpdate = workoutsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.stravaActivityId && !data.routeData?.polyline;
      });

      console.log(`  📊 ${workoutsToUpdate.length} workouts need route data`);

      let userUpdated = 0;
      let userFailed = 0;

      for (const workoutDoc of workoutsToUpdate) {
        const workout = workoutDoc.data();
        const activityId = workout.stravaActivityId;

        try {
          const response = await fetch(
            `https://www.strava.com/api/v3/activities/${activityId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!response.ok) {
            userFailed++;
            continue;
          }

          const activity = await response.json();

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
            await adminDb.collection('workouts').doc(workoutDoc.id).update({ routeData });
            userUpdated++;
            console.log(`  ✅ ${workout.name}`);
          }

          // Rate limit: 1 req/sec to stay under Strava limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          userFailed++;
        }
      }

      totalUpdated += userUpdated;
      totalFailed += userFailed;
      results.push({ 
        userId, 
        displayName: userData.displayName,
        status: 'complete', 
        updated: userUpdated, 
        failed: userFailed 
      });
    }

    console.log(`\n🎉 Migration complete: ${totalUpdated} updated, ${totalFailed} failed`);

    return NextResponse.json({
      success: true,
      totalUsers: usersSnapshot.size,
      totalUpdated,
      totalFailed,
      results,
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
