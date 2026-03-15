import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebase/admin';
import { getDayKey, normalizeTimezone } from '@/lib/dayKey';

export async function POST(req: NextRequest) {
  try {
    const { ownerUsername, plannedWorkoutId, stravaWorkoutId } = await req.json();

    if (!ownerUsername || !plannedWorkoutId || !stravaWorkoutId) {
      return NextResponse.json(
        { error: 'Missing required fields: ownerUsername, plannedWorkoutId, stravaWorkoutId' },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const workoutsCol = db.collection('users').doc(ownerUsername).collection('workouts');

    // Read user + both workout docs
    const [userSnap, plannedSnap, stravaSnap] = await Promise.all([
      db.collection('users').doc(ownerUsername).get(),
      workoutsCol.doc(plannedWorkoutId).get(),
      workoutsCol.doc(stravaWorkoutId).get(),
    ]);

    if (!plannedSnap.exists) {
      return NextResponse.json({ error: 'Planned workout not found' }, { status: 404 });
    }
    if (!stravaSnap.exists) {
      return NextResponse.json({ error: 'Strava workout not found (may have already been merged)' }, { status: 404 });
    }

    const planned = plannedSnap.data()!;
    const strava = stravaSnap.data()!;

    // Validate planned workout state
    if (planned.completed) {
      return NextResponse.json({ error: 'Planned workout is already completed' }, { status: 400 });
    }
    if (planned.source === 'strava') {
      return NextResponse.json({ error: 'Cannot merge into a Strava workout' }, { status: 400 });
    }

    // Validate Strava workout state
    if (strava.source !== 'strava') {
      return NextResponse.json({ error: 'Target workout is not a Strava workout' }, { status: 400 });
    }
    if (!strava.completed) {
      return NextResponse.json({ error: 'Strava workout is not completed' }, { status: 400 });
    }

    // Validate same type
    if (planned.type !== strava.type) {
      return NextResponse.json(
        { error: `Type mismatch: planned is ${planned.type}, Strava is ${strava.type}` },
        { status: 400 },
      );
    }

    const userTimezone = normalizeTimezone(userSnap.data()?.timezone);
    const toDate = (ts: FirebaseFirestore.Timestamp | Date | string): Date =>
      typeof ts === 'object' && ts !== null && 'toDate' in ts ? ts.toDate() : new Date(ts as string);

    const plannedDate = toDate(planned.date as FirebaseFirestore.Timestamp);
    const stravaDate = toDate(strava.date as FirebaseFirestore.Timestamp);
    const plannedDayKey = getDayKey(plannedDate, userTimezone);
    const stravaDayKey = getDayKey(stravaDate, userTimezone);

    if (plannedDayKey !== stravaDayKey) {
      return NextResponse.json(
        {
          error: `Date mismatch: planned is ${plannedDayKey}, Strava is ${stravaDayKey} in timezone ${userTimezone}. Workouts must be on the same day.`,
        },
        { status: 400 },
      );
    }

    const mergedAtIso = new Date().toISOString();
    // Build merge data — must match auto-merge shape from sync route
    const mergeData: Record<string, unknown> = {
      completed: true,
      completedAt: strava.completedAt || strava.date,
      completedBy: 'strava',
      stravaActivityId: strava.stravaActivityId,
      actualStats: strava.actualStats || {},
      mergeMeta: {
        method: 'manual',
        mergedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'strava',
        sourceWorkoutId: stravaWorkoutId,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Copy optional Strava-enriched fields if present
    if (strava.routeData) mergeData.routeData = strava.routeData;
    if (strava.hasStravaPhotos) mergeData.hasStravaPhotos = true;
    if (strava.laps) mergeData.laps = strava.laps;
    if (strava.splits) mergeData.splits = strava.splits;
    if (strava.splitsMetric) mergeData.splitsMetric = strava.splitsMetric;
    if (strava.splitsStandard) mergeData.splitsStandard = strava.splitsStandard;
    if (strava.stravaExtended) mergeData.stravaExtended = strava.stravaExtended;
    if (strava.photos && strava.photos.length > 0) mergeData.photos = strava.photos;
    if (strava.stravaDetailsFetched) mergeData.stravaDetailsFetched = true;
    if (strava.stravaData) mergeData.stravaData = strava.stravaData;

    // Atomic batch: update planned + delete standalone Strava doc
    const batch = db.batch();
    batch.update(workoutsCol.doc(plannedWorkoutId), mergeData);
    batch.delete(workoutsCol.doc(stravaWorkoutId));
    await batch.commit();

    console.log(`🔗 Manual merge: ${stravaWorkoutId} → ${plannedWorkoutId} for ${ownerUsername}`);

    return NextResponse.json({
      success: true,
      mergedWorkoutId: plannedWorkoutId,
      mergeMethod: 'manual',
      mergedAt: mergedAtIso,
    });
  } catch (error: unknown) {
    console.error('Manual merge error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
