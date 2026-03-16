export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import { BackupPayload } from '@/lib/backup';
import { getAdminDb, getAdminStorage } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { gunzipSync } from 'zlib';

// POST — upload a local backup JSON as the seed full backup in Storage
// Body: gzip-compressed JSON (Content-Encoding: gzip) or raw JSON
export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  try {
    const raw = Buffer.from(await request.arrayBuffer());

    let jsonStr: string;
    const encoding = request.headers.get('content-encoding');
    if (encoding === 'gzip') {
      jsonStr = gunzipSync(raw).toString('utf-8');
    } else {
      jsonStr = raw.toString('utf-8');
    }

    const data: BackupPayload = JSON.parse(jsonStr);

    if (!data.users?.length || !data.workouts) {
      return NextResponse.json({ error: 'Invalid backup format — need users and workouts' }, { status: 400 });
    }

    // Upload to Firebase Storage
    const storagePath = `backups/full/${data.createdAt || new Date().toISOString()}.json`;
    const bucket = getAdminStorage();
    const file = bucket.file(storagePath);
    await file.save(jsonStr, { contentType: 'application/json', gzip: true });

    // Register metadata in Firestore
    const db = getAdminDb();
    const metaRef = await db.collection('backups').add({
      type: 'manual' as const,
      tier: 'full' as const,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userCount: data.userCount ?? data.users.length,
      workoutCount: data.workoutCount ?? 0,
      integrityPassed: data.users.length > 0,
      triggeredBy: session.uid,
      storagePath,
    });

    await logAdminAction(session.uid, 'backup_seed_uploaded', {
      backupId: metaRef.id,
      userCount: data.userCount,
      workoutCount: data.workoutCount,
      storagePath,
      originalCreatedAt: data.createdAt,
    });

    return NextResponse.json({
      success: true,
      id: metaRef.id,
      userCount: data.userCount ?? data.users.length,
      workoutCount: data.workoutCount ?? 0,
      storagePath,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
