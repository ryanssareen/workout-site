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

// AI-powered workout tagging using Groq
async function generateWorkoutTags(activity: any): Promise<WorkoutTag[]> {
  if (!process.env.GROQ_API_KEY) {
    console.log('⚠️ GROQ_API_KEY not set, skipping AI tagging');
    return [];
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

    const prompt = `Analyze this workout and select 1-3 appropriate tags.

Activity: ${activity.name}
Type: ${activity.type}
Distance: ${activity.distance ? (activity.distance / 1000).toFixed(2) + ' km' : 'N/A'}
Duration: ${activity.moving_time ? Math.round(activity.moving_time / 60) + ' min' : 'N/A'}
${paceInfo}
Avg Heart Rate: ${activity.average_heartrate ? activity.average_heartrate + ' bpm' : 'N/A'}
Max Heart Rate: ${activity.max_heartrate ? activity.max_heartrate + ' bpm' : 'N/A'}
Elevation Gain: ${activity.total_elevation_gain ? activity.total_elevation_gain + ' m' : 'N/A'}

Available tags: ${WORKOUT_TAGS.join(', ')}

Rules:
- Select 1-3 tags that best describe this workout
- Use "easy" for recovery/warm-up pace, "moderate" for steady state, "hard" for intense efforts
- Use "long" for duration >60min or distance >15km
- Use "speed" for short fast efforts, "intervals" for repeated efforts, "tempo" for sustained moderate-hard pace
- Use "recovery" for very easy efforts or active recovery
- Use "race" only if the name suggests a race/competition

Return ONLY a JSON object: {"tags": ["tag1", "tag2"]}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a fitness coach analyzing workout data. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(response);
    
    // Validate tags
    const validTags = (parsed.tags || [])
      .filter((tag: string) => WORKOUT_TAGS.includes(tag as WorkoutTag))
      .slice(0, 3) as WorkoutTag[];

    console.log(`🏷️ AI generated tags for "${activity.name}": ${validTags.join(', ')}`);
    return validTags;
  } catch (error) {
    console.error('❌ AI tagging error:', error);
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

// Find potential duplicates by matching TYPE + NAME
async function findDuplicatesByName(
  userId: string,
  workoutType: string,
  activityName: string
): Promise<{ id: string; data: any }[]> {
  // Normalize the activity name for comparison
  const normalizedName = activityName.toLowerCase().trim();

  // Query for workouts assigned to this user with the same type
  const workoutsSnapshot = await adminDb
    .collection('workouts')
    .where('assignedTo', '==', userId)
    .where('type', '==', workoutType)
    .get();

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

  return matches;
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

    // Fetch activities from the last year with pagination
    console.log('📡 Fetching activities from the last year...');
    const oneYearAgo = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60);
    const activities: any[] = [];
    let page = 1;
    const perPage = 200; // Strava max is 200 per page

    while (true) {
      const activitiesResponse = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${oneYearAgo}&per_page=${perPage}&page=${page}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!activitiesResponse.ok) {
        const errorData = await activitiesResponse.json().catch(() => ({ message: 'Unknown error' }));
        console.error('❌ Strava API error:', errorData);
        return NextResponse.json({ error: 'Failed to fetch Strava activities: ' + (errorData.message || 'Unknown error') }, { status: 500 });
      }

      const pageActivities = await activitiesResponse.json();
      console.log(`📄 Page ${page}: fetched ${pageActivities.length} activities`);

      if (pageActivities.length === 0) {
        break; // No more activities
      }

      activities.push(...pageActivities);

      if (pageActivities.length < perPage) {
        break; // Last page (partial)
      }

      page++;

      // Safety limit to prevent infinite loops
      if (page > 20) {
        console.log('⚠️ Reached page limit (20 pages)');
        break;
      }
    }

    console.log(`✅ Fetched ${activities.length} total activities from Strava`);

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
      const potentialDuplicates: {
        stravaActivityId: string;
        stravaName: string;
        stravaType: string;
        stravaDate: string;
        stravaDistance: number;
        stravaDuration: number;
        existingWorkouts: { id: string; name: string; date: string; completed: boolean }[];
      }[] = [];

      for (const activity of activitiesToProcess) {
        const workoutType = mapStravaType(activity.type);
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
      }

      if (potentialDuplicates.length > 0) {
        return NextResponse.json({
          success: true,
          hasDuplicates: true,
          duplicates: potentialDuplicates,
          totalNewActivities: activitiesToProcess.length,
        });
      }
    }

    // Process activities
    const batch = adminDb.batch();
    let newWorkoutsCount = 0;
    let mergedWorkoutsCount = 0;

    for (const activity of activitiesToProcess) {
      const activityDate = new Date(activity.start_date_local);
      const workoutType = mapStravaType(activity.type);
      const stravaId = String(activity.id);

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

      // Generate AI tags for new workouts
      const aiTags = await generateWorkoutTags(activity);

      // Check if there's a decision for this activity
      const decision = decisions[stravaId];

      if (decision?.action === 'merge' && decision.workoutId) {
        // User chose to merge with existing workout
        console.log(`🔗 Merging Strava activity "${activity.name}" with workout ${decision.workoutId}`);

        const workoutRef = adminDb.collection('workouts').doc(decision.workoutId);
        const workoutDoc = await workoutRef.get();
        const existingTags = workoutDoc.data()?.tags || [];
        const mergedTags = [...new Set([...existingTags, ...aiTags])].slice(0, 5);

        batch.update(workoutRef, {
          completed: true,
          completedAt: admin.firestore.Timestamp.fromDate(activityDate),
          completedBy: 'strava',
          stravaActivityId: stravaId,
          actualStats,
          tags: mergedTags.length > 0 ? mergedTags : admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        mergedWorkoutsCount++;
      } else {
        // Try to find a matching coach-assigned workout (date-based auto-merge)
        const matchingWorkout = await findMatchingWorkout(userId, workoutType, activityDate);

        if (matchingWorkout && !decision) {
          // Auto-merge with date-matched workout
          console.log(`🔗 Auto-merging Strava activity "${activity.name}" with existing workout "${matchingWorkout.data.name}"`);

          const workoutRef = adminDb.collection('workouts').doc(matchingWorkout.id);
          const existingTags = matchingWorkout.data.tags || [];
          const mergedTags = [...new Set([...existingTags, ...aiTags])].slice(0, 5);

          batch.update(workoutRef, {
            completed: true,
            completedAt: admin.firestore.Timestamp.fromDate(activityDate),
            completedBy: 'strava',
            stravaActivityId: stravaId,
            actualStats,
            tags: mergedTags.length > 0 ? mergedTags : admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          mergedWorkoutsCount++;
        } else {
          // Create new workout
          console.log(`➕ Creating new workout from Strava: ${activity.name}`);

          const workoutRef = adminDb.collection('workouts').doc();
          const workoutData: any = {
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
            stravaActivityId: stravaId,
            actualStats,
          };

          if (aiTags.length > 0) {
            workoutData.tags = aiTags;
          }

          batch.set(workoutRef, workoutData);
          newWorkoutsCount++;
        }
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
