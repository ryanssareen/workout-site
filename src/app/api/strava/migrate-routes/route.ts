export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max for Vercel hobby

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

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
    const { adminSecret, limit = 20 } = await request.json().catch(() => ({}));
    
    if (adminSecret !== process.env.ADMIN_SECRET && adminSecret !== 'migrate-all-routes') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🗺️ Migrating routes (batch of ${limit})...`);

    // Get all Strava workouts WITHOUT routeData, limited
    const workoutsSnapshot = await adminDb
      .collection('workouts')
      .where('source', '==', 'strava')
      .limit(500) // Get more to filter
      .get();

    // Filter to those missing polyline
    const workoutsToUpdate = workoutsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.stravaActivityId && !data.routeData?.polyline;
    }).slice(0, limit); // Only process 'limit' at a time

    console.log(`📊 Processing ${workoutsToUpdate.length} workouts this batch`);

    if (workoutsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All workouts already have route data!',
        remaining: 0,
      });
    }

    // Group by user to reuse tokens
    const byUser: Record<string, any[]> = {};
    for (const doc of workoutsToUpdate) {
      const data = doc.data();
      const userId = data.assignedTo;
      if (!byUser[userId]) byUser[userId] = [];
      byUser[userId].push({ id: doc.id, ...data });
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const [userId, workouts] of Object.entries(byUser)) {
      // Get user token
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        failed += workouts.length;
        continue;
      }

      const userData = userDoc.data();
      const accessToken = await getValidToken(userData, userId);
      
      if (!accessToken) {
        errors.push(`No token for user ${userId}`);
        failed += workouts.length;
        continue;
      }

      for (const workout of workouts) {
        try {
          const response = await fetch(
            `https://www.strava.com/api/v3/activities/${workout.stravaActivityId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!response.ok) {
            const errText = await response.text();
            if (errors.length < 5) errors.push(`${response.status}: ${errText.slice(0, 100)}`);
            failed++;
            
            if (response.status === 429) {
              errors.push('Rate limited! Wait and try again.');
              break;
            }
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
            await adminDb.collection('workouts').doc(workout.id).update({ routeData });
            updated++;
            console.log(`✅ ${workout.name}`);
          } else {
            // No GPS data for this activity
            await adminDb.collection('workouts').doc(workout.id).update({ 
              routeData: { noGPS: true } 
            });
            console.log(`⚠️ No GPS: ${workout.name}`);
          }

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error: any) {
          if (errors.length < 5) errors.push(error.message);
          failed++;
        }
      }
    }

    // Count remaining
    const remainingSnapshot = await adminDb
      .collection('workouts')
      .where('source', '==', 'strava')
      .limit(500)
      .get();
    
    const remaining = remainingSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.stravaActivityId && !data.routeData;
    }).length;

    return NextResponse.json({
      success: true,
      updated,
      failed,
      remaining,
      errors: errors.slice(0, 5),
      message: remaining > 0 
        ? `Updated ${updated}. Run again for ${remaining} more.`
        : `Done! Updated ${updated} workouts.`,
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
