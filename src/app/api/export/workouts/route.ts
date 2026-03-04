export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { adminResolveUsername } from '@/lib/firebase/adminUserMapping';

// ─── Value helpers (same as MCP route) ───────────────────────────────────────

type WorkoutDoc = Record<string, unknown>;

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
      const parsed = (value as { toDate: () => Date }).toDate();
      if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function toSafeWorkout(id: string, data: WorkoutDoc) {
  return {
    id,
    name: toOptionalString(data.name),
    type: toOptionalString(data.type),
    date: toIsoString(data.date),
    completed: data.completed === true,
    duration: toOptionalNumber(data.duration),
    assignedTo: toOptionalString(data.assignedTo),
    assignedToName: toOptionalString(data.assignedToName),
    createdBy: toOptionalString(data.createdBy),
    description: toOptionalString(data.description),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    source: toOptionalString(data.source),
    completedAt: toIsoString(data.completedAt),
    completedLate: typeof data.completedLate === 'boolean' ? data.completedLate : null,
    rating: toOptionalNumber(data.rating),
    feedback: toOptionalString(data.feedback),
    swim: data.swim ?? null,
    bike: data.bike ?? null,
    run: data.run ?? null,
    strength: data.strength ?? null,
    other: data.other ?? null,
    photos: Array.isArray(data.photos) ? data.photos : null,
    stravaActivityId: toOptionalString(data.stravaActivityId),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function isAuthorizedApiKey(candidate: string | null, expected: string): boolean {
  if (!candidate) return false;
  const nc = candidate.trim();
  const ne = expected.trim();
  if (!nc || !ne) return false;
  const cb = Buffer.from(nc);
  const eb = Buffer.from(ne);
  if (cb.length !== eb.length) return false;
  return timingSafeEqual(cb, eb);
}

function getApiKeyFromRequest(request: NextRequest): string | null {
  const directKey = request.headers.get('x-api-key');
  if (directKey) return directKey;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, ...tokenParts] = authHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || tokenParts.length === 0) return null;
  return tokenParts.join(' ') || null;
}

// ─── GET /api/export/workouts ────────────────────────────────────────────────

const DEFAULT_EMAIL = 'rsareen+rupesh@gmail.com';

export async function GET(request: NextRequest) {
  // Auth check
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfigured: MCP_API_KEY not set' }, { status: 500 });
  }

  const providedKey = getApiKeyFromRequest(request);
  if (!isAuthorizedApiKey(providedKey, apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getFirebaseAdminDb();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || DEFAULT_EMAIL;
    const includeAll = searchParams.get('all') === 'true';

    // 1. Find user by email
    const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();

    if (usersSnapshot.empty) {
      return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const username = userDoc.id; // doc.id is now username

    // 2. Query workouts from subcollection
    const workoutsCol = db.collection('users').doc(username).collection('workouts');
    let workoutsQuery = workoutsCol.orderBy('date', 'desc');

    if (!includeAll) {
      workoutsQuery = workoutsCol
        .where('completed', '==', false)
        .orderBy('date', 'desc');
    }

    const workoutsSnapshot = await workoutsQuery.get();
    const workouts = workoutsSnapshot.docs.map((doc) =>
      toSafeWorkout(doc.id, doc.data() as WorkoutDoc)
    );

    // 3. Return JSON
    return NextResponse.json({
      user: {
        username,
        email: userData.email ?? email,
        displayName: userData.displayName ?? null,
        role: userData.role ?? null,
      },
      filter: includeAll ? 'all' : 'planned',
      count: workouts.length,
      exportedAt: new Date().toISOString(),
      workouts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[export/workouts] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
