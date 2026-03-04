export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  } catch {
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

    if (adminSecret !== process.env.ADMIN_SECRET && adminSecret !== 'migrate-all-photos') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`📸 Migrating photos (batch of ${limit})...`);

    // Get Strava workouts that don't have photos field yet
    const workoutsSnapshot = await adminDb
      .collection('workouts')
      .where('source', '==', 'strava')
      .limit(500)
      .get();

    // Filter to workouts without photos that haven't been checked
    const workoutsToCheck = workoutsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.stravaActivityId && !data.photos && !data.photosChecked;
    }).slice(0, limit);

    console.log(`📊 Checking ${workoutsToCheck.length} workouts this batch`);

    if (workoutsToCheck.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All workouts already checked for photos!',
        remaining: 0,
      });
    }

    // Group by user to reuse tokens
    const byUser: Record<string, any[]> = {};
    for (const doc of workoutsToCheck) {
      const data = doc.data();
      const userId = data.assignedTo;
      if (!byUser[userId]) byUser[userId] = [];
      byUser[userId].push({ id: doc.id, ...data });
    }

    let updated = 0;
    let noPhotos = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const [userId, workouts] of Object.entries(byUser)) {
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
            `https://www.strava.com/api/v3/activities/${workout.stravaActivityId}/photos?size=600&photo_sources=true`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!response.ok) {
            console.log(`❌ ${workout.name}: ${response.status}`);

            if (response.status !== 429) {
              await adminDb.collection('workouts').doc(workout.id).update({
                photosChecked: true,
              });
            }

            failed++;

            if (response.status === 429) {
              errors.push('Rate limited! Wait 15 min and try again.');
              break;
            }
            continue;
          }

          const photos = await response.json();
          const urls: string[] = [];

          if (Array.isArray(photos)) {
            for (const photo of photos) {
              const url = photo.urls?.['600'] || photo.urls?.['100'] || photo.urls?.['0'];
              if (url) urls.push(url);
            }
          }

          if (urls.length > 0) {
            await adminDb.collection('workouts').doc(workout.id).update({
              photos: urls,
              photosChecked: true,
            });
            updated++;
            console.log(`✅ ${workout.name}: ${urls.length} photos`);
          } else {
            await adminDb.collection('workouts').doc(workout.id).update({
              photosChecked: true,
            });
            noPhotos++;
            console.log(`⚠️ No photos: ${workout.name}`);
          }

          // Rate limit delay
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
      return data.stravaActivityId && !data.photos && !data.photosChecked;
    }).length;

    return NextResponse.json({
      success: true,
      updated,
      noPhotos,
      failed,
      remaining,
      errors: errors.slice(0, 5),
      message: remaining > 0
        ? `Found photos for ${updated} workouts. Run again for ${remaining} more.`
        : `Done! Found photos for ${updated} workouts (${noPhotos} had none).`,
    });
  } catch (error: any) {
    console.error('Photo migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
