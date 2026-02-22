export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';

// ONE-TIME endpoint to reset rsareen@gmail.com as coach
// DELETE THIS FILE AFTER USE
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const confirm = searchParams.get('confirm');

  if (confirm !== 'yes') {
    return NextResponse.json({ 
      message: 'Add ?confirm=yes to execute. This will:',
      actions: [
        '1. Find rsareen@gmail.com user doc',
        '2. Delete all workouts assigned to this user (athlete data)',
        '3. Set role to coach',
        '4. Reset password to ryan123',
        '5. Set displayName to Ryan Sareen',
      ]
    });
  }

  try {
    // Find user by email
    const usersSnap = await adminDb
      .collection('users')
      .where('email', '==', 'rsareen@gmail.com')
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return NextResponse.json({ error: 'User rsareen@gmail.com not found' }, { status: 404 });
    }

    const userDoc = usersSnap.docs[0];
    const userId = userDoc.id;

    // 1. Delete all workouts where assignedTo = this user
    const workoutsSnap = await adminDb
      .collection('workouts')
      .where('assignedTo', '==', userId)
      .get();

    let deletedWorkouts = 0;
    if (!workoutsSnap.empty) {
      const docs = workoutsSnap.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batch = adminDb.batch();
        docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        deletedWorkouts += Math.min(500, docs.length - i);
      }
    }

    // Also delete workouts created by this user
    const createdSnap = await adminDb
      .collection('workouts')
      .where('createdBy', '==', userId)
      .get();

    let deletedCreated = 0;
    if (!createdSnap.empty) {
      const docs = createdSnap.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batch = adminDb.batch();
        docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        deletedCreated += Math.min(500, docs.length - i);
      }
    }

    // 2. Update Firestore: role = coach
    await adminDb.collection('users').doc(userId).update({
      role: 'coach',
      displayName: 'Ryan Sareen',
      onboardingCompleted: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Reset password via Firebase Auth
    await getAuth().updateUser(userId, {
      password: 'ryan123',
      displayName: 'Ryan Sareen',
    });

    return NextResponse.json({
      success: true,
      userId,
      deletedWorkouts,
      deletedCreated,
      message: 'rsareen@gmail.com is now a clean coach. Password: ryan123. Log out and log back in.',
      reminder: 'DELETE this route after use: src/app/api/admin/reset-coach/',
    });
  } catch (err: any) {
    console.error('Reset error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
