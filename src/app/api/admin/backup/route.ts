export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import { createBackup, BackupType } from '@/lib/backup';

// GET — list backups
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('backups')
      .orderBy('createdAt', 'desc')
      .limit(60)
      .get();

    const backups = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toMillis?.() ?? null,
    }));

    return NextResponse.json({ backups });
  } catch (err: any) {
    const msg = err.message ?? String(err);
    const isQuota = msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || err.code === 8;
    return NextResponse.json(
      { error: isQuota ? 'Firebase quota exceeded. Try again later.' : msg, isQuota },
      { status: isQuota ? 429 : 500 }
    );
  }
}

// POST — trigger a manual backup
export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  let type: BackupType = 'manual';
  try {
    const body = await request.json();
    if (body.type) type = body.type as BackupType;
  } catch {
    // use default
  }

  try {
    const result = await createBackup(type, session.uid);
    await logAdminAction(session.uid, 'backup_triggered', {
      backupId: result.id,
      type,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    const msg = err.message ?? String(err);
    const isQuota = msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || err.code === 8;
    return NextResponse.json(
      { error: isQuota ? 'Firebase quota exceeded. Try again later.' : msg, isQuota },
      { status: isQuota ? 429 : 500 }
    );
  }
}
