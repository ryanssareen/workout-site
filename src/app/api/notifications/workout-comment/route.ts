export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as brevo from '@getbrevo/brevo';
import { WorkoutRating } from '@/types';

interface CommentNotificationPayload {
  workoutId: string;
  ownerUsername: string;
  workoutName: string;
  commentText: string;
  studentName: string;
  rating?: WorkoutRating;
}

const ratingLabels: Record<WorkoutRating, { emoji: string; label: string }> = {
  too_easy: { emoji: '😌', label: 'Too Easy' },
  just_right: { emoji: '😊', label: 'Just Right' },
  too_hard: { emoji: '😰', label: 'Too Hard' },
};

function generateNotificationEmail(
  coachName: string,
  studentName: string,
  workoutName: string,
  commentText: string,
  rating: WorkoutRating | undefined,
  workoutUrl: string
): string {
  const ratingSection = rating
    ? `
      <div style="background: #f0f4ff; padding: 12px 16px; border-radius: 8px; margin-bottom: 15px;">
        <span style="font-size: 14px; color: #666;">Workout Rating:</span>
        <span style="font-size: 16px; margin-left: 8px;">
          ${ratingLabels[rating].emoji} ${ratingLabels[rating].label}
        </span>
      </div>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Workout Comment</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">
              💬 New Workout Feedback
            </h1>
          </div>

          <!-- Main Content -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Hey ${coachName}! <strong>${studentName}</strong> left feedback on their workout.
            </p>

            <!-- Workout Info -->
            <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #667eea;">
                ${workoutName}
              </h3>

              ${ratingSection}

              <!-- Comment -->
              <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
                <p style="margin: 0; font-size: 15px; color: #333; white-space: pre-wrap;">
                  "${commentText}"
                </p>
              </div>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center;">
              <a href="${workoutUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
                View Workout & Reply
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 15px 30px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              This notification was sent from CoachTrack.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body: CommentNotificationPayload = await request.json();
    const { workoutId, ownerUsername, workoutName, commentText, studentName, rating } = body;

    if (!workoutId || !ownerUsername || !commentText || !studentName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the workout to find the coach (subcollection path)
    const workoutDoc = await adminDb.collection('users').doc(ownerUsername).collection('workouts').doc(workoutId).get();
    if (!workoutDoc.exists) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    const workoutData = workoutDoc.data();
    const coachUsername = workoutData?.createdBy;

    if (!coachUsername) {
      return NextResponse.json({ error: 'No coach found' }, { status: 404 });
    }

    // Get coach data
    const coachDoc = await adminDb.collection('users').doc(coachUsername).get();
    if (!coachDoc.exists) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    const coachData = coachDoc.data();
    const coachEmail = coachData?.email;
    const coachName = coachData?.displayName || 'Coach';

    if (!coachEmail) {
      return NextResponse.json({ error: 'Coach email not found' }, { status: 404 });
    }

    // Send email via Brevo
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY || ''
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thedailyathlete.in';
    const workoutUrl = `${appUrl}/workouts/${workoutId}`;

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'CoachTrack', email: 'ryansareen6@gmail.com' };
    sendSmtpEmail.to = [{ email: coachEmail, name: coachName }];
    sendSmtpEmail.subject = `💬 ${studentName} commented on "${workoutName}"`;
    sendSmtpEmail.htmlContent = generateNotificationEmail(
      coachName,
      studentName,
      workoutName,
      commentText,
      rating,
      workoutUrl
    );

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log(`Comment notification sent to ${coachEmail}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to send comment notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
