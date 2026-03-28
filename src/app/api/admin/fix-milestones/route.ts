export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { verifyAdminSession, logAdminAction } from '@/lib/admin-auth';
import {
  WORKOUT_COUNT_MILESTONES,
  DISTANCE_MILESTONES,
  STREAK_MILESTONES,
  FIRST_EVER_MILESTONES,
} from '@/lib/milestones';

/**
 * POST /api/admin/fix-milestones?username=X&dryRun=true
 *
 * Deletes all existing milestones for a user and recomputes the correct ones
 * from their workout history. Supports ?dryRun=true to preview changes.
 * If no username is provided, runs for ALL users.
 */
export async function POST(req: NextRequest) {
  // Auth: admin session cookie or ?secret= param
  const secret = req.nextUrl.searchParams.get('secret');
  let adminUid = 'admin-via-secret';
  if (secret && secret === process.env.ADMIN_SECRET) {
    // ok
  } else {
    const session = await verifyAdminSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    adminUid = session.uid;
  }

  const db = getAdminDb();
  const targetUsername = req.nextUrl.searchParams.get('username');
  const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';

  try {
    // Get users to process
    let usernames: string[];
    if (targetUsername) {
      usernames = [targetUsername];
    } else {
      const usersSnap = await db.collection('users').select().get();
      usernames = usersSnap.docs.map(d => d.id);
    }

    const results: Array<{
      username: string;
      deleted: number;
      added: string[];
      error?: string;
    }> = [];

    for (const username of usernames) {
      try {
        // 1. Fetch all workouts
        const workoutsSnap = await db
          .collection('users').doc(username).collection('workouts')
          .get();

        const workouts = workoutsSnap.docs.map(d => {
          const data = d.data();
          return {
            type: data.type as string,
            completed: data.completed as boolean,
            date: data.date,
            actualStats: data.actualStats || {},
            duration: data.duration,
          };
        });

        const completed = workouts.filter(w => w.completed);

        // 2. Compute stats
        const completedCount = completed.length;
        const totalDistanceKm = completed.reduce((s, w) =>
          s + ((w.actualStats?.distance || 0) / 1000), 0);

        const typeCounts: Record<string, number> = {};
        for (const w of completed) {
          typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
        }

        // Streak: count consecutive days ending today/yesterday
        const dates = completed
          .map(w => {
            const d = w.date?.toDate?.() ?? new Date(w.date?._seconds ? w.date._seconds * 1000 : 0);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
          })
          .filter(t => t > 0);
        const uniqueDays = [...new Set(dates)].sort((a, b) => b - a);
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let checkTime = today.getTime();
        if (!uniqueDays.includes(checkTime)) {
          checkTime -= 86400000; // yesterday
        }
        for (let i = 0; i < 365; i++) {
          if (uniqueDays.includes(checkTime - i * 86400000)) {
            streak++;
          } else break;
        }

        // 3. Determine correct milestones
        const correctMilestones: Array<{
          category: string;
          name: string;
          description: string;
          value: number;
          unit: string;
          icon: string;
        }> = [];

        // Highest qualifying workout count
        const qualifyingCounts = WORKOUT_COUNT_MILESTONES.filter(m => completedCount >= m.threshold);
        if (qualifyingCounts.length > 0) {
          const h = qualifyingCounts[qualifyingCounts.length - 1];
          correctMilestones.push({ category: 'workout_count', name: h.name, description: h.description, value: h.threshold, unit: 'workouts', icon: h.icon });
        }

        // Highest qualifying distance
        const qualifyingDist = DISTANCE_MILESTONES.filter(m => totalDistanceKm >= m.threshold);
        if (qualifyingDist.length > 0) {
          const h = qualifyingDist[qualifyingDist.length - 1];
          correctMilestones.push({ category: 'distance', name: h.name, description: h.description, value: h.threshold, unit: 'km', icon: h.icon });
        }

        // Highest qualifying streak
        const qualifyingStreak = STREAK_MILESTONES.filter(m => streak >= m.threshold);
        if (qualifyingStreak.length > 0) {
          const h = qualifyingStreak[qualifyingStreak.length - 1];
          correctMilestones.push({ category: 'streak', name: h.name, description: h.description, value: h.threshold, unit: 'days', icon: h.icon });
        }

        // First-ever per type
        for (const m of FIRST_EVER_MILESTONES) {
          if ((typeCounts[m.type] || 0) >= 1) {
            const typeIndex = FIRST_EVER_MILESTONES.findIndex(f => f.type === m.type) + 1;
            correctMilestones.push({ category: 'first_ever', name: m.name, description: m.description, value: typeIndex, unit: m.type, icon: m.icon });
          }
        }

        // 4. Delete existing milestones
        const existingSnap = await db
          .collection('users').doc(username).collection('milestones')
          .get();
        const deleteCount = existingSnap.size;

        if (!dryRun) {
          // Batch delete
          const batches: admin.firestore.WriteBatch[] = [db.batch()];
          let opCount = 0;
          for (const doc of existingSnap.docs) {
            if (opCount >= 490) {
              batches.push(db.batch());
              opCount = 0;
            }
            batches[batches.length - 1].delete(doc.ref);
            opCount++;
          }

          // Batch write correct milestones
          const now = admin.firestore.Timestamp.now();
          // Find the date of the user's first workout as milestone date
          const firstWorkoutDate = completed.length > 0
            ? completed.reduce((earliest, w) => {
                const d = w.date?.toDate?.() ?? new Date(w.date?._seconds ? w.date._seconds * 1000 : Date.now());
                return d < earliest ? d : earliest;
              }, new Date())
            : new Date();

          for (const ms of correctMilestones) {
            if (opCount >= 490) {
              batches.push(db.batch());
              opCount = 0;
            }
            const ref = db.collection('users').doc(username).collection('milestones').doc();
            batches[batches.length - 1].set(ref, {
              userId: username,
              category: ms.category,
              name: ms.name,
              description: ms.description,
              value: ms.value,
              unit: ms.unit,
              icon: ms.icon,
              date: admin.firestore.Timestamp.fromDate(firstWorkoutDate),
              createdAt: now,
            });
            opCount++;
          }

          for (const batch of batches) {
            await batch.commit();
          }
        }

        results.push({
          username,
          deleted: deleteCount,
          added: correctMilestones.map(m => m.name),
        });
      } catch (err: any) {
        results.push({ username, deleted: 0, added: [], error: err.message });
      }
    }

    if (!dryRun) {
      await logAdminAction(adminUid, 'fix_milestones', {
        userCount: results.length,
        totalDeleted: results.reduce((s, r) => s + r.deleted, 0),
        totalAdded: results.reduce((s, r) => s + r.added.length, 0),
      });
    }

    return NextResponse.json({
      dryRun,
      users: results.length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
