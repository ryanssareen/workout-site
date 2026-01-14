export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as brevo from '@getbrevo/brevo';

const MAX_SCHEDULES_PER_RUN = 100;

async function sendIncompleteWorkoutNotification(
  coachId: string,
  studentId: string,
  workout: any
) {
  try {
    // Fetch coach and student data
    const [coachDoc, studentDoc] = await Promise.all([
      adminDb.collection('users').doc(coachId).get(),
      adminDb.collection('users').doc(studentId).get()
    ]);

    if (!coachDoc.exists || !studentDoc.exists) return;

    const coachData = coachDoc.data();
    const studentData = studentDoc.data();

    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY || ''
    );

    const workoutDate = workout.date.toDate();
    const formattedDate = workoutDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white;">
            <div style="background: #ef4444; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">⚠️ Incomplete Workout Alert</h1>
            </div>
            <div style="padding: 30px;">
              <p>Hi ${coachData?.displayName || 'Coach'},</p>
              <p><strong>${studentData?.displayName}</strong> has not completed their workout:</p>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="margin: 0 0 10px 0; font-size: 18px;">${workout.name}</h2>
                <p style="margin: 0; color: #666;">Scheduled for: ${formattedDate}</p>
              </div>
              <p>A new recurring workout has been sent as scheduled.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/workouts"
                   style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">
                  View Workouts
                </a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: coachData?.email, name: coachData?.displayName }];
    sendSmtpEmail.sender = {
      email: 'noreply@workouttracker.com',
      name: 'Workout Tracker'
    };
    sendSmtpEmail.subject = `⚠️ ${studentData?.displayName} hasn't completed their workout`;
    sendSmtpEmail.htmlContent = htmlContent;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error) {
    console.error('Error sending incomplete workout notification:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const now = new Date();
    console.log(`[CRON] Processing recurring workouts at ${now.toISOString()}`);

    // Query schedules that are due
    const dueSchedules = await adminDb
      .collection('recurringSchedules')
      .where('status', '==', 'active')
      .where('nextSendDate', '<=', now)
      .limit(MAX_SCHEDULES_PER_RUN)
      .get();

    console.log(`[CRON] Found ${dueSchedules.size} due schedules`);

    let processed = 0;
    let errors = 0;

    for (const scheduleDoc of dueSchedules.docs) {
      try {
        const schedule = { id: scheduleDoc.id, ...scheduleDoc.data() };

        // Check if previous workout is incomplete
        if (schedule.sentWorkoutIds && schedule.sentWorkoutIds.length > 0) {
          const lastWorkoutId = schedule.sentWorkoutIds[schedule.sentWorkoutIds.length - 1];
          const lastWorkoutDoc = await adminDb.collection('workouts').doc(lastWorkoutId).get();

          if (lastWorkoutDoc.exists) {
            const lastWorkout = lastWorkoutDoc.data();
            if (!lastWorkout?.completed) {
              await sendIncompleteWorkoutNotification(
                schedule.coachId,
                schedule.studentId,
                { ...lastWorkout, id: lastWorkoutId }
              );
            }
          }
        }

        // Create new workout
        const newWorkout = {
          ...schedule.workoutTemplate,
          date: now,
          assignedTo: schedule.studentId,
          createdBy: schedule.coachId,
          completed: false,
          recurringScheduleId: schedule.id,
          createdAt: now,
          updatedAt: now,
        };

        const workoutRef = await adminDb.collection('workouts').add(newWorkout);

        // Update schedule
        const nextSendDate = new Date(
          now.getTime() + schedule.intervalDays * 24 * 60 * 60 * 1000
        );

        const updates: any = {
          lastSendDate: now,
          nextSendDate,
          sentWorkoutIds: [...(schedule.sentWorkoutIds || []), workoutRef.id],
          updatedAt: now,
        };

        // Handle count-based end condition
        if (schedule.endCondition.type === 'count') {
          const newCount = (schedule.endCondition.remainingCount || 0) - 1;
          updates['endCondition.remainingCount'] = newCount;

          if (newCount <= 0) {
            updates.status = 'completed';
          }
        }

        // Handle date-based end condition
        if (schedule.endCondition.type === 'date' && schedule.endCondition.endDate) {
          const endDate = schedule.endCondition.endDate.toDate
            ? schedule.endCondition.endDate.toDate()
            : new Date(schedule.endCondition.endDate);

          if (nextSendDate > endDate) {
            updates.status = 'completed';
          }
        }

        await adminDb.collection('recurringSchedules').doc(schedule.id).update(updates);

        processed++;
      } catch (error) {
        console.error(`[CRON] Error processing schedule ${scheduleDoc.id}:`, error);
        errors++;
      }
    }

    console.log(`[CRON] Processed ${processed} schedules, ${errors} errors`);

    return NextResponse.json({
      success: true,
      processed,
      errors,
      timestamp: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Fatal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process recurring workouts' },
      { status: 500 }
    );
  }
}
