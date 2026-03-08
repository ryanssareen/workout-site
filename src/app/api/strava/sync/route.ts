export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import Groq from 'groq-sdk';
import { sendPushNotification } from '@/lib/push';

// ── Strava rate-limit header parser ──────────────────────────────────────────
function parseStravaRateLimits(resp: Response) {
  const limitHeader = resp.headers.get('x-ratelimit-limit');   // e.g. "100,1000"
  const usageHeader = resp.headers.get('x-ratelimit-usage');   // e.g. "34,562"
  if (!limitHeader || !usageHeader) return null;

  const [fifteenMinLimit, dailyLimit] = limitHeader.split(',').map(Number);
  const [fifteenMinUsage, dailyUsage] = usageHeader.split(',').map(Number);

  return { fifteenMinLimit, dailyLimit, fifteenMinUsage, dailyUsage };
}

function logStravaRateLimits(resp: Response, context: string) {
  const limits = parseStravaRateLimits(resp);
  if (limits) {
    console.log(`📊 [${context}] Strava rate limits: ${limits.fifteenMinUsage}/${limits.fifteenMinLimit} (15-min), ${limits.dailyUsage}/${limits.dailyLimit} (daily)`);
  }
  return limits;
}

function getRateLimitMessage(resp: Response): { message: string; isDaily: boolean } {
  const limits = parseStravaRateLimits(resp);
  if (limits) {
    const is15MinExceeded = limits.fifteenMinUsage >= limits.fifteenMinLimit;
    const isDailyExceeded = limits.dailyUsage >= limits.dailyLimit;
    if (isDailyExceeded) {
      return {
        message: `Strava daily rate limit reached (${limits.dailyUsage}/${limits.dailyLimit}). Resets at midnight UTC.`,
        isDaily: true,
      };
    }
    if (is15MinExceeded) {
      return {
        message: `Strava 15-minute rate limit reached (${limits.fifteenMinUsage}/${limits.fifteenMinLimit}). Try again in ~15 minutes.`,
        isDaily: false,
      };
    }
  }
  return { message: 'Strava rate limit reached. Try again in a few minutes.', isDaily: false };
}

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

// Laps/splits are now fetched on-demand via /api/strava/activity-details
// to avoid burning through Strava's rate limit during sync (1 extra call per activity)

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

// Find a matching imported (CSV/XLSX) workout by date + type + near distance
async function findMatchingImportedWorkout(
  userId: string,
  workoutType: string,
  activityDate: Date,
  activityDistance: number // in meters
): Promise<{ id: string; data: any } | null> {
  const { start, end } = getDayBounds(activityDate);

  // Query for imported workouts of same type on the same day
  const workoutsSnapshot = await adminDb
    .collection('users').doc(userId).collection('workouts')
    .where('type', '==', workoutType)
    .where('source', '==', 'import')
    .where('date', '>=', admin.firestore.Timestamp.fromDate(start))
    .where('date', '<=', admin.firestore.Timestamp.fromDate(end))
    .get();

  for (const doc of workoutsSnapshot.docs) {
    const data = doc.data();
    // Already merged with Strava? Skip.
    if (data.stravaActivityId) continue;

    // Check distance proximity (within 10%)
    const importedDist = data.actualStats?.distance || 0; // in meters
    if (activityDistance > 0 && importedDist > 0) {
      const ratio = Math.abs(activityDistance - importedDist) / Math.max(activityDistance, importedDist);
      if (ratio < 0.10) {
        console.log(`📎 Found matching imported workout: ${data.name} (${doc.id}) — distance ${(importedDist/1000).toFixed(1)}km vs ${(activityDistance/1000).toFixed(1)}km`);
        return { id: doc.id, data };
      }
    } else if (activityDistance === 0 && importedDist === 0) {
      // Both have no distance (e.g. strength workout) — match by type + date alone
      console.log(`📎 Found matching imported workout (no distance): ${data.name} (${doc.id})`);
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

// POST handler — accepts tokens in body, works even when Firestore reads are exhausted
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    // Merge body params with query params (query params take precedence for backwards compat)
    const userId = url.searchParams.get('userId') || body.userId;
    const accessTokenFromClient = body.stravaAccessToken;
    const refreshTokenFromClient = body.stravaRefreshToken;
    const expiresAtFromClient = body.stravaTokenExpiresAt;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (!accessTokenFromClient) {
      return NextResponse.json({ error: 'Strava tokens required in POST body' }, { status: 400 });
    }

    return handleSync(request, {
      userId,
      accessTokenOverride: accessTokenFromClient,
      refreshTokenOverride: refreshTokenFromClient,
      expiresAtOverride: expiresAtFromClient,
      checkDuplicates: url.searchParams.get('checkDuplicates') === 'true' || body.checkDuplicates === true,
      duplicateDecisions: url.searchParams.get('decisions') || body.decisions,
      period: url.searchParams.get('period') || body.period,
      afterParam: url.searchParams.get('after') || body.after,
      quotaSafe: true, // POST mode = skip unnecessary reads
      mode: (url.searchParams.get('mode') || body.mode) as 'recent' | 'backfill' | undefined,
      backfillPage: Number(url.searchParams.get('backfillPage') || body.backfillPage) || undefined,
    });
  } catch (error: any) {
    console.error('Strava sync POST error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to sync';
    const isQuota = errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded') || error.code === 8;
    return NextResponse.json(
      { error: isQuota ? 'Firebase daily quota reached. Try again tomorrow.' : errMsg, isQuota },
      { status: isQuota ? 429 : 500 }
    );
  }
}

// GET handler — reads tokens from Firestore (original behavior)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    return handleSync(request, {
      userId,
      checkDuplicates: searchParams.get('checkDuplicates') === 'true',
      duplicateDecisions: searchParams.get('decisions'),
      period: searchParams.get('period'),
      afterParam: searchParams.get('after'),
      quotaSafe: false,
      mode: searchParams.get('mode') as 'recent' | 'backfill' | undefined,
      backfillPage: Number(searchParams.get('backfillPage')) || undefined,
    });
  } catch (error: any) {
    console.error('Strava sync GET error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to sync';
    const isQuota = errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded') || error.code === 8;
    return NextResponse.json(
      { error: isQuota ? 'Firebase daily quota reached. Try again tomorrow.' : errMsg, isQuota },
      { status: isQuota ? 429 : 500 }
    );
  }
}

interface SyncOptions {
  userId: string;
  accessTokenOverride?: string;
  refreshTokenOverride?: string;
  expiresAtOverride?: number;
  checkDuplicates: boolean;
  duplicateDecisions?: string | null;
  period?: string | null;
  afterParam?: string | null;
  quotaSafe: boolean;
  mode?: 'recent' | 'backfill';  // recent = last N days (default), backfill = paginated older history
  backfillPage?: number;          // page number for backfill mode (1-based)
}

async function handleSync(request: NextRequest, opts: SyncOptions) {
  try {
    const {
      userId, checkDuplicates, duplicateDecisions: duplicateDecisionsRaw,
      period, afterParam, quotaSafe, mode, backfillPage,
    } = opts;

    const syncMode = mode || 'recent';
    console.log(`🔄 Strava sync for ${userId} (mode=${syncMode}, quotaSafe=${quotaSafe}${backfillPage ? `, page=${backfillPage}` : ''})`);

    // ── Resolve Strava tokens ──
    let accessToken: string;
    let refreshToken: string | undefined;

    if (opts.accessTokenOverride) {
      // Tokens provided by frontend — zero Firestore reads needed
      accessToken = opts.accessTokenOverride;
      refreshToken = opts.refreshTokenOverride;

      // Check expiry
      const currentTime = Math.floor(Date.now() / 1000);
      if (opts.expiresAtOverride && opts.expiresAtOverride < currentTime && refreshToken) {
        console.log('🔄 Client token expired, refreshing...');
        const newToken = await refreshStravaToken(userId, refreshToken);
        if (!newToken) {
          return NextResponse.json({ error: 'Failed to refresh Strava token', needsReconnect: true }, { status: 401 });
        }
        accessToken = newToken;
      }
    } else {
      // Read tokens from Firestore (original path)
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const userData = userDoc.data();
      if (!userData?.stravaAccessToken) {
        return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
      }

      accessToken = userData.stravaAccessToken;
      refreshToken = userData.stravaRefreshToken;
      const currentTime = Math.floor(Date.now() / 1000);
      const expiresAt = userData.stravaTokenExpiresAt?.toDate
        ? Math.floor(userData.stravaTokenExpiresAt.toDate().getTime() / 1000)
        : userData.stravaTokenExpiresAt instanceof Date
          ? Math.floor(userData.stravaTokenExpiresAt.getTime() / 1000)
          : userData.stravaTokenExpiresAt;

      if (expiresAt && expiresAt < currentTime) {
        console.log('🔄 Token expired, refreshing...');
        const newToken = await refreshStravaToken(userId, refreshToken!);
        if (!newToken) {
          return NextResponse.json({ error: 'Failed to refresh Strava token' }, { status: 401 });
        }
        accessToken = newToken;
      }
    }

    // Calculate time range based on mode, period, or explicit 'after' date
    const PERIOD_DAYS: Record<string, number> = {
      '2days': 2, 'week': 7, 'month': 30, '2months': 60, '6months': 180, 'year': 365,
    };

    // Backfill mode: fetch activities OLDER than 30 days, one page at a time
    // Recent mode: fetch activities from the last N days (default: 30)
    let afterTimestamp: number | undefined;
    let beforeTimestamp: number | undefined;
    const fetchPage = backfillPage || 1;

    if (syncMode === 'backfill') {
      // Fetch activities older than 30 days
      beforeTimestamp = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      console.log(`📡 Backfill mode: fetching page ${fetchPage} of activities before 30 days ago...`);
    } else if (afterParam) {
      afterTimestamp = Math.floor(new Date(afterParam).getTime() / 1000);
      console.log(`📡 Fetching activities after ${afterParam}...`);
    } else {
      const periodDays = (period && PERIOD_DAYS[period]) || 30; // default to 30 days (was 365)
      afterTimestamp = Math.floor(Date.now() / 1000) - (periodDays * 24 * 60 * 60);
      console.log(`📡 Fetching activities from the last ${period || 'month'} (${periodDays} days)...`);
    }

    // Fetch activities from Strava API
    // Recent mode: paginate to get all activities in the time window
    // Backfill mode: single page only (client controls pagination)
    async function fetchActivities(token: string): Promise<{ activities: any[] | null; error?: Response }> {
      if (syncMode === 'backfill') {
        // Backfill: fetch a single page using 'before' timestamp
        const url = `https://www.strava.com/api/v3/athlete/activities?before=${beforeTimestamp}&per_page=200&page=${fetchPage}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        logStravaRateLimits(resp, `backfill page ${fetchPage}`);
        if (!resp.ok) return { activities: null, error: resp };
        const data = await resp.json();
        if (!Array.isArray(data)) return { activities: [] };
        return { activities: data };
      }

      // Recent mode: paginate to fetch all activities in the window
      const all: any[] = [];
      let page = 1;
      while (true) {
        const resp = await fetch(
          `https://www.strava.com/api/v3/athlete/activities?after=${afterTimestamp}&per_page=200&page=${page}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        logStravaRateLimits(resp, `recent page ${page}`);
        if (!resp.ok) {
          if (page === 1) return { activities: null, error: resp };
          break; // stop paginating on later page errors
        }
        const data = await resp.json();
        if (!Array.isArray(data) || data.length === 0) break;
        all.push(...data);
        if (data.length < 200) break;
        page++;
      }
      return { activities: all };
    }

    let result = await fetchActivities(accessToken);

    // Handle authorization errors with token refresh and retry
    if (!result.activities && result.error && (result.error.status === 401 || result.error.status === 403)) {
      const errorData = await result.error.json().catch(() => ({ message: 'Authorization Error' }));
      console.error('❌ Strava API authorization error:', { status: result.error.status, error: errorData });

      console.log('🔄 Authorization failed, attempting token refresh...');
      if (!refreshToken) {
        return NextResponse.json(
          { error: 'Strava authorization failed and no refresh token available. Please disconnect and reconnect your Strava account.', needsReconnect: true },
          { status: 401 }
        );
      }
      const newToken = await refreshStravaToken(userId, refreshToken);

      if (!newToken) {
        console.error('❌ Token refresh failed - user needs to reconnect');
        return NextResponse.json(
          { error: 'Strava authorization failed. Please disconnect and reconnect your Strava account.', needsReconnect: true },
          { status: 401 }
        );
      }

      console.log('✅ Token refreshed, retrying request...');
      result = await fetchActivities(newToken);

      if (!result.activities) {
        const retryErrorData = result.error ? await result.error.json().catch(() => ({ message: 'Unknown error' })) : {};
        console.error('❌ Retry failed:', retryErrorData);
        return NextResponse.json(
          { error: 'Strava authorization failed after token refresh. Please disconnect and reconnect your Strava account.', needsReconnect: true },
          { status: 401 }
        );
      }
      console.log('✅ Successfully retried after token refresh');
    }

    // Handle Strava rate limit (429) — surface it clearly so the client can back off
    if (!result.activities && result.error && result.error.status === 429) {
      const { message, isDaily } = getRateLimitMessage(result.error);
      console.warn(`⏳ Strava rate limit hit (429): ${message}`);
      return NextResponse.json(
        { error: message, rateLimited: true, isDailyLimit: isDaily },
        { status: 429 }
      );
    }

    // Handle other errors
    if (!result.activities && result.error) {
      const errorData = await result.error.json().catch(() => ({ message: 'Unknown error' }));
      console.error('❌ Strava API error:', { status: result.error.status, error: errorData });
      return NextResponse.json(
        { error: `Failed to fetch Strava activities: ${errorData.message || 'Unknown error'}`, details: errorData },
        { status: 500 }
      );
    }

    const activities = result.activities || [];
    console.log(`✅ Fetched ${activities.length} activities`);

    // ── Filter already-imported activities ──
    let activitiesToProcess: any[];

    if (quotaSafe) {
      // Quota-safe mode: skip the batch query. We use deterministic doc IDs (strava_{id})
      // so set() will just overwrite if they exist — no reads needed.
      activitiesToProcess = activities;
      console.log(`📦 Quota-safe: processing all ${activities.length} activities (using deterministic doc IDs)`);
    } else {
      // Normal mode: query existing Strava workout IDs to filter duplicates
      const existingWorkoutsSnapshot = await adminDb
        .collection('users').doc(userId).collection('workouts')
        .where('source', '==', 'strava')
        .get();

      const existingStravaIds = new Set(
        existingWorkoutsSnapshot.docs.map(doc => String(doc.data().stravaActivityId))
      );

      console.log(`📊 Found ${existingStravaIds.size} existing Strava workouts`);

      activitiesToProcess = [];
      for (const activity of activities) {
        if (!existingStravaIds.has(String(activity.id))) {
          activitiesToProcess.push(activity);
        }
      }
      console.log(`🆕 Processing ${activitiesToProcess.length} new activities`);
    }

    // Parse duplicate decisions if provided
    const decisions: Record<string, { action: 'merge' | 'new'; workoutId?: string }> = duplicateDecisionsRaw
      ? JSON.parse(typeof duplicateDecisionsRaw === 'string' ? duplicateDecisionsRaw : JSON.stringify(duplicateDecisionsRaw))
      : {};

    // If checkDuplicates is true, find and return potential duplicates
    // (requires Firestore reads — only works when not quota-limited)
    if (checkDuplicates && !quotaSafe) {
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
    } else if (checkDuplicates && quotaSafe) {
      // Can't check duplicates without reads — skip and proceed with sync
      return NextResponse.json({
        success: true,
        hasDuplicates: false,
        duplicates: [],
        totalNewActivities: activitiesToProcess.length,
        quotaSafe: true,
      });
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

      // existingStravaIds (built from the batch query above) already filters duplicates —
      // no need for a per-activity Firestore read here

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
      let shouldCreate = false;

      if (!quotaSafe && decision?.action === 'merge' && decision.workoutId) {
        // User chose to merge with existing workout (requires writes only)
        console.log(`  🔗 Merging: ${activity.name}`);

        const mergeData: any = {
          completed: true,
          completedAt: admin.firestore.Timestamp.fromDate(activityDate),
          completedBy: 'strava',
          stravaActivityId: stravaId,
          actualStats,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await adminDb.collection('users').doc(userId).collection('workouts').doc(decision.workoutId).update(mergeData);
        mergedWorkoutsCount++;
      } else if (!quotaSafe) {
        // Normal mode: try auto-merge and proximity checks (require reads)
        const matchingWorkout = await findMatchingWorkout(userId, workoutType, activityDate);

        if (matchingWorkout && !decision) {
          console.log(`  🔗 Auto-merge: ${activity.name} → ${matchingWorkout.data.name}`);

          const autoMergeData: any = {
            completed: true,
            completedAt: admin.firestore.Timestamp.fromDate(activityDate),
            completedBy: 'strava',
            stravaActivityId: stravaId,
            actualStats,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          await adminDb.collection('users').doc(userId).collection('workouts').doc(matchingWorkout.id).update(autoMergeData);
          mergedWorkoutsCount++;
        } else {
          // Proximity duplicate check (requires reads)
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
            if (pData.stravaActivityId === stravaId) continue;
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
            // Fall through to create workout below
            shouldCreate = true;
          }
        }
      } else {
        // Quota-safe mode: skip merge/proximity checks, go straight to create.
        // Deterministic doc ID (strava_{id}) handles duplicates via set() overwrite.
        shouldCreate = true;
      }

      // Before creating, check if there's a matching imported (CSV/XLSX) workout to merge with
      if (shouldCreate) {
        try {
          const importedMatch = await findMatchingImportedWorkout(
            userId, workoutType, activityDate, activity.distance || 0
          );
          if (importedMatch) {
            console.log(`  📎 Merging Strava → imported: ${activity.name} → ${importedMatch.data.name}`);
            const mergeUpdate: any = {
              stravaActivityId: stravaId,
              actualStats,
              source: 'strava', // upgrade source to strava
              completedBy: 'strava',
              completedAt: admin.firestore.Timestamp.fromDate(activityDate),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            // Add route data if Strava has it
            if (activity.map?.summary_polyline) {
              mergeUpdate.routeData = {
                polyline: activity.map.summary_polyline,
                ...(activity.start_latlng ? { startLatLng: activity.start_latlng } : {}),
                ...(activity.end_latlng ? { endLatLng: activity.end_latlng } : {}),
              };
            }
            // Fetch photos
            if (activity.total_photo_count > 0) {
              const photoUrls = await fetchStravaPhotos(String(activity.id), accessToken);
              if (photoUrls.length > 0) mergeUpdate.photos = photoUrls;
            }
            await adminDb.collection('users').doc(userId).collection('workouts').doc(importedMatch.id).update(mergeUpdate);
            mergedWorkoutsCount++;
            shouldCreate = false;
          }
        } catch (e: any) {
          console.log(`  ⚠️ Import merge check failed (non-fatal): ${e.message}`);
        }
      }

      if (shouldCreate) {
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

      // Mark as processed
      processedInThisSync.add(stravaId);

      // Small delay between activities
      if (i < activitiesToProcess.length - 1) {
        await delay(200);
      }
    }

    console.log(`✅ Finished: Created ${newWorkoutsCount}, merged ${mergedWorkoutsCount}, skipped ${skippedCount}`);

    // ── Update sync tracking timestamps on user doc ──
    try {
      const syncUpdate: Record<string, any> = {
        lastStravaSync: Math.floor(Date.now() / 1000),
      };
      if (syncMode === 'backfill') {
        // Track backfill progress — if we got fewer than 200 activities, backfill is complete
        if (activities.length < 200) {
          syncUpdate.lastStravaFullBackfill = Math.floor(Date.now() / 1000);
          syncUpdate.stravaBackfillPage = admin.firestore.FieldValue.delete();
          console.log('✅ Backfill complete — all historical activities fetched');
        } else {
          syncUpdate.stravaBackfillPage = fetchPage;
          console.log(`📄 Backfill page ${fetchPage} done (${activities.length} activities) — more pages remain`);
        }
      }
      await adminDb.collection('users').doc(userId).update(syncUpdate);
    } catch (err) {
      console.error('⚠️ Failed to update sync timestamps (non-fatal):', err);
    }

    // Run Groq dedup only on full sync (year or no period specified) — skip for partial syncs and quota-safe mode
    let dedupInfo: any = null;
    if (!quotaSafe && (!period || period === 'year')) {
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
    } else {
      console.log(`⏩ Skipping dedup for partial sync (period=${period})`);
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

    // Send push notification if new workouts were synced
    if (newWorkoutsCount > 0 || mergedWorkoutsCount > 0) {
      sendPushNotification(userId, {
        title: '🏃 Strava Sync Complete',
        body: message,
        url: '/workouts',
      }).catch(() => {}); // non-fatal, fire and forget
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
      mode: syncMode,
      period: period || (syncMode === 'backfill' ? 'backfill' : 'month'),
      newWorkouts: newWorkoutsCount,
      mergedWorkouts: mergedWorkoutsCount,
      totalActivities: activities.length,
      message,
      dedup: dedupInfo,
      // Backfill signals: client uses these to decide whether to fetch next page
      ...(syncMode === 'backfill' && {
        backfillPage: fetchPage,
        backfillComplete: activities.length < 200,
      }),
    });
  } catch (error: any) {
    console.error('Strava sync error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to sync Strava activities';
    const isQuota = errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded') || error.code === 8;
    return NextResponse.json(
      {
        error: isQuota
          ? 'Firebase daily quota reached. Your workouts are safe — try syncing again tomorrow.'
          : errMsg,
        isQuota,
      },
      { status: isQuota ? 429 : 500 }
    );
  }
}
