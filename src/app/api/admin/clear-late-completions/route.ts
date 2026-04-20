export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, logAdminAction } from '@/lib/admin-auth';
import { FieldValue } from 'firebase-admin/firestore';

// POST — one-time migration: clear completedLate from all completed workouts.
// Use ?username=X to scope to one athlete (recommended for large datasets).
// Use ?dryRun=true to preview without writing.
export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username') ?? null;
  const dryRun = searchParams.get('dryRun') === 'true';

  try {
    const db = getAdminDb();
    let updated = 0;
    let scanned = 0;

    const processUser = async (uid: string) => {
      const workoutsRef = db.collection('users').doc(uid).collection('workouts');
      // Only fetch workouts that actually have completedLate = true
      const snap = await workoutsRef.where('completedLate', '==', true).get();
      if (snap.empty) return;

      // Batch in groups of 490 (Firestore limit is 500)
      const docs = snap.docs;
      scanned += docs.length;

      if (!dryRun) {
        for (let i = 0; i < docs.length; i += 490) {
          const batch = db.batch();
          const chunk = docs.slice(i, i + 490);
          for (const doc of chunk) {
            batch.update(doc.ref, { completedLate: FieldValue.delete() });
          }
          await batch.commit();
        }
      }

      updated += docs.length;
    };

    if (username) {
      await processUser(username);
    } else {
      const usersSnap = await db.collection('users').select().get();
      for (const userDoc of usersSnap.docs) {
        await processUser(userDoc.id);
      }
    }

    if (!dryRun) {
      await logAdminAction(session.uid, 'clear_late_completions' as any, { updated, username });
    }

    return NextResponse.json({ success: true, updated, scanned, dryRun });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
