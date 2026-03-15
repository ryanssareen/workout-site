export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession } from '@/lib/admin-auth';

// GET — fetch admin action logs or cron logs
// ?type=actions (default) | ?type=cron
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = request.nextUrl.searchParams.get('type') ?? 'actions';

  try {
    const db = getAdminDb();
    let query = db.collection('adminLogs').orderBy('timestamp', 'desc').limit(50);

    if (type === 'cron') {
      query = db
        .collection('adminLogs')
        .where('action', '==', 'cron_backup')
        .orderBy('timestamp', 'desc')
        .limit(50) as any;
    } else {
      // Admin actions — everything except cron
      query = db
        .collection('adminLogs')
        .where('action', '!=', 'cron_backup')
        .orderBy('action')
        .orderBy('timestamp', 'desc')
        .limit(50) as any;
    }

    const snap = await query.get();
    const logs = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toMillis?.() ?? null,
    }));

    return NextResponse.json({ logs });
  } catch (err: any) {
    const msg = err.message ?? String(err);
    const isQuota = msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || err.code === 8;
    return NextResponse.json(
      { error: isQuota ? 'Firebase quota exceeded. Try again later.' : msg, isQuota },
      { status: isQuota ? 429 : 500 }
    );
  }
}
