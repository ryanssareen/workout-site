export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession } from '@/lib/admin-auth';

// In-memory cache to avoid hammering Firestore on every admin page load
let cachedUsers: unknown[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// GET — list all users, or ?export=csv for bulk CSV download
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';

  try {
    // Return cached data if fresh (skip for CSV exports)
    const exportMode = request.nextUrl.searchParams.get('export');
    if (!forceRefresh && !exportMode && cachedUsers && Date.now() - cacheTime < CACHE_TTL) {
      return NextResponse.json({ users: cachedUsers, cached: true });
    }

    const db = getAdminDb();
    const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(100).get();
    const liveCounts = request.nextUrl.searchParams.get('withCounts') === '1';

    // Build user list — optionally fetch live workout counts via .count() aggregation
    const users = await Promise.all(snap.docs.map(async (doc) => {
      const d = doc.data();
      let workoutCount = d.workoutCount ?? 0;

      if (liveCounts) {
        // .count().get() = 1 read regardless of collection size
        const countSnap = await db.collection('users').doc(doc.id)
          .collection('workouts').count().get();
        workoutCount = countSnap.data().count;
        // Also update the denormalized field while we're at it
        if (workoutCount !== (d.workoutCount ?? 0)) {
          db.collection('users').doc(doc.id).update({ workoutCount }).catch(() => {});
        }
      }

      return {
        username: doc.id,
        email: d.email ?? '',
        displayName: d.displayName ?? '',
        role: d.role ?? 'athlete',
        createdAt: d.createdAt?.toMillis?.() ?? null,
        deletedAt: d.deletedAt?.toMillis?.() ?? null,
        status: d.deletedAt ? 'deleted' : 'active',
        workoutCount,
        planBetaEnabled: d.planBetaEnabled === true,
        activePlanId: d.activePlanId ?? null,
      };
    }));

    // CSV export
    if (exportMode === 'csv') {
      const header = 'username,email,displayName,role,createdAt,status,workoutCount';
      const rows = users.map(u =>
        [
          u.username,
          u.email,
          `"${u.displayName.replace(/"/g, '""')}"`,
          u.role,
          u.createdAt ? new Date(u.createdAt).toISOString() : '',
          u.status,
          u.workoutCount,
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

    // Update cache
    cachedUsers = users;
    cacheTime = Date.now();

    return NextResponse.json({ users });
  } catch (err: any) {
    const msg = err.message ?? String(err);
    const isQuota = msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || err.code === 8;
    return NextResponse.json(
      { error: isQuota ? 'Firebase quota exceeded. Try again later.' : msg, isQuota },
      { status: isQuota ? 429 : 500 }
    );
  }
}
