/**
 * POST /api/ai/format-workouts
 *
 * Formats workouts via Groq for consistent naming, descriptions, and tags.
 *
 * Body:
 *  - userId: string (required) — format all workouts for this user
 *  - workoutIds?: string[] — optional subset of IDs to format
 *  - dryRun?: boolean — if true, return changes without writing to Firestore
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { formatWorkouts, formatWorkoutFallback, WorkoutForFormat } from '@/lib/groq-format';
import * as admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { userId, workoutIds, dryRun } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = getAdminDb();

    // Fetch workouts
    let snapshot;
    if (workoutIds?.length) {
      // Fetch specific workouts (batched for Firestore 'in' limit)
      const docs: admin.firestore.DocumentSnapshot[] = [];
      for (let i = 0; i < workoutIds.length; i += 10) {
        const batch = workoutIds.slice(i, i + 10);
        const batchSnap = await db.collection('workouts')
          .where(admin.firestore.FieldPath.documentId(), 'in', batch)
          .get();
        docs.push(...batchSnap.docs);
      }
      snapshot = { docs, size: docs.length };
    } else {
      // Fetch all workouts for user (both created by and assigned to)
      const [createdSnap, assignedSnap] = await Promise.all([
        db.collection('workouts').where('createdBy', '==', userId).get(),
        db.collection('workouts').where('assignedTo', '==', userId).get(),
      ]);

      // Deduplicate
      const docMap = new Map<string, admin.firestore.DocumentSnapshot>();
      for (const doc of [...createdSnap.docs, ...assignedSnap.docs]) {
        docMap.set(doc.id, doc);
      }
      snapshot = { docs: Array.from(docMap.values()), size: docMap.size };
    }

    if (snapshot.size === 0) {
      return NextResponse.json({ formatted: 0, message: 'No workouts found' });
    }

    // Build format input
    const workoutsToFormat: WorkoutForFormat[] = snapshot.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || '',
        type: d.type || 'other',
        description: d.description,
        duration: d.duration,
        tags: d.tags,
        source: d.source,
        swim: d.swim,
        bike: d.bike,
        run: d.run,
        strength: d.strength,
        other: d.other,
      };
    });

    // Run through Groq
    let formatted = await formatWorkouts(workoutsToFormat);

    // If Groq returned nothing (no API key or all failed), use fallback for unformatted ones
    if (formatted.length === 0) {
      formatted = workoutsToFormat.map(w => formatWorkoutFallback(w));
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totalWorkouts: snapshot.size,
        changesProposed: formatted.length,
        changes: formatted,
      });
    }

    // Write changes to Firestore
    let updated = 0;
    const batchSize = 500;
    for (let i = 0; i < formatted.length; i += batchSize) {
      const chunk = formatted.slice(i, i + batchSize);
      const batch = db.batch();

      for (const fw of chunk) {
        const ref = db.collection('workouts').doc(fw.id);
        batch.update(ref, {
          name: fw.name,
          description: fw.description,
          tags: fw.tags,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      updated += chunk.length;
    }

    return NextResponse.json({
      success: true,
      totalWorkouts: snapshot.size,
      formatted: updated,
      changes: formatted,
    });
  } catch (error: any) {
    console.error('Format workouts failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to format workouts' },
      { status: 500 }
    );
  }
}
