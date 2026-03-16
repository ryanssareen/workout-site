export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, logAdminAction } from '@/lib/admin-auth';

const BATCH_SIZE = 490;

function buildTypeFieldsFromStats(
  type: string,
  actualStats: any,
  durationMin: number
): Record<string, any> {
  const distKm = (actualStats.distance || 0) / 1000;
  const fields: Record<string, any> = {};

  if (type === 'run') {
    fields.run = {
      distance: Math.round(distKm * 100) / 100,
      distanceUnit: 'km',
      time: durationMin,
      ...(actualStats.elevationGain ? { elevationGain: Math.round(actualStats.elevationGain) } : {}),
      ...(actualStats.avgHeartRate ? { avgHeartRate: Math.round(actualStats.avgHeartRate) } : {}),
      ...(distKm > 0 && durationMin > 0 ? {
        pace: `${Math.floor(durationMin / distKm)}:${String(Math.round(((durationMin / distKm) % 1) * 60)).padStart(2, '0')}/km`
      } : {}),
    };
  } else if (type === 'bike') {
    fields.bike = {
      distance: Math.round(distKm * 100) / 100,
      distanceUnit: 'km',
      time: durationMin,
      ...(actualStats.elevationGain ? { elevationGain: Math.round(actualStats.elevationGain) } : {}),
      ...(actualStats.avgPower ? { avgPower: Math.round(actualStats.avgPower) } : {}),
    };
  } else if (type === 'swim') {
    fields.swim = {
      distance: Math.round(actualStats.distance || 0),
      distanceUnit: 'meters',
      time: durationMin,
    };
  }
  return fields;
}

// Shared auth: admin session OR secret query param for browser access
async function authenticate(request: NextRequest): Promise<{ uid: string } | null> {
  // Allow ?secret=ADMIN_SECRET for browser GET access
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret && secret === process.env.ADMIN_SECRET) {
    return { uid: 'admin-via-secret' };
  }
  // Fall back to admin session cookie
  return verifyAdminSession(request);
}

// GET/POST — one-time migration to backfill merged workouts missing date/duration/type-specific fields
// ?dryRun=true to preview without writing
// ?secret=ADMIN_SECRET for browser access
export async function GET(request: NextRequest) {
  return runMigration(request);
}

export async function POST(request: NextRequest) {
  return runMigration(request);
}

// Fix a single workout by ID — 1 read, 1 write
// ?username=X&workoutId=Y (required) &dryRun=true (optional)
async function fixSingleWorkout(request: NextRequest) {
  const session = await authenticate(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const username = request.nextUrl.searchParams.get('username');
  const workoutId = request.nextUrl.searchParams.get('workoutId');
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';

  if (!username || !workoutId) {
    return NextResponse.json({ error: 'Required: ?username=X&workoutId=Y' }, { status: 400 });
  }

  const db = getAdminDb();

  try {
    const docRef = db.collection('users').doc(username).collection('workouts').doc(workoutId);
    const doc = await docRef.get(); // 1 read

    if (!doc.exists) {
      return NextResponse.json({ error: `Workout ${workoutId} not found for user ${username}` }, { status: 404 });
    }

    const data = doc.data()!;
    const type = data.type as string;
    const typeKey = type === 'run' ? 'run' : type === 'bike' ? 'bike' : type === 'swim' ? 'swim' : null;

    const update: Record<string, any> = {};

    // Fix date: copy completedAt → date if date is stuck at 12:00
    if (data.completedAt && data.date) {
      const dateVal = data.date.toDate ? data.date.toDate() : new Date(data.date);
      const completedVal = data.completedAt.toDate ? data.completedAt.toDate() : new Date(data.completedAt);
      const dateHours = dateVal.getHours();
      const dateMinutes = dateVal.getMinutes();
      if (dateHours === 12 && dateMinutes === 0 && dateVal.getTime() !== completedVal.getTime()) {
        update.date = data.completedAt;
      }
    }

    // Fix duration
    if (data.actualStats?.duration && (!data.duration || data.duration === 0)) {
      update.duration = Math.round(data.actualStats.duration / 60);
    }

    // Build type-specific sub-object if missing
    if (typeKey && data.actualStats && (!data[typeKey] || Object.keys(data[typeKey]).length === 0)) {
      const durationMin = data.actualStats.duration
        ? Math.round(data.actualStats.duration / 60)
        : (data.duration || 0);
      Object.assign(update, buildTypeFieldsFromStats(type, data.actualStats, durationMin));
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No fixes needed for this workout',
        dryRun,
        currentDate: data.date?.toDate?.()?.toISOString() ?? null,
        currentCompletedAt: data.completedAt?.toDate?.()?.toISOString() ?? null,
        hasTypeFields: typeKey ? !!data[typeKey] : 'n/a',
      });
    }

    if (!dryRun) {
      await docRef.update(update); // 1 write
    }

    return NextResponse.json({
      success: true,
      dryRun,
      workoutId,
      username,
      fieldsUpdated: Object.keys(update),
      ...(update.date ? { newDate: data.completedAt?.toDate?.()?.toISOString() } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function runMigration(request: NextRequest) {
  const session = await authenticate(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Single workout mode: ?username=X&workoutId=Y — just 1 read
  const workoutId = request.nextUrl.searchParams.get('workoutId');
  if (workoutId) {
    return fixSingleWorkout(request);
  }

  // Require username to prevent accidental all-user scans
  const targetUsername = request.nextUrl.searchParams.get('username');
  if (!targetUsername) {
    return NextResponse.json({
      error: 'Required: ?username=X or ?username=X&workoutId=Y. Will not scan all users to protect read quota.',
    }, { status: 400 });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const db = getAdminDb();

  try {
    let totalMigrated = 0;
    let totalScanned = 0;
    const byType: Record<string, number> = {};
    let batch = db.batch();
    let batchCount = 0;

    const workoutsSnap = await db
      .collection('users')
      .doc(targetUsername)
      .collection('workouts')
      .where('mergeMeta.method', 'in', ['auto_planned', 'auto_import', 'manual', 'duplicate_decision'])
      .get();

    for (const workoutDoc of workoutsSnap.docs) {
      totalScanned++;
      const data = workoutDoc.data();
      const type = data.type as string;
      const typeKey = type === 'run' ? 'run' : type === 'bike' ? 'bike' : type === 'swim' ? 'swim' : null;

      const update: Record<string, any> = {};
      let needsUpdate = false;

      if (data.completedAt && data.date) {
        const dateVal = data.date.toDate ? data.date.toDate() : new Date(data.date);
        const completedVal = data.completedAt.toDate ? data.completedAt.toDate() : new Date(data.completedAt);
        const dateHours = dateVal.getHours();
        const dateMinutes = dateVal.getMinutes();
        if (dateHours === 12 && dateMinutes === 0 && dateVal.getTime() !== completedVal.getTime()) {
          update.date = data.completedAt;
          needsUpdate = true;
        }
      }

      if (data.actualStats?.duration && (!data.duration || data.duration === 0)) {
        update.duration = Math.round(data.actualStats.duration / 60);
        needsUpdate = true;
      }

      if (typeKey && data.actualStats && (!data[typeKey] || Object.keys(data[typeKey]).length === 0)) {
        const durationMin = data.actualStats.duration
          ? Math.round(data.actualStats.duration / 60)
          : (data.duration || 0);
        Object.assign(update, buildTypeFieldsFromStats(type, data.actualStats, durationMin));
        needsUpdate = true;
      }

      if (!needsUpdate) continue;

      if (!dryRun) {
        batch.update(workoutDoc.ref, update);
        batchCount++;
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      totalMigrated++;
      byType[type] = (byType[type] || 0) + 1;
    }

    if (!dryRun && batchCount > 0) {
      await batch.commit();
    }

    if (!dryRun) {
      await logAdminAction(session.uid, 'migrate_merged_workouts', {
        username: targetUsername,
        totalScanned,
        totalMigrated,
        byType,
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      username: targetUsername,
      totalScanned,
      totalMigrated,
      byType,
    });
  } catch (err: any) {
    console.error('Migration failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
