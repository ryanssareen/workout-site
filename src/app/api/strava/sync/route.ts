export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { sendPushNotification } from '@/lib/push';
import { getDayKey, normalizeTimezone } from '@/lib/dayKey';

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

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  );
  return Math.max(1, Math.ceil((nextUtcMidnight - now.getTime()) / 1000));
}

function getRateLimitMessage(resp: Response): {
  message: string;
  isDaily: boolean;
  isCooldown: boolean;
  retryAfterSeconds: number;
  rateLimitScope: 'daily' | 'window15' | 'cooldown';
} {
  const limits = parseStravaRateLimits(resp);
  if (limits) {
    const isDailyExceeded = limits.dailyUsage >= limits.dailyLimit;
    const is15MinExceeded = limits.fifteenMinUsage >= limits.fifteenMinLimit;
    if (isDailyExceeded) {
      return {
        message: `Strava daily limit reached (${limits.dailyUsage}/${limits.dailyLimit}). Resets at midnight UTC.`,
        isDaily: true,
        isCooldown: false,
        retryAfterSeconds: secondsUntilUtcMidnight(),
        rateLimitScope: 'daily',
      };
    }
    if (is15MinExceeded) {
      return {
        message: `Strava 15-min limit reached (${limits.fifteenMinUsage}/${limits.fifteenMinLimit}). Try again in ~15 minutes.`,
        isDaily: false,
        isCooldown: false,
        retryAfterSeconds: 900,
        rateLimitScope: 'window15',
      };
    }
    // 429 returned but counters under limit — window just rolled over, brief cooldown
    return {
      message: `Strava rate limit cooldown (${limits.fifteenMinUsage}/${limits.fifteenMinLimit} 15-min, ${limits.dailyUsage}/${limits.dailyLimit} daily). Try again in a minute.`,
      isDaily: false,
      isCooldown: true,
      retryAfterSeconds: 60,
      rateLimitScope: 'cooldown',
    };
  }
  return {
    message: 'Strava rate limit reached. Try again in a few minutes.',
    isDaily: false,
    isCooldown: false,
    retryAfterSeconds: 60,
    rateLimitScope: 'cooldown',
  };
}

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

function getDateFromValue(value: any): Date {
  if (!value) return new Date(0);
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

function getActivityDistanceMeters(activity: any): number {
  return activity.distance || 0;
}

function getActivityDurationSeconds(activity: any): number {
  return activity.moving_time || 0;
}

function getWorkoutDistanceMeters(workout: any, workoutType: string): number {
  if (workout.actualStats?.distance) return workout.actualStats.distance;
  if (workoutType === 'run' && workout.run?.distance) {
    const unit = workout.run.distanceUnit || 'km';
    return unit === 'miles' ? workout.run.distance * 1609.34 : workout.run.distance * 1000;
  }
  if (workoutType === 'bike' && workout.bike?.distance) {
    const unit = workout.bike.distanceUnit || 'km';
    return unit === 'miles' ? workout.bike.distance * 1609.34 : workout.bike.distance * 1000;
  }
  if (workoutType === 'swim' && workout.swim?.distance) {
    const unit = workout.swim.distanceUnit || 'meters';
    return unit === 'yards' ? workout.swim.distance * 0.9144 : workout.swim.distance;
  }
  return 0;
}

function getWorkoutDurationSeconds(workout: any, workoutType: string): number {
  if (workout.actualStats?.duration) return workout.actualStats.duration;
  if (workoutType === 'run' && workout.run?.time) return workout.run.time * 60;
  if (workoutType === 'bike' && workout.bike?.time) return workout.bike.time * 60;
  if (workoutType === 'swim' && workout.swim?.time) return workout.swim.time * 60;
  if (workout.strength?.totalTime) return workout.strength.totalTime * 60;
  if (workout.duration) return workout.duration * 60;
  return 0;
}

function tokenizeName(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1)
  );
}

function nameOverlapScore(a: string, b: string): number {
  const aTokens = tokenizeName(a);
  const bTokens = tokenizeName(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection++;
  }
  const union = new Set([...aTokens, ...bTokens]).size;
  return union > 0 ? intersection / union : 0;
}

function scorePlannedCandidate(
  activity: any,
  workout: any,
  workoutType: string
): {
  score: number;
  confidence: number;
  distanceScore: number;
  durationScore: number;
  nameScore: number;
  timeScore: number;
} {
  const activityDistance = getActivityDistanceMeters(activity);
  const workoutDistance = getWorkoutDistanceMeters(workout, workoutType);
  const activityDuration = getActivityDurationSeconds(activity);
  const workoutDuration = getWorkoutDurationSeconds(workout, workoutType);

  let distanceScore = 0;
  if (activityDistance > 0 && workoutDistance > 0) {
    const ratio = Math.abs(activityDistance - workoutDistance) / Math.max(activityDistance, workoutDistance);
    if (ratio <= 0.1) {
      distanceScore = 40;
    } else if (ratio <= 0.5) {
      distanceScore = Math.round(40 * (1 - ((ratio - 0.1) / 0.4)));
    }
  }

  let durationScore = 0;
  if (activityDuration > 0 && workoutDuration > 0) {
    const ratio = Math.abs(activityDuration - workoutDuration) / Math.max(activityDuration, workoutDuration);
    if (ratio <= 0.2) {
      durationScore = 30;
    } else if (ratio <= 0.6) {
      durationScore = Math.round(30 * (1 - ((ratio - 0.2) / 0.4)));
    }
  }

  const overlap = nameOverlapScore(activity.name || '', workout.name || '');
  const exactName = (activity.name || '').trim().toLowerCase() === (workout.name || '').trim().toLowerCase();
  const nameScore = exactName ? 20 : Math.round(Math.min(1, overlap) * 20);

  // Time-of-day is intentionally ignored for merge matching.
  // Keep a neutral constant so existing thresholds still behave similarly.
  const timeScore = 10;

  const totalScore = distanceScore + durationScore + nameScore + timeScore;
  return {
    score: totalScore,
    confidence: Math.max(0, Math.min(100, Math.round(totalScore))),
    distanceScore,
    durationScore,
    nameScore,
    timeScore,
  };
}

interface ScoredMatch {
  id: string;
  data: any;
  score: number;
  confidence: number;
}

interface PlannedMatchResult {
  match: ScoredMatch | null;
  candidateCount: number;
  ambiguous: boolean;
}

function pickBestPlannedCandidate(
  activity: any,
  workoutType: string,
  candidates: Array<{ id: string; data: any }>,
  userTimezone: string
): PlannedMatchResult {
  const activityDate = new Date(activity.start_date_local || activity.start_date);
  const activityDayKey = getDayKey(activityDate, userTimezone);

  const sameDayCandidates = candidates.filter((candidate) => {
    const workout = candidate.data;
    if (workout.source === 'strava') return false;
    if (workout.completed) return false;
    if (workout.type !== workoutType) return false;
    const workoutDayKey = getDayKey(getDateFromValue(workout.date), userTimezone);
    return workoutDayKey === activityDayKey;
  });

  if (sameDayCandidates.length === 0) {
    return { match: null, candidateCount: 0, ambiguous: false };
  }

  const scored: ScoredMatch[] = sameDayCandidates
    .map((candidate) => {
      const score = scorePlannedCandidate(activity, candidate.data, workoutType);
      return {
        id: candidate.id,
        data: candidate.data,
        score: score.score,
        confidence: score.confidence,
      };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];
  const scoreGap = second ? top.score - second.score : top.score;
  const accepted = top.score >= 70 && scoreGap >= 15;

  if (!accepted) {
    return { match: null, candidateCount: scored.length, ambiguous: true };
  }

  return { match: top, candidateCount: scored.length, ambiguous: false };
}

// Find the best matching incomplete planned workout for a Strava activity
async function findMatchingWorkout(
  userId: string,
  workoutType: string,
  activity: any,
  userTimezone: string,
  candidatePool?: Array<{ id: string; data: any }>,
): Promise<PlannedMatchResult> {
  let candidates = candidatePool;

  if (!candidates) {
    const workoutsSnapshot = await adminDb
      .collection('users').doc(userId).collection('workouts')
      .where('type', '==', workoutType)
      .where('completed', '==', false)
      .get();
    candidates = workoutsSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  }

  return pickBestPlannedCandidate(activity, workoutType, candidates, userTimezone);
}

interface ImportedMatchResult {
  match: { id: string; data: any } | null;
  confidence: number;
  candidateCount: number;
}

function pickImportedMatch(
  activityDistance: number,
  candidates: Array<{ id: string; data: any }>
): ImportedMatchResult {
  let best: { id: string; data: any } | null = null;
  let bestConfidence = 0;
  let candidateCount = 0;

  for (const candidate of candidates) {
    const data = candidate.data;
    if (data.stravaActivityId) continue;
    candidateCount++;

    const importedDist = data.actualStats?.distance || 0;
    if (activityDistance > 0 && importedDist > 0) {
      const ratio = Math.abs(activityDistance - importedDist) / Math.max(activityDistance, importedDist);
      if (ratio < 0.10) {
        const confidence = Math.max(0, Math.min(100, Math.round((1 - ratio / 0.10) * 100)));
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          best = candidate;
        }
      }
    } else if (activityDistance === 0 && importedDist === 0) {
      const confidence = 80;
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        best = candidate;
      }
    }
  }

  return {
    match: best,
    confidence: best ? bestConfidence : 0,
    candidateCount,
  };
}

// Find a matching imported (CSV/XLSX) workout by date + type + near distance
async function findMatchingImportedWorkout(
  userId: string,
  workoutType: string,
  activityDate: Date,
  activityDistance: number, // in meters
  userTimezone: string,
  candidatePool?: Array<{ id: string; data: any }>,
): Promise<ImportedMatchResult> {
  const activityDayKey = getDayKey(activityDate, userTimezone);

  let candidates = candidatePool;
  if (!candidates) {
    const { start, end } = getDayBounds(activityDate);
    const workoutsSnapshot = await adminDb
      .collection('users').doc(userId).collection('workouts')
      .where('type', '==', workoutType)
      .where('source', '==', 'import')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(start))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(end))
      .get();
    candidates = workoutsSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  }

  const sameDayCandidates = candidates.filter((candidate) => {
    const data = candidate.data;
    if (data.type !== workoutType) return false;
    if (data.source !== 'import') return false;
    const dayKey = getDayKey(getDateFromValue(data.date), userTimezone);
    return dayKey === activityDayKey;
  });

  return pickImportedMatch(activityDistance, sameDayCandidates);
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
      const errBody = await response.text().catch(() => 'no body');
      console.error(`Failed to refresh Strava token (${response.status}): ${errBody}`);
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
      userTimezoneOverride: typeof body.userTimezone === 'string' ? body.userTimezone : undefined,
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
  userTimezoneOverride?: string;
  period?: string | null;
  afterParam?: string | null;
  quotaSafe: boolean;
  mode?: 'recent' | 'backfill';  // recent = last N days (default), backfill = paginated older history
  backfillPage?: number;          // page number for backfill mode (1-based)
}

async function handleSync(request: NextRequest, opts: SyncOptions) {
  try {
    const {
      userId,
      period, afterParam, quotaSafe, mode, backfillPage, userTimezoneOverride,
    } = opts;

    const syncMode = mode || 'recent';
    console.log(`🔄 Strava sync for ${userId} (mode=${syncMode}, quotaSafe=${quotaSafe}${backfillPage ? `, page=${backfillPage}` : ''})`);

    // ── Resolve Strava tokens ──
    let accessToken: string;
    let refreshToken: string | undefined;
    let userTimezone = normalizeTimezone(userTimezoneOverride);

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
      userTimezone = normalizeTimezone(userData.timezone);

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
      const { message, isDaily, isCooldown, retryAfterSeconds, rateLimitScope } = getRateLimitMessage(result.error);
      console.warn(`⏳ Strava rate limit hit (429): ${message}`);
      return NextResponse.json(
        {
          error: message,
          rateLimited: true,
          isDailyLimit: isDaily,
          isCooldown,
          retryAfterSeconds,
          rateLimitScope,
        },
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

    // Process activities one at a time to avoid duplicates
    let newWorkoutsCount = 0;
    let mergedWorkoutsCount = 0;
    let skippedCount = 0;
    const mergeStats = {
      autoPlannedMerged: 0,
      autoImportMerged: 0,
      ambiguousSkipped: 0,
    };

    // Helper function to delay between activities
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Track IDs we've already processed in this sync
    const processedInThisSync = new Set<string>();
    const workoutsCollection = adminDb.collection('users').doc(userId).collection('workouts');

    // Preload candidate pools once per sync batch (especially important for quota-safe mode)
    let plannedCandidatePool: Array<{ id: string; data: any }> = [];
    const importedCandidatePoolsByType: Record<string, Array<{ id: string; data: any }>> = {};
    if (activitiesToProcess.length > 0) {
      const activityDates = activitiesToProcess
        .map((activity) => new Date(activity.start_date_local || activity.start_date))
        .filter((date) => !Number.isNaN(date.getTime()));

      if (activityDates.length > 0) {
        const minTimestamp = Math.min(...activityDates.map((date) => date.getTime()));
        const maxTimestamp = Math.max(...activityDates.map((date) => date.getTime()));
        const rangeStart = new Date(minTimestamp - (24 * 60 * 60 * 1000));
        const rangeEnd = new Date(maxTimestamp + (24 * 60 * 60 * 1000));
        const activityTypes = [...new Set(activitiesToProcess.map((activity) => mapStravaType(activity.type)))];

        const [plannedSnapshot, ...importSnapshots] = await Promise.all([
          workoutsCollection.where('completed', '==', false).get(),
          ...activityTypes.map((type) =>
            workoutsCollection
              .where('type', '==', type)
              .where('source', '==', 'import')
              .where('date', '>=', admin.firestore.Timestamp.fromDate(rangeStart))
              .where('date', '<=', admin.firestore.Timestamp.fromDate(rangeEnd))
              .get()
          ),
        ]);

        plannedCandidatePool = plannedSnapshot.docs
          .map((doc) => ({ id: doc.id, data: doc.data() }))
          .filter((candidate) => candidate.data.source !== 'strava');

        for (let i = 0; i < activityTypes.length; i++) {
          importedCandidatePoolsByType[activityTypes[i]] = importSnapshots[i].docs.map((doc) => ({
            id: doc.id,
            data: doc.data(),
          }));
        }

        console.log(
          `📚 Preloaded candidates: ${plannedCandidatePool.length} planned/manual, ` +
          `${Object.values(importedCandidatePoolsByType).reduce((sum, list) => sum + list.length, 0)} imported`
        );
      }
    }

    for (let i = 0; i < activitiesToProcess.length; i++) {
      const activity = activitiesToProcess[i];
      const stravaId = String(activity.id);

      // Skip if already processed in this sync run
      if (processedInThisSync.has(stravaId)) {
        console.log(`  ⏭️ Already processed in this sync: ${activity.name}`);
        skippedCount++;
        continue;
      }

      console.log(`📦 Processing ${i + 1}/${activitiesToProcess.length}: ${activity.name}`);

      const activityDate = new Date(activity.start_date_local || activity.start_date);
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

      const baseMergeData = (): any => {
        const mergeData: any = {
          completed: true,
          completedAt: admin.firestore.Timestamp.fromDate(activityDate),
          completedBy: 'strava',
          stravaActivityId: stravaId,
          actualStats,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (Object.keys(routeData).length > 0) mergeData.routeData = routeData;
        if (activity.total_photo_count > 0) mergeData.hasStravaPhotos = true;
        return mergeData;
      };

      let shouldCreate = false;
      const plannedMatch = await findMatchingWorkout(
        userId,
        workoutType,
        activity,
        userTimezone,
        plannedCandidatePool
      );
      if (plannedMatch.ambiguous) {
        mergeStats.ambiguousSkipped++;
        console.log(`  ⚖️ Planned candidates ambiguous for ${activity.name}; skipping auto-planned merge`);
      }

      if (plannedMatch.match) {
        console.log(`  🔗 Auto-planned merge: ${activity.name} → ${plannedMatch.match.data.name} (${plannedMatch.match.score})`);
        await workoutsCollection.doc(plannedMatch.match.id).update({
          ...baseMergeData(),
          mergeMeta: {
            method: 'auto_planned',
            mergedAt: admin.firestore.FieldValue.serverTimestamp(),
            source: 'strava',
            confidence: plannedMatch.match.confidence,
            candidateCount: plannedMatch.candidateCount,
          },
        });
        plannedMatch.match.data.completed = true;
        plannedMatch.match.data.stravaActivityId = stravaId;
        mergedWorkoutsCount++;
        mergeStats.autoPlannedMerged++;
      } else {
        shouldCreate = true;
      }

      // Before creating, check if there's a matching imported (CSV/XLSX) workout to merge with
      if (shouldCreate) {
        try {
          const importedMatch = await findMatchingImportedWorkout(
            userId,
            workoutType,
            activityDate,
            activity.distance || 0,
            userTimezone,
            importedCandidatePoolsByType[workoutType] || []
          );
          if (importedMatch.match) {
            console.log(`  📎 Auto-import merge: ${activity.name} → ${importedMatch.match.data.name}`);
            await workoutsCollection.doc(importedMatch.match.id).update({
              ...baseMergeData(),
              source: 'strava',
              mergeMeta: {
                method: 'auto_import',
                mergedAt: admin.firestore.FieldValue.serverTimestamp(),
                source: 'strava',
                confidence: importedMatch.confidence,
                candidateCount: importedMatch.candidateCount,
              },
            });
            importedMatch.match.data.stravaActivityId = stravaId;
            importedMatch.match.data.source = 'strava';
            mergedWorkoutsCount++;
            mergeStats.autoImportMerged++;
            shouldCreate = false;
          }
        } catch (e: any) {
          console.log(`  ⚠️ Import merge check failed (non-fatal): ${e.message}`);
        }
      }

      if (shouldCreate) {
        console.log(`  ➕ Creating: ${activity.name}`);

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

        // Add route data if available
        if (Object.keys(routeData).length > 0) {
          newWorkoutData.routeData = routeData;
        }

        // Mark if activity has photos (loaded on-demand to save API calls)
        if (activity.total_photo_count > 0) {
          newWorkoutData.hasStravaPhotos = true;
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

        await workoutsCollection.doc(`strava_${stravaId}`).set(newWorkoutData);
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

    const dedupInfo: any = null;

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
      mergeStats,
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
