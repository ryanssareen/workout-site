export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import * as brevo from '@getbrevo/brevo';

const MAX_REMINDERS_PER_RUN = 100;

interface WorkoutData {
  id: string;
  name: string;
  type: string;
  description: string;
  date: admin.firestore.Timestamp;
  duration?: number;
  assignedTo: string;
  ownerUsername: string;
  completed: boolean;
  reminderSent?: boolean;
}

interface UserData {
  email: string;
  displayName: string;
}

async function getUserData(username: string): Promise<UserData | null> {
  try {
    const userDoc = await adminDb.collection('users').doc(username).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return {
        email: data?.email || '',
        displayName: data?.displayName || 'there',
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

function generateReminderEmail(userName: string, workout: WorkoutData, appUrl: string): string {
  const workoutDate = workout.date.toDate();
  const formattedDate = workoutDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const typeEmoji: Record<string, string> = {
    run: '🏃',
    bike: '🚴',
    swim: '🏊',
    strength: '💪',
  };

  const emoji = typeEmoji[workout.type] || '🏋️';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Workout Reminder</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">
              ⏰ Workout Tomorrow!
            </h1>
          </div>

          <!-- Main Content -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 25px;">
              Hey ${userName}! Just a friendly reminder about your upcoming workout.
            </p>

            <!-- Workout Card -->
            <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; border-left: 4px solid #667eea;">
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 32px; margin-right: 15px;">${emoji}</span>
                <div>
                  <h2 style="margin: 0; font-size: 20px; color: #333;">${workout.name}</h2>
                  <p style="margin: 5px 0 0 0; color: #666; font-size: 14px; text-transform: capitalize;">
                    ${workout.type} ${workout.duration ? `• ${workout.duration} min` : ''}
                  </p>
                </div>
              </div>

              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 5px 0; font-size: 14px; color: #666;">
                  <strong>When:</strong> ${formattedDate}
                </p>
                ${workout.description ? `
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                  ${workout.description.substring(0, 200)}${workout.description.length > 200 ? '...' : ''}
                </p>
                ` : ''}
              </div>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="${appUrl}/calendar" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                View in Calendar
              </a>
            </div>

            <p style="margin-top: 25px; font-size: 14px; color: #666; text-align: center;">
              You've got this! 💪
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              This reminder was sent from The Daily Athlete.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function sendReminderEmail(
  userEmail: string,
  userName: string,
  workout: WorkoutData,
  appUrl: string
): Promise<boolean> {
  try {
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY || ''
    );

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'The Daily Athlete', email: 'ryansareen6@gmail.com' };
    sendSmtpEmail.to = [{ email: userEmail, name: userName }];
    sendSmtpEmail.subject = `⏰ Reminder: ${workout.name} tomorrow`;
    sendSmtpEmail.htmlContent = generateReminderEmail(userName, workout, appUrl);

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return true;
  } catch (error) {
    console.error(`Failed to send reminder to ${userEmail}:`, error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Optional: Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Cron secret mismatch or missing');
    }

    const now = new Date();
    // Get tomorrow's date range in IST
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    console.log(`⏰ Starting reminder job at ${now.toISOString()}`);
    console.log(`Looking for workouts between ${tomorrowStart.toISOString()} and ${tomorrowEnd.toISOString()}`);

    // Get tomorrow's incomplete workouts that haven't been reminded
    const workoutsSnapshot = await adminDb
      .collectionGroup('workouts')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(tomorrowStart))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(tomorrowEnd))
      .where('completed', '==', false)
      .limit(MAX_REMINDERS_PER_RUN)
      .get();

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [] as { email: string; workout: string; status: string }[],
    };

    for (const doc of workoutsSnapshot.docs) {
      const workout = { id: doc.id, ...doc.data() } as WorkoutData;

      // Skip if already reminded
      if (workout.reminderSent) {
        results.skipped++;
        continue;
      }

      // Get user data
      const userData = await getUserData(workout.assignedTo);
      if (!userData || !userData.email) {
        results.skipped++;
        results.details.push({
          email: 'unknown',
          workout: workout.name,
          status: 'skipped - no user email',
        });
        continue;
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://workout-tracker.onrender.com';

      // Send reminder
      const sent = await sendReminderEmail(
        userData.email,
        userData.displayName,
        workout,
        appUrl
      );

      if (sent) {
        // Mark as reminded (subcollection path: users/{username}/workouts/{id})
        const ownerUsername = workout.ownerUsername || workout.assignedTo;
        await adminDb.collection('users').doc(ownerUsername).collection('workouts').doc(workout.id).update({
          reminderSent: true,
        });

        results.sent++;
        results.details.push({
          email: userData.email,
          workout: workout.name,
          status: 'sent',
        });
      } else {
        results.failed++;
        results.details.push({
          email: userData.email,
          workout: workout.name,
          status: 'failed to send',
        });
      }

      results.processed++;
    }

    const duration = Date.now() - startTime;

    console.log(`⏰ Reminder job completed in ${duration}ms`);
    console.log(`Results: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      results,
    });
  } catch (error: any) {
    console.error('Reminder job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
