export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession } from '@/lib/admin-auth';

// GET — list all users, or ?export=csv for bulk CSV download
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(100).get();

    const users = snap.docs.map(doc => {
      const d = doc.data();
      return {
        username: doc.id,
        email: d.email ?? '',
        displayName: d.displayName ?? '',
        role: d.role ?? 'athlete',
        createdAt: d.createdAt?.toMillis?.() ?? null,
        deletedAt: d.deletedAt?.toMillis?.() ?? null,
        status: d.deletedAt ? 'deleted' : 'active',
      };
    });

    // CSV export
    const exportMode = request.nextUrl.searchParams.get('export');
    if (exportMode === 'csv') {
      const header = 'username,email,displayName,role,createdAt,status';
      const rows = users.map(u =>
        [
          u.username,
          u.email,
          `"${u.displayName.replace(/"/g, '""')}"`,
          u.role,
          u.createdAt ? new Date(u.createdAt).toISOString() : '',
          u.status,
        ].join(',')
      );
      const csv = [header, ...rows].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="users-${Date.now()}.csv"`,
        },
      });
    }

    // Count workouts per user — costs 1 read per user (count() query).
    // Acceptable since admin dashboard is rarely accessed.
    const workoutCounts: Record<string, number> = {};
    await Promise.all(
      snap.docs.map(async doc => {
        const workoutsSnap = await db
          .collection('users')
          .doc(doc.id)
          .collection('workouts')
          .count()
          .get();
        workoutCounts[doc.id] = workoutsSnap.data().count;
      })
    );

    return NextResponse.json({
      users: users.map(u => ({ ...u, workoutCount: workoutCounts[u.username] ?? 0 })),
    });
  } catch (err: any) {
    const msg = err.message ?? String(err);
    const isQuota = msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || err.code === 8;
    return NextResponse.json(
      { error: isQuota ? 'Firebase quota exceeded. Try again later.' : msg, isQuota },
      { status: isQuota ? 429 : 500 }
    );
  }
}
