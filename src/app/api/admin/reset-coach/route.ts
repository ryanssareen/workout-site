export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';

// ONE-TIME admin reset — DELETE AFTER USE
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const confirm = searchParams.get('confirm');

  if (confirm !== 'yes') {
    return NextResponse.json({
      message: 'Add ?confirm=yes to execute',
    });
  }

  try {
    // Find user
    const usersSnap = await adminDb
      .collection('users')
      .where('email', '==', 'rsareen@gmail.com')
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userDoc = usersSnap.docs[0];
    const userId = userDoc.id;
    const log: string[] = [];

    // 1. Delete ALL workouts assigned to this user
    const assignedSnap = await adminDb
      .collection('workouts')
      .where('assignedTo', '==', userId)
      .get();
    let deleted = 0;
    if (!assignedSnap.empty) {
      for (let i = 0; i < assignedSnap.docs.length; i += 500) {
        const batch = adminDb.batch();
        assignedSnap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      deleted += assignedSnap.size;
    }
    log.push(`Deleted ${deleted} assigned workouts`);

    // 2. Delete ALL workouts created by this user
    const createdSnap = await adminDb
      .collection('workouts')
      .where('createdBy', '==', userId)
      .get();
    let deleted2 = 0;
    if (!createdSnap.empty) {
      for (let i = 0; i < createdSnap.docs.length; i += 500) {
        const batch = adminDb.batch();
        createdSnap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      deleted2 += createdSnap.size;
    }
    log.push(`Deleted ${deleted2} created workouts`);

    // 3. Also nuke any strava-sourced workout with this user's strava ID
    const userData = userDoc.data();
    if (userData?.stravaId) {
      // Find all workouts that might reference this strava account
      const stravaSnap = await adminDb
        .collection('workouts')
        .where('source', '==', 'strava')
        .get();
      const orphans = stravaSnap.docs.filter(d => {
        const data = d.data();
        return data.assignedTo === userId || data.createdBy === userId;
      });
      if (orphans.length > 0) {
        for (let i = 0; i < orphans.length; i += 500) {
          const batch = adminDb.batch();
          orphans.slice(i, i + 500).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
        log.push(`Deleted ${orphans.length} strava orphan workouts`);
      }
    }

    // 4. Force update Firestore doc
    await adminDb.collection('users').doc(userId).update({
      role: 'coach',
      displayName: 'Rishi Sareen',
      onboardingCompleted: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    log.push('Firestore: role=coach, displayName=Rishi Sareen');

    // 5. Force update Firebase Auth
    await getAuth().updateUser(userId, {
      password: 'ryan123',
      displayName: 'Rishi Sareen',
    });
    log.push('Firebase Auth: password=ryan123, displayName=Rishi Sareen');

    return NextResponse.json({
      success: true,
      userId,
      log,
      instruction: 'Log out, log back in with rsareen@gmail.com / ryan123. Then delete this route.',
    });
  } catch (err: any) {
    console.error('Reset error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
