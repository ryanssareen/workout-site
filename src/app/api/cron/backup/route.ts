export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createBackup, BackupType } from '@/lib/backup';
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
    const result = await createBackup(type, 'cron');

    // Log to adminLogs
    await logAdminAction('cron', 'cron_backup', {
      type,
      backupId: result.id,
      userCount: result.userCount,
      workoutCount: result.workoutCount,
      durationMs: Date.now() - startTime,
    });

    // Update system/lastCron doc for health monitoring
    try {
      const db = getAdminDb();
      await db
        .collection('system')
        .doc('lastCron')
        .set(
          {
            [`backup_${type}`]: admin.firestore.FieldValue.serverTimestamp(),
          },
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

    // Log failure
    try {
      await logAdminAction('cron', 'cron_backup_failed', {
        type,
        error: err.message,
        durationMs: Date.now() - startTime,
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
