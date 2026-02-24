/**
 * One-time script: Assign athletes to rsareen@gmail.com as coach
 * 
 * GET /api/admin/assign-athletes
 * 
 * Athletes: rsareen+hetal@gmail.com, rsareen+rohin@gmail.com
 * Coach: rsareen@gmail.com
 * 
 * This route finds the coach by email, finds each athlete by email,
 * and sets their coachId to the coach's uid.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

const COACH_EMAIL = 'rsareen@gmail.com';
const ATHLETE_EMAILS = [
  'rsareen+hetal@gmail.com',
  'rsareen+rohin@gmail.com',
  'rsareen+rupesh@gmail.com',
];

export async function GET() {
  const results: any[] = [];

  try {
    // Find coach
    const coachSnap = await adminDb
      .collection('users')
      .where('email', '==', COACH_EMAIL)
      .limit(1)
      .get();

    if (coachSnap.empty) {
      return NextResponse.json({ error: `Coach not found: ${COACH_EMAIL}` }, { status: 404 });
    }

    const coachDoc = coachSnap.docs[0];
    const coachId = coachDoc.id;
    const coachData = coachDoc.data();

    results.push({
      step: 'coach_found',
      email: COACH_EMAIL,
      uid: coachId,
      name: coachData.displayName,
      role: coachData.role,
    });

    // Ensure coach has role = 'coach'
    if (coachData.role !== 'coach') {
      await adminDb.collection('users').doc(coachId).update({
        role: 'coach',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      results.push({ step: 'promoted_to_coach', email: COACH_EMAIL });
    }

    // Assign each athlete
    for (const athleteEmail of ATHLETE_EMAILS) {
      const athleteSnap = await adminDb
        .collection('users')
        .where('email', '==', athleteEmail)
        .limit(1)
        .get();

      if (athleteSnap.empty) {
        results.push({ step: 'athlete_not_found', email: athleteEmail, action: 'skipped' });
        continue;
      }

      const athleteDoc = athleteSnap.docs[0];
      const athleteId = athleteDoc.id;
      const athleteData = athleteDoc.data();

      // Update athlete: set coachId and ensure role is athlete
      await adminDb.collection('users').doc(athleteId).update({
        coachId: coachId,
        role: athleteData.role === 'student' ? 'athlete' : (athleteData.role || 'athlete'),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      results.push({
        step: 'athlete_assigned',
        email: athleteEmail,
        uid: athleteId,
        name: athleteData.displayName,
        coachId: coachId,
        previousCoachId: athleteData.coachId || 'none',
      });
    }

    return NextResponse.json({
      success: true,
      coach: { email: COACH_EMAIL, uid: coachId },
      results,
      message: `Assigned ${ATHLETE_EMAILS.length} athletes to ${COACH_EMAIL}. You can delete this route now.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, results }, { status: 500 });
  }
}
