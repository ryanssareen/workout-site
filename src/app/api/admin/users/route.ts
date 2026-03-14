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
    const snap = await db.collection('users').orderBy('createdAt', 'desc').get();

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

    // Count workouts per user
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
