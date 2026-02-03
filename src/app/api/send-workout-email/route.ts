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

    const { studentEmail, studentName, workout } = body;

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

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .workout-detail { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
            .label { font-weight: bold; color: #667eea; font-size: 14px; text-transform: uppercase; }
            .value { font-size: 16px; margin-top: 5px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Workout Assigned!</h1>
            </div>
            <div class="content">
              <p>Hi ${studentName || 'there'}!</p>
              <p>Your coach has assigned you a new workout. Here are the details:</p>
              <div class="workout-detail">
                <div class="label">Workout Name</div>
                <div class="value">${workout.name}</div>
              </div>
              <div class="workout-detail">
                <div class="label">Type</div>
                <div class="value">${workout.type}</div>
              </div>
              <div class="workout-detail">
                <div class="label">Date</div>
                <div class="value">${formattedDate}</div>
              </div>
              ${workout.duration ? `
                <div class="workout-detail">
                  <div class="label">Duration</div>
                  <div class="value">${workout.duration} minutes</div>
                </div>
              ` : ''}
              ${workout.description ? `
                <div class="workout-detail">
                  <div class="label">Description</div>
                  <div class="value">${workout.description}</div>
                </div>
              ` : ''}
              <div class="footer">
                <p>Good luck with your training!</p>
                <p><em>Login to your dashboard to view all your workouts</em></p>
              </div>
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
