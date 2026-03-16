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

async function runMigration(request: NextRequest) {
  const session = await authenticate(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const db = getAdminDb();

  try {
    const usersSnap = await db.collection('users').get();
    let totalMigrated = 0;
    let totalScanned = 0;
    const byType: Record<string, number> = {};
    let batch = db.batch();
    let batchCount = 0;

    for (const userDoc of usersSnap.docs) {
      const username = userDoc.id;
      const workoutsSnap = await db
        .collection('users')
        .doc(username)
        .collection('workouts')
        .where('completedBy', '==', 'strava')
        .get();

      for (const workoutDoc of workoutsSnap.docs) {
        totalScanned++;
        const data = workoutDoc.data();

        // Only migrate workouts that were merged (have mergeMeta)
        if (!data.mergeMeta) continue;

        const type = data.type as string;
        const typeKey = type === 'run' ? 'run' : type === 'bike' ? 'bike' : type === 'swim' ? 'swim' : null;

        // Skip if type-specific sub-object already exists and has data
        if (typeKey && data[typeKey] && Object.keys(data[typeKey]).length > 0) continue;

        // Skip if no actualStats to build from
        if (!data.actualStats) continue;

        // Build update
        const update: Record<string, any> = {};

        // Fix date: copy completedAt → date (fixes the 12:00 issue)
        if (data.completedAt) {
          update.date = data.completedAt;
        }

        // Fix duration from actualStats
        if (data.actualStats.duration) {
          update.duration = Math.round(data.actualStats.duration / 60);
        }

        // Build type-specific sub-object from actualStats
        const durationMin = data.actualStats.duration
          ? Math.round(data.actualStats.duration / 60)
          : (data.duration || 0);

        if (typeKey) {
          Object.assign(update, buildTypeFieldsFromStats(type, data.actualStats, durationMin));
        }

        if (Object.keys(update).length === 0) continue;

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
    }

    // Commit remaining batch
    if (!dryRun && batchCount > 0) {
      await batch.commit();
    }

    if (!dryRun) {
      await logAdminAction(session.uid, 'migrate_merged_workouts', {
        totalScanned,
        totalMigrated,
        byType,
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      totalScanned,
      totalMigrated,
      byType,
    });
  } catch (err: any) {
    console.error('Migration failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
