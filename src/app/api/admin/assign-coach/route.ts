export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import admin from 'firebase-admin';

type CoachLinkResult = 'linked' | 'athlete_not_found' | 'has_different_coach' | 'already_linked_to_you';

interface AssignCoachResponse {
  success: boolean;
  coachUsername?: string;
  results: Record<string, CoachLinkResult>;
}

/**
 * POST /api/admin/assign-coach
 * Link a coach to athletes by email. Admin-only.
 * Body: { coachEmail: string, athleteEmails: string[] }
 */
export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
  }

  const session = await verifyAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { coachEmail, athleteEmails } = body;

    if (!coachEmail || !Array.isArray(athleteEmails) || athleteEmails.length === 0) {
      return NextResponse.json(
        { error: 'coachEmail and athleteEmails[] are required' },
        { status: 400 }
      );
    }

    // Look up coach by email
    const coachSnap = await adminDb
      .collection('users')
      .where('email', '==', coachEmail)
      .limit(1)
      .get();

    if (coachSnap.empty) {
      return NextResponse.json(
        { error: `Coach not found: ${coachEmail}` },
        { status: 404 }
      );
    }

    const coachDoc = coachSnap.docs[0];
    const coachUsername = coachDoc.id;
    const results: Record<string, CoachLinkResult> = {};

    // Validate all athlete emails first (fail fast)
    const athleteLookups: Record<string, { username: string; coachUsername?: string }> = {};
    for (const email of athleteEmails) {
      const athleteSnap = await adminDb
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (athleteSnap.empty) {
        results[email] = 'athlete_not_found';
      } else {
        const athleteData = athleteSnap.docs[0].data();
        athleteLookups[email] = {
          username: athleteSnap.docs[0].id,
          coachUsername: athleteData.coachUsername,
        };
      }
    }

    // Build batch write for valid athletes
    const batch = adminDb.batch();
    let hasWrites = false;

    // Ensure coach has role = 'coach'
    if (coachDoc.data().role !== 'coach') {
      batch.update(adminDb.collection('users').doc(coachUsername), {
        role: 'coach',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      hasWrites = true;
    }

    for (const email of athleteEmails) {
      if (results[email]) continue; // already marked as not_found

      const lookup = athleteLookups[email];

      if (lookup.coachUsername === coachUsername) {
        results[email] = 'already_linked_to_you';
        continue;
      }

      if (lookup.coachUsername && lookup.coachUsername !== coachUsername) {
        results[email] = 'has_different_coach';
        continue;
      }

      // Link athlete to coach
      batch.update(adminDb.collection('users').doc(lookup.username), {
        coachUsername,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      results[email] = 'linked';
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }

    await logAdminAction(session.uid, 'coach_linked', {
      coachEmail,
      coachUsername,
      results,
    });

    const response: AssignCoachResponse = {
      success: true,
      coachUsername,
      results,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign coach';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
