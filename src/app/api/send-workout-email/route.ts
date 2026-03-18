export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as brevo from '@getbrevo/brevo';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.BREVO_API_KEY) {
      return NextResponse.json(
        { error: 'Email service not configured (missing BREVO_API_KEY)' },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { studentEmail, studentName, workout, workoutId, ownerUsername } = body;

    if (!studentEmail || !workout) {
      return NextResponse.json(
        { error: `Missing required fields: ${!studentEmail ? 'studentEmail' : ''} ${!workout ? 'workout' : ''}`.trim() },
        { status: 400 }
      );
    }

    let formattedDate = 'TBD';
    try {
      const workoutDate = workout.date?.seconds
        ? new Date(workout.date.seconds * 1000)
        : new Date(workout.date);
      if (!isNaN(workoutDate.getTime())) {
        formattedDate = workoutDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    } catch {
      // fallback to 'TBD'
    }

    const typeEmoji: Record<string, string> = { run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '⚡' };
    const emoji = typeEmoji[workout.type] || '⚡';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 32px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
                COACHTRACK
              </div>
              <div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 6px; text-transform: uppercase; letter-spacing: 3px;">
                New Workout Assigned
              </div>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="color: #ffffff; font-size: 18px; margin: 0 0 8px 0; font-weight: 700;">Hey ${studentName || 'there'},</p>
              <p style="color: rgba(255,255,255,0.5); font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
                Your coach just assigned you a new workout. Time to get after it.
              </p>

              <!-- Workout Card -->
              <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden;">
                <!-- Workout Title Bar -->
                <div style="background-color: rgba(220,38,38,0.15); padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                  <div style="font-size: 20px; font-weight: 800; color: #ffffff; text-transform: uppercase;">${emoji} ${workout.name}</div>
                </div>

                <!-- Details -->
                <div style="padding: 20px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                        <div style="font-size: 11px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 1px;">Type</div>
                        <div style="font-size: 15px; color: #ffffff; margin-top: 4px; text-transform: capitalize;">${workout.type}</div>
                      </td>
                      <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-align: right;">
                        <div style="font-size: 11px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 1px;">Date</div>
                        <div style="font-size: 15px; color: #ffffff; margin-top: 4px;">${formattedDate}</div>
                      </td>
                    </tr>
                    ${workout.duration ? `
                    <tr>
                      <td colspan="2" style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                        <div style="font-size: 11px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 1px;">Duration</div>
                        <div style="font-size: 15px; color: #ffffff; margin-top: 4px;">${workout.duration} minutes</div>
                      </td>
                    </tr>
                    ` : ''}
                    ${workout.description ? `
                    <tr>
                      <td colspan="2" style="padding: 10px 0;">
                        <div style="font-size: 11px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 1px;">Description</div>
                        <div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 4px; line-height: 1.5;">${workout.description}</div>
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </div>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://thedailyathlete.in'}${workoutId && ownerUsername ? `/preview/${ownerUsername}/${workoutId}` : '/workouts'}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 15px; text-transform: uppercase; letter-spacing: 1px;">
                  View Workout
                </a>
              </div>

              <p style="color: rgba(255,255,255,0.3); font-size: 13px; text-align: center; margin-top: 20px;">
                Good luck with your training!
              </p>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 25px 30px; text-align: center;">
              <p style="margin: 0; color: rgba(255,255,255,0.25); font-size: 12px;">
                Sent from CoachTrack — Train Harder. Track Smarter.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'CoachTrack', email: 'ryansareen6@gmail.com' };
    sendSmtpEmail.to = [{ email: studentEmail, name: studentName }];
    sendSmtpEmail.subject = `New Workout: ${workout.name}`;
    sendSmtpEmail.htmlContent = emailHtml;

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);

    return NextResponse.json({ success: true, messageId: data.body.messageId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Mail send failed: ${message}` },
      { status: 500 }
    );
  }
}
