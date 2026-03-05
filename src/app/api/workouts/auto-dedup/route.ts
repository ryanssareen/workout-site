import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { isSameDay, format } from 'date-fns';

interface WorkoutDoc {
  id: string;
  name: string;
  type: string;
  assignedTo: string;
  ownerUsername: string;
  source?: string;
  date: any;
  duration?: number;
  stravaActivityId?: string | number;
  actualStats?: { distance?: number; duration?: number };
  run?: { distance?: number; distanceUnit?: string; time?: number };
  bike?: { distance?: number; distanceUnit?: string; time?: number };
  swim?: { distance?: number; distanceUnit?: string; time?: number };
  strength?: { exercises?: any[] };
  createdAt?: any;
}

function toDate(w: WorkoutDoc): Date {
  if (w.date?.toDate) return w.date.toDate();
  if (w.date?._seconds) return new Date(w.date._seconds * 1000);
  return new Date(w.date);
}

function getDistanceMeters(w: WorkoutDoc): number {
  if (w.actualStats?.distance) return w.actualStats.distance;
  if (w.type === 'run' && w.run?.distance) {
    return (w.run.distanceUnit === 'miles') ? w.run.distance * 1609.34 : w.run.distance * 1000;
  }
  if (w.type === 'bike' && w.bike?.distance) {
    return (w.bike.distanceUnit === 'miles') ? w.bike.distance * 1609.34 : w.bike.distance * 1000;
  }
  if (w.type === 'swim' && w.swim?.distance) {
    return (w.swim.distanceUnit === 'yards') ? w.swim.distance * 0.9144 : w.swim.distance;
  }
  return 0;
}

function getDurationSeconds(w: WorkoutDoc): number {
  if (w.actualStats?.duration) return w.actualStats.duration;
  if (w.type === 'run' && w.run?.time) return w.run.time * 60;
  if (w.type === 'bike' && w.bike?.time) return w.bike.time * 60;
  if (w.type === 'swim' && w.swim?.time) return w.swim.time * 60;
  if (w.duration) return w.duration * 60;
  return 0;
}

interface DupGroup {
  reason: string;
  keep: WorkoutDoc;
  delete: WorkoutDoc[];
}

function detectDuplicates(workouts: WorkoutDoc[]): DupGroup[] {
  const groups: DupGroup[] = [];
  const used = new Set<string>();

  // 1. Same stravaActivityId
  const byStravaId = new Map<string, WorkoutDoc[]>();
  for (const w of workouts) {
    if (w.stravaActivityId) {
      const key = String(w.stravaActivityId);
      if (!byStravaId.has(key)) byStravaId.set(key, []);
      byStravaId.get(key)!.push(w);
    }
  }
  for (const [id, group] of byStravaId) {
    if (group.length > 1) {
      const sorted = group.sort((a, b) =>
        (a.createdAt?._seconds || 0) - (b.createdAt?._seconds || 0)
      );
      groups.push({
        reason: `Same Strava ID (${id})`,
        keep: sorted[0],
        delete: sorted.slice(1),
      });
      group.forEach(w => used.add(w.id));
    }
  }

  // 2. Manual + Strava overlap
  const remaining = workouts.filter(w => !used.has(w.id));
  const stravaWs = remaining.filter(w => w.source === 'strava');
  const manualWs = remaining.filter(w => w.source !== 'strava');

  for (const manual of manualWs) {
    if (used.has(manual.id)) continue;
    for (const strava of stravaWs) {
      if (used.has(strava.id)) continue;
      if (manual.type !== strava.type || manual.assignedTo !== strava.assignedTo) continue;
      const hoursDiff = Math.abs(toDate(manual).getTime() - toDate(strava).getTime()) / 3.6e6;
      if (hoursDiff >= 24) continue;

      const durM = getDurationSeconds(manual);
      const durS = getDurationSeconds(strava);
      const durationClose = durM > 0 && durS > 0 && Math.abs(durM - durS) / Math.max(durM, durS) < 0.3;
      const distM = getDistanceMeters(manual);
      const distS = getDistanceMeters(strava);
      const distanceClose = distM > 0 && distS > 0 && Math.abs(distM - distS) / Math.max(distM, distS) < 0.15;

      // Only dedup when we have strong evidence — require matching stats, not just "no stats"
      if (durationClose || distanceClose) {
        groups.push({
          reason: `Manual+Strava overlap: "${manual.name}" on ${format(toDate(manual), 'MMM d')}`,
          keep: strava, // Strava has richer data
          delete: [manual],
        });
        used.add(manual.id);
        used.add(strava.id);
        break;
      }
    }
  }

  // 3. Same name + type + date within 24h + same user
  const remaining2 = workouts.filter(w => !used.has(w.id));
  for (let i = 0; i < remaining2.length; i++) {
    if (used.has(remaining2[i].id)) continue;
    const matches: WorkoutDoc[] = [remaining2[i]];

    for (let j = i + 1; j < remaining2.length; j++) {
      if (used.has(remaining2[j].id)) continue;
      const a = remaining2[i], b = remaining2[j];
      const hoursDiff = Math.abs(toDate(a).getTime() - toDate(b).getTime()) / 3.6e6;
      const sameName = a.name.toLowerCase().trim() === b.name.toLowerCase().trim();
      const sameType = a.type === b.type;
      const sameUser = a.assignedTo === b.assignedTo;

      if (sameName && sameType && sameUser && hoursDiff < 24) {
        matches.push(b);
      } else if (sameType && sameUser && hoursDiff < 2) {
        const durA = getDurationSeconds(a), durB = getDurationSeconds(b);
        if (durA > 0 && durB > 0 && Math.abs(durA - durB) / Math.max(durA, durB) < 0.15) {
          matches.push(b);
        }
      } else if (sameType && sameUser && isSameDay(toDate(a), toDate(b))) {
        // Must also be same type — don't merge a run and a bike on the same day
        const distA = getDistanceMeters(a), distB = getDistanceMeters(b);
        if (distA > 0 && distB > 0 && Math.abs(distA - distB) / Math.max(distA, distB) < 0.05) {
          matches.push(b);
        }
      }
    }

    if (matches.length > 1) {
      // Keep the one with most data (prefer strava, then most recent)
      const sorted = matches.sort((a, b) => {
        if (a.source === 'strava' && b.source !== 'strava') return -1;
        if (b.source === 'strava' && a.source !== 'strava') return 1;
        return (b.actualStats?.duration || 0) - (a.actualStats?.duration || 0);
      });
      groups.push({
        reason: `Same "${remaining2[i].name}" on ${format(toDate(remaining2[i]), 'MMM d')}`,
        keep: sorted[0],
        delete: sorted.slice(1),
      });
      matches.forEach(w => used.add(w.id));
    }
  }

  return groups;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    // userId is now a username — fetch workouts from user's subcollection
    const snapshot = await adminDb
      .collection('users').doc(userId).collection('workouts')
      .get();

    const workouts: WorkoutDoc[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ownerUsername: userId,
      ...doc.data(),
    } as WorkoutDoc));

    console.log(`[auto-dedup] ${workouts.length} workouts for user ${userId}`);

    // Also fetch workouts assigned to users this coach manages
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (userData?.role === 'coach') {
      const studentsSnap = await adminDb.collection('users')
        .where('coachUsername', '==', userId).get();
      for (const student of studentsSnap.docs) {
        const studentWorkouts = await adminDb
          .collection('users').doc(student.id).collection('workouts')
          .get();
        studentWorkouts.docs.forEach(doc => {
          workouts.push({ id: doc.id, ownerUsername: student.id, ...doc.data() } as WorkoutDoc);
        });
      }
    }

    // Detect duplicates
    const dupGroups = detectDuplicates(workouts);

    if (dupGroups.length === 0) {
      return NextResponse.json({ deleted: 0, groups: [] });
    }

    // Auto-delete duplicates
    const batch = adminDb.batch();
    const deletedIds: string[] = [];
    const groupSummaries: string[] = [];

    for (const group of dupGroups) {
      for (const dup of group.delete) {
        batch.delete(
          adminDb.collection('users').doc(dup.ownerUsername).collection('workouts').doc(dup.id)
        );
        deletedIds.push(dup.id);
      }
      groupSummaries.push(
        `${group.reason}: kept "${group.keep.name}" (${group.keep.id}), deleted ${group.delete.length}`
      );
    }

    if (deletedIds.length > 0) {
      await batch.commit();
      console.log(`[auto-dedup] Deleted ${deletedIds.length} duplicates for ${userId}:`);
      groupSummaries.forEach(s => console.log(`  - ${s}`));
    }

    return NextResponse.json({
      deleted: deletedIds.length,
      groups: groupSummaries,
      deletedIds,
    });
  } catch (error: any) {
    console.error('[auto-dedup] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
