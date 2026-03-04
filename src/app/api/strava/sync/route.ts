export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import Groq from 'groq-sdk';

// Predefined workout tags (must match frontend)
const WORKOUT_TAGS = [
  'easy', 'moderate', 'hard', 'recovery', 'speed', 
  'endurance', 'intervals', 'tempo', 'long', 'strength', 
  'technique', 'race'
] as const;

type WorkoutTag = typeof WORKOUT_TAGS[number];

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

// Helper to get start and end of a day for date matching
function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// AI-powered workout tagging using Groq
async function generateWorkoutTags(activity: any): Promise<{ tags: WorkoutTag[]; aiComment?: string }> {
  if (!process.env.GROQ_API_KEY) {
    console.log('⚠️ GROQ_API_KEY not set, skipping AI tagging');
    return { tags: [] };
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

    // Calculate pace for runs (min/km)
    let paceInfo = '';
    if (activity.type === 'Run' && activity.distance && activity.moving_time) {
      const paceSecondsPerKm = (activity.moving_time / (activity.distance / 1000));
      const paceMin = Math.floor(paceSecondsPerKm / 60);
      const paceSec = Math.round(paceSecondsPerKm % 60);
      paceInfo = `Pace: ${paceMin}:${paceSec.toString().padStart(2, '0')}/km`;
    }

    // Location context for fun comments
    const locationCity = activity.location_city || '';
    const locationState = activity.location_state || '';
    const locationCountry = activity.location_country || '';
    const hasLocation = locationCity || locationState || locationCountry;
    const locationStr = [locationCity, locationState, locationCountry].filter(Boolean).join(', ');
    const hasRoute = !!activity.map?.summary_polyline;
    const terrainHint = activity.type === 'Run' && activity.name?.toLowerCase().includes('trail') ? 'trail' :
                        activity.type === 'Run' && activity.name?.toLowerCase().includes('beach') ? 'beach' :
                        activity.type === 'Ride' && activity.name?.toLowerCase().includes('mountain') ? 'mountain' : '';

    const prompt = `Analyze this workout and select 1-3 appropriate tags.${hasLocation || hasRoute ? ' Also write a SHORT fun comment (1 sentence, max 15 words) about the route/location — be playful, like a hype coach reacting to where they trained. Examples: "Sandy beach vibes, perfect spot for a morning run! 🏖️", "Hill climbing beast mode in the mountains! 🏔️", "City streets at dawn — nothing beats that energy! 🌆"' : ''}

Activity: ${activity.name}
Type: ${activity.type}
Distance: ${activity.distance ? (activity.distance / 1000).toFixed(2) + ' km' : 'N/A'}
Duration: ${activity.moving_time ? Math.round(activity.moving_time / 60) + ' min' : 'N/A'}
${paceInfo}
Avg Heart Rate: ${activity.average_heartrate ? activity.average_heartrate + ' bpm' : 'N/A'}
Max Heart Rate: ${activity.max_heartrate ? activity.max_heartrate + ' bpm' : 'N/A'}
Elevation Gain: ${activity.total_elevation_gain ? activity.total_elevation_gain + ' m' : 'N/A'}
${hasLocation ? `Location: ${locationStr}` : ''}
${terrainHint ? `Terrain: ${terrainHint}` : ''}
${hasRoute ? 'Has GPS route: Yes' : ''}

Available tags: ${WORKOUT_TAGS.join(', ')}

Rules:
- Select 1-3 tags that best describe this workout
- Use "easy" for recovery/warm-up pace, "moderate" for steady state, "hard" for intense efforts
- Use "long" for duration >60min or distance >15km
- Use "speed" for short fast efforts, "intervals" for repeated efforts, "tempo" for sustained moderate-hard pace
- Use "recovery" for very easy efforts or active recovery
- Use "race" only if the name suggests a race/competition

Return ONLY a JSON object: {"tags": ["tag1", "tag2"]${hasLocation || hasRoute ? ', "comment": "your fun comment here"' : ''}}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a hype fitness coach analyzing workout data. Return only valid JSON. When writing comments, be fun and brief — react to the location/route like a friend would.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(response);
    
    // Validate tags
    const validTags = (parsed.tags || [])
      .filter((tag: string) => WORKOUT_TAGS.includes(tag as WorkoutTag))
      .slice(0, 3) as WorkoutTag[];

    const aiComment = parsed.comment && typeof parsed.comment === 'string' ? parsed.comment.slice(0, 100) : undefined;

    console.log(`🏷️ AI generated tags for "${activity.name}": ${validTags.join(', ')}${aiComment ? ` | Comment: ${aiComment}` : ''}`);
    return { tags: validTags, aiComment };
  } catch (error) {
    console.error('❌ AI tagging error:', error);
    return { tags: [] };
  }
}

// Fetch photo URLs for a Strava activity
async function fetchStravaPhotos(activityId: string, accessToken: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/photos?size=600&photo_sources=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.log(`⚠️ Failed to fetch photos for activity ${activityId}: ${response.status}`);
      return [];
    }

    const photos = await response.json();
    if (!Array.isArray(photos) || photos.length === 0) return [];

    // Extract the best available URL from each photo
    const urls: string[] = [];
    for (const photo of photos) {
      const url = photo.urls?.['600'] || photo.urls?.['100'] || photo.urls?.['0'];
      if (url) urls.push(url);
    }

    console.log(`📸 Found ${urls.length} photos for activity ${activityId}`);
    return urls;
  } catch (error) {
    console.error(`❌ Error fetching photos for activity ${activityId}:`, error);
    return [];
  }
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
    .collection('users').doc(userId).collection('workouts')
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

// Find potential duplicates by matching TYPE + NAME
async function findDuplicatesByName(
  userId: string,
  workoutType: string,
  activityName: string
): Promise<{ id: string; data: any }[]> {
  try {
    console.log(`🔍 Checking duplicates for: ${activityName} (type: ${workoutType}, userId: ${userId})`);

    // Normalize the activity name for comparison
    const normalizedName = activityName.toLowerCase().trim();

    // Query for workouts assigned to this user with the same type
    const workoutsSnapshot = await adminDb
      .collection('users').doc(userId).collection('workouts')
      .where('type', '==', workoutType)
      .get();

    console.log(`✅ Found ${workoutsSnapshot.size} workouts with matching type`);

    const matches: { id: string; data: any }[] = [];

    for (const doc of workoutsSnapshot.docs) {
      const data = doc.data();
      // Skip if it's already a Strava import
      if (data.source === 'strava') continue;

      // Compare normalized names
      const existingName = (data.name || '').toLowerCase().trim();
      if (existingName === normalizedName) {
        matches.push({ id: doc.id, data });
      }
    }

    console.log(`🔍 Found ${matches.length} exact name matches`);
    return matches;
  } catch (error: any) {
    console.error('❌ Error in findDuplicatesByName:', {
      error: error.message,
      code: error.code,
      details: error.details,
      userId,
      workoutType,
      activityName
    });

    // Check for missing index error
    if (error.code === 9 || error.message?.includes('index')) {
      console.error('⚠️ MISSING FIRESTORE INDEX - Please deploy indexes with: firebase deploy --only firestore:indexes');
    }

    throw new Error(`Failed to check for duplicates: ${error.message}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Strava sync requested');

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const checkDuplicates = searchParams.get('checkDuplicates') === 'true';
    const duplicateDecisions = searchParams.get('decisions');

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

    // Handle stravaTokenExpiresAt stored as number, Date, or Firestore Timestamp
    const expiresAt = userData.stravaTokenExpiresAt?.toDate
      ? Math.floor(userData.stravaTokenExpiresAt.toDate().getTime() / 1000)
      : userData.stravaTokenExpiresAt instanceof Date
        ? Math.floor(userData.stravaTokenExpiresAt.getTime() / 1000)
        : userData.stravaTokenExpiresAt;

    if (expiresAt && expiresAt < currentTime) {
      console.log('🔄 Token expired, refreshing...');
      const newToken = await refreshStravaToken(userId, userData.stravaRefreshToken);
      if (!newToken) {
        console.error('❌ Failed to refresh token');
        return NextResponse.json({ error: 'Failed to refresh Strava token' }, { status: 401 });
      }
      accessToken = newToken;
      console.log('✅ Token refreshed');
    }

    // Fetch activities from the last year in batches
    console.log('📡 Fetching activities from the last year...');
    const oneYearAgo = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60);

    let activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${oneYearAgo}&per_page=200`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    // Handle authorization errors with token refresh and retry
    if (!activitiesResponse.ok && (activitiesResponse.status === 401 || activitiesResponse.status === 403)) {
      const errorData = await activitiesResponse.json().catch(() => ({ message: 'Authorization Error' }));
      console.error('❌ Strava API authorization error:', {
        status: activitiesResponse.status,
        error: errorData
      });

      // Token is invalid or revoked - try to refresh it
      console.log('🔄 Authorization failed, attempting token refresh...');
      const newToken = await refreshStravaToken(userId, userData.stravaRefreshToken);

      if (!newToken) {
        console.error('❌ Token refresh failed - user needs to reconnect');
        return NextResponse.json(
          {
            error: 'Strava authorization failed. Please disconnect and reconnect your Strava account.',
            needsReconnect: true
          },
          { status: 401 }
        );
      }

      // Retry with new token
      console.log('✅ Token refreshed, retrying request...');
      activitiesResponse = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${oneYearAgo}&per_page=200`,
        {
          headers: { Authorization: `Bearer ${newToken}` },
        }
      );

      if (!activitiesResponse.ok) {
        const retryErrorData = await activitiesResponse.json().catch(() => ({ message: 'Unknown error' }));
        console.error('❌ Retry failed:', retryErrorData);
        return NextResponse.json(
          {
            error: 'Strava authorization failed after token refresh. Please disconnect and reconnect your Strava account.',
            needsReconnect: true
          },
          { status: 401 }
        );
      }

      console.log('✅ Successfully retried after token refresh');
    }

    // Handle other errors
    if (!activitiesResponse.ok) {
      const errorData = await activitiesResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('❌ Strava API error:', {
        status: activitiesResponse.status,
        statusText: activitiesResponse.statusText,
        error: errorData
      });
      return NextResponse.json(
        {
          error: `Failed to fetch Strava activities: ${errorData.message || 'Unknown error'}`,
          details: errorData
        },
        { status: 500 }
      );
    }

    const activities = await activitiesResponse.json();

    if (!Array.isArray(activities)) {
      console.error('❌ Unexpected Strava response format:', activities);
      return NextResponse.json(
        { error: 'Unexpected response from Strava. Please try again.' },
        { status: 502 }
      );
    }

    console.log(`✅ Fetched ${activities.length} activities from last year`);

    // Get existing Strava workout IDs to avoid duplicates
    const existingWorkoutsSnapshot = await adminDb
      .collection('users').doc(userId).collection('workouts')
      .where('source', '==', 'strava')
      .get();

    const existingStravaIds = new Set(
      existingWorkoutsSnapshot.docs.map(doc => String(doc.data().stravaActivityId))
    );

    console.log(`📊 Found ${existingStravaIds.size} existing Strava workouts`);

    // Filter out already imported activities
    const activitiesToProcess: any[] = [];
    for (const activity of activities) {
      if (!existingStravaIds.has(String(activity.id))) {
        activitiesToProcess.push(activity);
      }
    }

    console.log(`🆕 Processing ${activitiesToProcess.length} new activities`);

    // Parse duplicate decisions if provided
    const decisions: Record<string, { action: 'merge' | 'new'; workoutId?: string }> = duplicateDecisions
      ? JSON.parse(duplicateDecisions)
      : {};

    // If checkDuplicates is true, find and return potential duplicates
    if (checkDuplicates) {
      console.log('🔍 Checking for duplicates...');
      const potentialDuplicates: {
        stravaActivityId: string;
        stravaName: string;
        stravaType: string;
        stravaDate: string;
        stravaDistance: number;
        stravaDuration: number;
        existingWorkouts: { id: string; name: string; date: string; completed: boolean }[];
      }[] = [];

      try {
        for (const activity of activitiesToProcess) {
          const workoutType = mapStravaType(activity.type);

          try {
            const duplicates = await findDuplicatesByName(userId, workoutType, activity.name);

            if (duplicates.length > 0) {
              potentialDuplicates.push({
                stravaActivityId: String(activity.id),
                stravaName: activity.name,
                stravaType: workoutType,
                stravaDate: activity.start_date_local,
                stravaDistance: activity.distance || 0,
                stravaDuration: activity.moving_time || 0,
                existingWorkouts: duplicates.map(d => ({
                  id: d.id,
                  name: d.data.name,
                  date: d.data.date?.toDate?.()?.toISOString() || '',
                  completed: d.data.completed || false,
                })),
              });
            }
          } catch (activityError: any) {
            console.error(`❌ Error checking duplicates for activity ${activity.name}:`, activityError.message);
            // Continue processing other activities instead of failing entirely
          }
        }

        console.log(`✅ Duplicate check complete: found ${potentialDuplicates.length} potential duplicates`);

        return NextResponse.json({
          success: true,
          hasDuplicates: potentialDuplicates.length > 0,
          duplicates: potentialDuplicates,
          totalNewActivities: activitiesToProcess.length,
        });
      } catch (error: any) {
        console.error('❌ Critical error during duplicate check:', error);

        return NextResponse.json(
          {
            error: 'Failed to check for duplicates',
            details: error.message,
            code: error.code,
            hint: error.code === 9 ? 'Missing Firestore index. Please run: firebase deploy --only firestore:indexes' : undefined
          },
          { status: 500 }
        );
      }
    }

    // Process activities one at a time to avoid duplicates
    let newWorkoutsCount = 0;
    let mergedWorkoutsCount = 0;
    let skippedCount = 0;

    // Helper function to delay between activities
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Track IDs we've already processed in this sync
    const processedInThisSync = new Set<string>();

    for (let i = 0; i < activitiesToProcess.length; i++) {
      const activity = activitiesToProcess[i];
      const stravaId = String(activity.id);

      // Skip if already processed in this sync run
      if (processedInThisSync.has(stravaId)) {
        console.log(`  ⏭️ Already processed in this sync: ${activity.name}`);
        skippedCount++;
        continue;
      }

      // Double-check this activity doesn't already exist (real-time check)
      const existingCheck = await adminDb
        .collection('users').doc(userId).collection('workouts')
        .where('stravaActivityId', '==', stravaId)
        .limit(1)
        .get();

      if (!existingCheck.empty) {
        console.log(`  ⏭️ Already exists: ${activity.name}`);
        skippedCount++;
        processedInThisSync.add(stravaId);
        continue;
      }

      console.log(`📦 Processing ${i + 1}/${activitiesToProcess.length}: ${activity.name}`);

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

      // Capture route/map data
      const routeData: any = {};
      if (activity.map?.summary_polyline) routeData.polyline = activity.map.summary_polyline;
      if (activity.start_latlng) routeData.startLatLng = activity.start_latlng;
      if (activity.end_latlng) routeData.endLatLng = activity.end_latlng;

      // Check if there's a decision for this activity
      const decision = decisions[stravaId];

      if (decision?.action === 'merge' && decision.workoutId) {
        // User chose to merge with existing workout
        console.log(`  🔗 Merging: ${activity.name}`);

        await adminDb.collection('users').doc(userId).collection('workouts').doc(decision.workoutId).update({
          completed: true,
          completedAt: admin.firestore.Timestamp.fromDate(activityDate),
          completedBy: 'strava',
          stravaActivityId: stravaId,
          actualStats,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        mergedWorkoutsCount++;
      } else {
        // Try to find a matching coach-assigned workout (date-based auto-merge)
        const matchingWorkout = await findMatchingWorkout(userId, workoutType, activityDate);

        if (matchingWorkout && !decision) {
          // Auto-merge with date-matched workout
          console.log(`  🔗 Auto-merge: ${activity.name} → ${matchingWorkout.data.name}`);

          await adminDb.collection('users').doc(userId).collection('workouts').doc(matchingWorkout.id).update({
            completed: true,
            completedAt: admin.firestore.Timestamp.fromDate(activityDate),
            completedBy: 'strava',
            stravaActivityId: stravaId,
            actualStats,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          mergedWorkoutsCount++;
        } else {
          // Before creating: proximity duplicate check (catches 4-min drift, GPS re-uploads, etc.)
          const thirtyMinBefore = new Date(activityDate.getTime() - 30 * 60 * 1000);
          const thirtyMinAfter = new Date(activityDate.getTime() + 30 * 60 * 1000);
          const proximitySnap = await adminDb
            .collection('users').doc(userId).collection('workouts')
            .where('type', '==', workoutType)
            .where('source', '==', 'strava')
            .where('date', '>=', admin.firestore.Timestamp.fromDate(thirtyMinBefore))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(thirtyMinAfter))
            .get();
          
          let proximityDupe = false;
          for (const pDoc of proximitySnap.docs) {
            const pData = pDoc.data();
            if (pData.stravaActivityId === stravaId) continue; // same activity, already handled
            const eDur = pData.actualStats?.duration || (pData.duration || 0) * 60;
            const nDur = activity.moving_time || 0;
            const dClose = eDur > 0 && nDur > 0 && Math.abs(eDur - nDur) < 600;
            const eDist = pData.actualStats?.distance || 0;
            const nDist = activity.distance || 0;
            const distClose = eDist > 0 && nDist > 0 && Math.abs(eDist - nDist) / Math.max(eDist, nDist) < 0.05;
            if (dClose && distClose) {
              console.log(`  🛑 Proximity duplicate: "${activity.name}" ~= "${pData.name}" (${pDoc.id}) — SKIPPING`);
              proximityDupe = true;
              skippedCount++;
              break;
            }
          }
          
          if (!proximityDupe) {
            // Create new workout
            console.log(`  ➕ Creating: ${activity.name}`);

          // Generate AI tags and fun route comment
          const { tags: aiTags, aiComment } = await generateWorkoutTags(activity);

          const newWorkoutData: any = {
            name: activity.name,
            type: workoutType,
            description: `Imported from Strava\nDistance: ${((activity.distance || 0) / 1000).toFixed(2)} km\nMoving time: ${Math.round((activity.moving_time || 0) / 60)} min`,
            date: admin.firestore.Timestamp.fromDate(activityDate),
            duration: Math.round((activity.moving_time || 0) / 60),
            ownerUsername: userId,
            createdBy: userId,
            assignedTo: userId,
            completed: true,
            completedAt: admin.firestore.Timestamp.fromDate(activityDate),
            completedBy: 'strava',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            source: 'strava',
            stravaActivityId: stravaId,
            actualStats,
          };

          // Add AI-generated tags
          if (aiTags.length > 0) {
            newWorkoutData.tags = aiTags;
          }

          // Add route data if available (with AI comment)
          if (Object.keys(routeData).length > 0) {
            if (aiComment) routeData.aiComment = aiComment;
            newWorkoutData.routeData = routeData;
          }

          // Fetch photos if the activity has any
          if (activity.total_photo_count > 0) {
            const photoUrls = await fetchStravaPhotos(String(activity.id), accessToken);
            if (photoUrls.length > 0) {
              newWorkoutData.photos = photoUrls;
            }
          }

          // Add type-specific sub-objects so workouts can be properly edited
          const distKm = (activity.distance || 0) / 1000;
          const timeMin = Math.round((activity.moving_time || 0) / 60);
          if (workoutType === 'run') {
            newWorkoutData.run = {
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
            newWorkoutData.bike = {
              distance: Math.round(distKm * 100) / 100,
              distanceUnit: 'km',
              time: timeMin,
              ...(activity.total_elevation_gain ? { elevationGain: Math.round(activity.total_elevation_gain) } : {}),
              ...(activity.average_watts ? { avgPower: Math.round(activity.average_watts) } : {}),
            };
          } else if (workoutType === 'swim') {
            newWorkoutData.swim = {
              distance: Math.round(activity.distance || 0),
              distanceUnit: 'meters',
              time: timeMin,
            };
          }

          await adminDb.collection('users').doc(userId).collection('workouts').doc(`strava_${stravaId}`).set(newWorkoutData);
          newWorkoutsCount++;
          }
        }
      }

      // Mark as processed
      processedInThisSync.add(stravaId);

      // Small delay between activities
      if (i < activitiesToProcess.length - 1) {
        await delay(200);
      }
    }

    console.log(`✅ Finished: Created ${newWorkoutsCount}, merged ${mergedWorkoutsCount}, skipped ${skippedCount}`);

    // Run Groq dedup after every sync
    let dedupInfo: any = null;
    try {
      console.log('🔍 Running Groq dedup after sync...');
      const { runDedupPipeline, executeDedupDeletions } = await import('@/lib/groq-dedup');
      const { result: dedupResult } = await runDedupPipeline(userId);
      if (dedupResult.duplicatesFound > 0) {
        console.log(`🗑️ Groq found ${dedupResult.duplicatesFound} duplicates — auto-deleting`);
        const deleted = await executeDedupDeletions(dedupResult, userId);
        console.log(`✅ Deleted ${deleted} duplicate workouts`);
        dedupInfo = { duplicatesRemoved: deleted, model: dedupResult.model };
      } else {
        console.log('✅ No duplicates found after sync');
        dedupInfo = { duplicatesRemoved: 0, model: dedupResult.model };
      }
    } catch (dedupErr: any) {
      console.error('⚠️ Dedup pipeline error (non-fatal):', dedupErr.message);
      dedupInfo = { error: dedupErr.message };
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
      dedup: dedupInfo,
    });
  } catch (error) {
    console.error('Strava sync error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to sync Strava activities';
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
