import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';

// One-time fix: rsareen+rupesh@gmail.com has mistyped workouts
// - "other" workout → should be "run"
// - "strength" workout → should be "swim"
// DELETE THIS ROUTE AFTER RUNNING

export async function POST(request: NextRequest) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // Find Rupesh's UID
    const userRecord = await auth.getUserByEmail('rsareen+rupesh@gmail.com');
    const uid = userRecord.uid;

    // Get all workouts assigned to Rupesh
    const snapshot = await db.collection('workouts')
      .where('assignedTo', '==', uid)
      .get();

    const fixes: { id: string; from: string; to: string; name: string }[] = [];

    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      // Fix "other" → "run"
      if (data.type === 'other') {
        batch.update(doc.ref, { type: 'run', updatedAt: new Date() });
        fixes.push({ id: doc.id, from: 'other', to: 'run', name: data.name });
      }

      // Fix "strength" → "swim" (only the mistyped one)
      // We check if it looks like a swim: no exercises, has description suggesting swim
      if (data.type === 'strength' && (!data.strength?.exercises || data.strength.exercises.length === 0)) {
        batch.update(doc.ref, { type: 'swim', strength: null, updatedAt: new Date() });
        fixes.push({ id: doc.id, from: 'strength', to: 'swim', name: data.name });
      }
    });

    if (fixes.length === 0) {
      // Show all workouts for debugging
      const all = snapshot.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        type: d.data().type,
        hasStrengthExercises: d.data().strength?.exercises?.length || 0,
      }));
      return NextResponse.json({ message: 'No fixes matched', totalWorkouts: all.length, workouts: all });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      uid,
      fixed: fixes.length,
      details: fixes,
    });
  } catch (error: any) {
    console.error('Fix failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
