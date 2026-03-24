export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyApiRequest, isVerifiedUser } from '@/lib/api-auth';
import admin from 'firebase-admin';

type AddAthleteResult = 'linked' | 'athlete_not_found' | 'has_different_coach' | 'already_linked_to_you' | 'not_a_coach';

/**
 * POST /api/coach/add-athlete
 * Coach-facing endpoint to link new athletes by email.
 * Auth: Firebase ID token (must be a coach).
 * Body: { athleteEmails: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await verifyApiRequest(request);
    if (!isVerifiedUser(caller)) return caller;

    if (caller.role !== 'coach') {
      return NextResponse.json({ error: 'Only coaches can add athletes' }, { status: 403 });
    }

    const body = await request.json();
    const { athleteEmails } = body;

    if (!Array.isArray(athleteEmails) || athleteEmails.length === 0) {
      return NextResponse.json({ error: 'athleteEmails[] is required' }, { status: 400 });
    }

    if (athleteEmails.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 athletes per request' }, { status: 400 });
    }

    const results: Record<string, AddAthleteResult> = {};

    // Look up all athlete emails
    const athleteLookups: Record<string, { username: string; coachUsername?: string }> = {};
    for (const email of athleteEmails) {
      const trimmed = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!trimmed) continue;

      const snap = await adminDb
        .collection('users')
        .where('email', '==', trimmed)
        .limit(1)
        .get();

      if (snap.empty) {
        results[trimmed] = 'athlete_not_found';
      } else {
        const data = snap.docs[0].data();
        athleteLookups[trimmed] = {
          username: snap.docs[0].id,
          coachUsername: data.coachUsername,
        };
      }
    }

    // Batch write for valid athletes
    const batch = adminDb.batch();
    let hasWrites = false;

    for (const email of Object.keys(athleteLookups)) {
      const lookup = athleteLookups[email];

      if (lookup.coachUsername === caller.username) {
        results[email] = 'already_linked_to_you';
        continue;
      }

      if (lookup.coachUsername && lookup.coachUsername !== caller.username) {
        results[email] = 'has_different_coach';
        continue;
      }

      batch.update(adminDb.collection('users').doc(lookup.username), {
        coachUsername: caller.username,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      results[email] = 'linked';
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add athlete';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
