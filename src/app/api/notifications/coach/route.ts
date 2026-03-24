export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyApiRequest, isVerifiedUser } from '@/lib/api-auth';
import { sendPushNotification } from '@/lib/push';
import { generateAssignmentEmail, generateAssignmentSubject } from '@/lib/email/assignmentTemplate';
import * as brevo from '@getbrevo/brevo';

/**
 * POST /api/notifications/coach
 * Unified notification endpoint for coach-athlete communication.
 * type: 'completed' — push notification to coach when athlete completes assigned workout
 * type: 'assigned' — email to athlete when coach assigns workout(s)
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await verifyApiRequest(request);
    if (!isVerifiedUser(caller)) return caller;

    const body = await request.json();
    const { type } = body;

    if (type === 'completed') {
      return handleCompleted(body, caller.username);
    } else if (type === 'assigned') {
      return handleAssigned(body, caller.username);
    }

    return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
  } catch (error) {
    console.error('Coach notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleCompleted(
  body: { workoutId: string; ownerUsername: string },
  callerUsername: string
) {
  const { workoutId, ownerUsername } = body;
  if (!workoutId || !ownerUsername) {
    return NextResponse.json({ error: 'workoutId and ownerUsername required' }, { status: 400 });
  }

  // Read workout to check if it's coach-assigned
  const workoutDoc = await adminDb
    .collection('users').doc(ownerUsername)
    .collection('workouts').doc(workoutId)
    .get();

  if (!workoutDoc.exists) {
    return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
  }

  const workout = workoutDoc.data()!;
  const coachUsername = workout.createdBy !== workout.ownerUsername ? workout.createdBy : null;

  if (!coachUsername) {
    return NextResponse.json({ skipped: true, reason: 'not_coach_assigned' });
  }

  // Check coach notification preferences
  const coachDoc = await adminDb.collection('users').doc(coachUsername).get();
  if (!coachDoc.exists) {
    return NextResponse.json({ skipped: true, reason: 'coach_not_found' });
  }

  const coachData = coachDoc.data()!;
  if (coachData.notificationPreferences?.coachMessages === false) {
    return NextResponse.json({ skipped: true, reason: 'opted_out' });
  }

  // Look up athlete name
  const athleteDoc = await adminDb.collection('users').doc(ownerUsername).get();
  const athleteName = athleteDoc.data()?.displayName || ownerUsername;

  // Send push notification
  await sendPushNotification(coachUsername, {
    title: 'Workout Completed',
    body: `${athleteName} completed ${workout.name}`,
    url: `/workouts/${workoutId}?owner=${ownerUsername}`,
  });

  return NextResponse.json({ sent: true });
}

async function handleAssigned(
  body: { athleteUsername: string; workouts: Array<{ name: string; type: string; date: string; description?: string }> },
  callerUsername: string
) {
  const { athleteUsername, workouts } = body;
  if (!athleteUsername || !Array.isArray(workouts) || workouts.length === 0) {
    return NextResponse.json({ error: 'athleteUsername and workouts[] required' }, { status: 400 });
  }

  // Verify caller is the athlete's coach
  const athleteDoc = await adminDb.collection('users').doc(athleteUsername).get();
  if (!athleteDoc.exists) {
    return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
  }

  const athleteData = athleteDoc.data()!;
  if (athleteData.coachUsername !== callerUsername) {
    return NextResponse.json({ error: 'Not authorized — not the athlete\'s coach' }, { status: 403 });
  }

  // Respect notification preferences
  if (athleteData.notificationPreferences?.coachMessages === false) {
    return NextResponse.json({ skipped: true, reason: 'opted_out' });
  }

  const athleteEmail = athleteData.email;
  if (!athleteEmail) {
    return NextResponse.json({ skipped: true, reason: 'no_email' });
  }

  // Look up coach name
  const coachDoc = await adminDb.collection('users').doc(callerUsername).get();
  const coachName = coachDoc.data()?.displayName || callerUsername;
  const athleteName = athleteData.displayName || athleteUsername;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thedailyathlete.in';

  // Send email via Brevo
  const apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY || ''
  );

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: 'The Daily Athlete', email: 'ryansareen6@gmail.com' };
  sendSmtpEmail.to = [{ email: athleteEmail, name: athleteName }];
  sendSmtpEmail.subject = generateAssignmentSubject(coachName, workouts.length);
  sendSmtpEmail.htmlContent = generateAssignmentEmail({
    coachName,
    athleteName,
    workouts,
    dashboardUrl: appUrl,
  });
  sendSmtpEmail.headers = {
    'List-Unsubscribe': `<${appUrl}/settings>`,
  };

  await apiInstance.sendTransacEmail(sendSmtpEmail);

  return NextResponse.json({ sent: true, to: athleteEmail });
}
