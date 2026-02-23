/**
 * Strava Sync Simulation & Dedup Test Route
 * 
 * GET  /api/test/strava-sim              — Run dedup on real user data (dry-run)
 * POST /api/test/strava-sim              — Simulate webhook + sync + dedup pipeline
 * POST /api/test/strava-sim?execute=true — Same but actually delete duplicates
 * 
 * Query params:
 *   userId   — Firestore user ID (required)
 *   execute  — "true" to actually delete duplicates (default: dry-run)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { runDedupPipeline, executeDedupDeletions } from '@/lib/groq-dedup';

// Simulated Strava activities for testing
function generateMockActivities() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);
  const twoDaysAgo = new Date(today.getTime() - 2 * 86400000);

  return [
    // Scenario 1: Exact duplicate (same Strava ID imported twice)
    {
      id: 'sim_exact_dup_1',
      name: 'Morning Run',
      type: 'run',
      date: yesterday,
      duration: 30,
      distance: 5200,
      stravaActivityId: 'strava_sim_12345',
      source: 'strava',
    },
    {
      id: 'sim_exact_dup_2',
      name: 'Morning Run',
      type: 'run',
      date: yesterday,
      duration: 30,
      distance: 5200,
      stravaActivityId: 'strava_sim_12345',
      source: 'strava',
    },

    // Scenario 2: Manual + Strava overlap (same workout logged both ways)
    {
      id: 'sim_manual_run',
      name: 'Easy Run',
      type: 'run',
      date: twoDaysAgo,
      duration: 25,
      distance: 4000,
      source: 'manual',
    },
    {
      id: 'sim_strava_run',
      name: 'Gurgaon Running',
      type: 'run',
      date: twoDaysAgo,
      duration: 27,
      distance: 4150,
      stravaActivityId: 'strava_sim_67890',
      source: 'strava',
    },

    // Scenario 3: Proximity duplicate (re-synced with slightly different data)
    {
      id: 'sim_prox_1',
      name: 'Afternoon Ride',
      type: 'bike',
      date: new Date(today.getTime() - 3 * 86400000 + 14 * 3600000),
      duration: 45,
      distance: 15020,
      stravaActivityId: 'strava_sim_aaaa',
      source: 'strava',
    },
    {
      id: 'sim_prox_2',
      name: 'Afternoon Ride',
      type: 'bike',
      date: new Date(today.getTime() - 3 * 86400000 + 14 * 3600000 + 120000), // 2 min later
      duration: 44,
      distance: 15010,
      stravaActivityId: 'strava_sim_bbbb',
      source: 'strava',
    },

    // Scenario 4: NOT a duplicate (different days, same name)
    {
      id: 'sim_unique_1',
      name: 'Strength',
      type: 'strength',
      date: yesterday,
      duration: 40,
      distance: 0,
      source: 'manual',
    },
    {
      id: 'sim_unique_2',
      name: 'Strength',
      type: 'strength',
      date: new Date(today.getTime() - 7 * 86400000), // 7 days ago — NOT a dup
      duration: 35,
      distance: 0,
      source: 'manual',
    },
  ];
}

// GET: Run dedup on existing real user data (dry-run)
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId query param required' }, { status: 400 });
  }

  try {
    const { workouts, result } = await runDedupPipeline(userId);

    return NextResponse.json({
      success: true,
      mode: 'dry-run (GET — no deletions)',
      userId,
      totalWorkouts: workouts.length,
      workoutsSent: workouts.map(w => ({
        id: w.id, name: w.name, type: w.type, date: w.date,
        duration: w.duration, distance: w.distance, source: w.source,
        stravaActivityId: w.stravaActivityId,
      })),
      dedupResult: result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Full simulation — create mock data → run dedup → optionally delete
export async function POST(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const execute = request.nextUrl.searchParams.get('execute') === 'true';

  if (!userId) {
    return NextResponse.json({ error: 'userId query param required' }, { status: 400 });
  }

  const timeline: string[] = [];
  const mockIds: string[] = [];

  try {
    // ── Step 1: Verify user exists ──
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    timeline.push(`✅ User found: ${userDoc.data()?.displayName}`);

    // ── Step 2: Simulate Strava webhook → create mock workouts in Firestore ──
    const mockActivities = generateMockActivities();
    timeline.push(`📨 Simulating ${mockActivities.length} Strava webhook events...`);

    const batch = adminDb.batch();
    for (const activity of mockActivities) {
      const docId = `test_${activity.id}`;
      mockIds.push(docId);
      const ref = adminDb.collection('workouts').doc(docId);
      batch.set(ref, {
        name: activity.name,
        type: activity.type,
        date: admin.firestore.Timestamp.fromDate(activity.date),
        duration: activity.duration,
        actualStats: {
          distance: activity.distance,
          duration: activity.duration * 60,
        },
        source: activity.source,
        stravaActivityId: activity.stravaActivityId || null,
        assignedTo: userId,
        createdBy: userId,
        completed: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    timeline.push(`✅ Wrote ${mockActivities.length} mock workouts to Firestore`);

    // ── Step 3: Run Groq dedup pipeline on ALL user workouts ──
    timeline.push('🔍 Running Groq dedup pipeline...');
    const { workouts, result } = await runDedupPipeline(userId);
    timeline.push(`📊 Analyzed ${workouts.length} total workouts`);
    timeline.push(`🎯 Groq found ${result.duplicatesFound} duplicates (model: ${result.model})`);

    for (const d of result.deletions) {
      const delW = workouts.find(w => w.id === d.deleteId);
      const keepW = workouts.find(w => w.id === d.keepId);
      timeline.push(`  🗑️ DELETE "${delW?.name}" (${d.deleteId}) — KEEP "${keepW?.name}" (${d.keepId}) — ${d.reason}`);
    }

    // ── Step 4: Execute or dry-run ──
    let deletedCount = 0;
    if (execute && result.deletions.length > 0) {
      deletedCount = await executeDedupDeletions(result);
      timeline.push(`✅ EXECUTED: Deleted ${deletedCount} duplicate workouts`);
    } else if (result.deletions.length > 0) {
      timeline.push(`⏸️ DRY-RUN: Would delete ${result.deletions.length} workouts. Use ?execute=true to delete.`);
    }

    // ── Step 5: Clean up mock data (only the ones not already deleted) ──
    const cleanupBatch = adminDb.batch();
    let cleanedUp = 0;
    for (const docId of mockIds) {
      const docRef = adminDb.collection('workouts').doc(docId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        cleanupBatch.delete(docRef);
        cleanedUp++;
      }
    }
    if (cleanedUp > 0) {
      await cleanupBatch.commit();
      timeline.push(`🧹 Cleaned up ${cleanedUp} remaining mock workouts`);
    }

    return NextResponse.json({
      success: true,
      mode: execute ? 'EXECUTE' : 'DRY-RUN',
      userId,
      timeline,
      simulation: {
        mockActivitiesCreated: mockActivities.length,
        totalWorkoutsAnalyzed: workouts.length,
        mockScenarios: [
          'Scenario 1: Exact Strava ID duplicate (2 workouts → expect 1 deletion)',
          'Scenario 2: Manual + Strava overlap (same day, similar stats → expect 1 deletion)',
          'Scenario 3: Proximity duplicate (2 min apart, same distance → expect 1 deletion)',
          'Scenario 4: NOT duplicate (same name, 7 days apart → expect 0 deletions)',
        ],
      },
      dedupResult: result,
      deletionsExecuted: deletedCount,
    });
  } catch (err: any) {
    // Clean up mock data on error
    try {
      const cleanupBatch = adminDb.batch();
      for (const docId of mockIds) {
        cleanupBatch.delete(adminDb.collection('workouts').doc(docId));
      }
      await cleanupBatch.commit();
    } catch { /* ignore cleanup errors */ }

    return NextResponse.json({
      error: err.message,
      timeline,
    }, { status: 500 });
  }
}
