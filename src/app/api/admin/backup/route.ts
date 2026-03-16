export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import {
  createBackup,
  createSeedBackup,
  createDeltaBackup,
  compactFullBackup,
  BackupType,
} from '@/lib/backup';

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

    const backups = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        createdAt: d.createdAt?.toMillis?.() ?? null,
        basedOnTimestamp: d.basedOnTimestamp?.toMillis?.() ?? null,
      };
    });

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
// Body: { tier?: 'full' | 'delta' | 'compact', type?: BackupType }
//   - 'full' (default): createSeedBackup — full snapshot to Storage (reads all Firestore docs)
//   - 'delta': createDeltaBackup — only changed docs since last backup
//   - 'compact': compactFullBackup — merge full+deltas from Storage (0 Firestore data reads)
//   - 'legacy': createBackup — metadata-only snapshot (old behavior)
export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  let tier: string = 'full';
  let type: BackupType = 'manual';
  try {
    const body = await request.json();
    if (body.tier) tier = body.tier;
    if (body.type) type = body.type as BackupType;
  } catch {
    // use defaults
  }

  try {
    let result;

    switch (tier) {
      case 'delta':
        result = await createDeltaBackup('manual' as any, session.uid);
        break;
      case 'compact':
        result = await compactFullBackup(session.uid);
        break;
      case 'legacy':
        // Old metadata-only behavior
        const legacyResult = await createBackup(type, session.uid);
        await logAdminAction(session.uid, 'backup_triggered', {
          backupId: legacyResult.id,
          type,
          tier: 'legacy',
        });
        return NextResponse.json({ success: true, ...legacyResult });
      case 'full':
      default:
        result = await createSeedBackup(session.uid);
        break;
    }

    await logAdminAction(session.uid, 'backup_triggered', {
      backupId: result.id,
      type: tier === 'compact' ? 'monthly' : 'manual',
      tier: result.tier,
      storagePath: result.storagePath,
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
