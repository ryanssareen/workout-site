export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  console.log('📧 Email API called!');
  try {
    const { athleteEmail, athleteName, workout } = await request.json();
    console.log('📧 Received data:', { athleteEmail, athleteName, workoutName: workout.name });

    if (!athleteEmail || !workout) {
      console.log('❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create Gmail transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Format the date nicely
    const workoutDate = new Date(workout.date.seconds * 1000);
    const formattedDate = workoutDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create a nice HTML email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .workout-detail {
              background: white;
              padding: 15px;
              margin: 10px 0;
              border-radius: 8px;
              border-left: 4px solid #667eea;
            }
            .label {
              font-weight: bold;
              color: #667eea;
              font-size: 14px;
              text-transform: uppercase;
            }
            .value {
              font-size: 16px;
              margin-top: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏃 New Workout Assigned!</h1>
            </div>
            <div class="content">
              <p>Hi ${athleteName || 'there'}! 👋</p>
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
                <p>💪 Good luck with your training!</p>
                <p><em>Login to your dashboard to view all your workouts</em></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send the email
    console.log('📧 Attempting to send email to:', athleteEmail);
    const info = await transporter.sendMail({
      from: `"CoachTrack" <${process.env.GMAIL_USER}>`,
      to: athleteEmail,
      subject: `🏃 New Workout: ${workout.name}`,
      html: emailHtml,
    });

    console.log('✅ Email sent successfully! Message ID:', info.messageId);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('❌ Error sending email:', error);
    console.error('❌ Error message:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
