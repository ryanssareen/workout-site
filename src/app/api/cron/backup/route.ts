export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createBackup, createSeedBackup, compactFullBackup, BackupType } from '@/lib/backup';
import { logAdminAction } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

// GET — called by Vercel cron
// ?type=daily|weekly|monthly
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const type = (request.nextUrl.searchParams.get('type') ?? 'daily') as BackupType;
  const validTypes: BackupType[] = ['daily', 'weekly', 'monthly'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    let result: { id: string; tier?: string; userCount: number; workoutCount: number; storagePath?: string | null };

    if (type === 'daily') {
      // Daily: metadata-only checkpoint (counts, no data upload)
      // Cost: ~N+1 Firestore reads (1 users query + 1 count per user)
      result = { ...await createBackup('daily', 'cron'), tier: 'metadata' };
    } else if (type === 'weekly') {
      // Weekly: metadata-only (same as daily) to save Firestore reads
      // Full snapshots only run on-demand via admin download button
      result = { ...await createBackup('weekly', 'cron'), tier: 'metadata' };
    } else {
      // Monthly: compact from existing full + deltas in Blob (0 Firestore data reads)
      result = await compactFullBackup('cron');
    }

    await logAdminAction('cron', 'cron_backup', {
      type,
      tier: result.tier ?? 'unknown',
      backupId: result.id,
      userCount: result.userCount,
      workoutCount: result.workoutCount,
      storagePath: (result as any).storagePath ?? null,
      durationMs: Date.now() - startTime,
    });

    try {
      const db = getAdminDb();
      await db
        .collection('system')
        .doc('lastCron')
        .set(
          { [`backup_${type}`]: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      success: true,
      type,
      ...result,
      durationMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error(`Backup cron (${type}) failed:`, err);

    try {
      await logAdminAction('cron', 'cron_backup_failed', {
        type,
        error: err.message,
        durationMs: Date.now() - startTime,
      });
    } catch {
      // non-fatal
    }

    const details = err.details || err.code || '';
    return NextResponse.json({ success: false, error: err.message, details }, { status: 500 });
  }
}
