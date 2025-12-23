import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import * as brevo from '@getbrevo/brevo';
import { generateSummaryEmail, generateSummarySubject, SummaryData } from '@/lib/email/summaryTemplate';

const SUMMARY_INTERVAL_DAYS = 10;
const MAX_USERS_PER_RUN = 50;
const INITIAL_WAIT_DAYS = 10; // Wait 10 days from first workout before sending

// Get start of day in IST timezone
function getISTStartOfDay(date: Date): Date {
  // Create date in IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  istDate.setUTCHours(0, 0, 0, 0);
  return new Date(istDate.getTime() - istOffset);
}

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  lastSummaryDate?: admin.firestore.Timestamp;
  coachId?: string;
  stravaConnected?: boolean;
  createdAt?: admin.firestore.Timestamp;
}

interface WorkoutData {
  completed: boolean;
  type: 'run' | 'bike' | 'swim' | 'strength';
  actualStats?: {
    distance?: number;
    duration?: number;
    calories?: number;
  };
}

async function getCoachEmail(coachId: string): Promise<string | null> {
  try {
    const coachDoc = await adminDb.collection('users').doc(coachId).get();
    if (coachDoc.exists) {
      return coachDoc.data()?.email || null;
    }
    return null;
  } catch (error) {
    console.error('Error fetching coach:', error);
    return null;
  }
}

async function sendSummaryEmail(
  userEmail: string,
  userName: string,
  summaryData: SummaryData,
  coachEmail?: string | null
): Promise<boolean> {
  try {
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY || ''
    );

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'Workout Tracker', email: 'ryansareen6@gmail.com' };
    sendSmtpEmail.to = [{ email: userEmail, name: userName }];

    // CC coach if they exist
    if (coachEmail && coachEmail !== userEmail) {
      sendSmtpEmail.cc = [{ email: coachEmail }];
    }

    sendSmtpEmail.subject = generateSummarySubject(summaryData.completionRate, summaryData.periodDays);
    sendSmtpEmail.htmlContent = generateSummaryEmail(summaryData);

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${userEmail}:`, error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Optional: Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Log but don't block - allows testing without secret
      console.warn('Cron secret mismatch or missing');
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - SUMMARY_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    const periodStart = new Date(now.getTime() - SUMMARY_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

    console.log(`📧 Starting summary email job at ${now.toISOString()}`);
    console.log(`Looking for users who haven't received summary since: ${cutoffDate.toISOString()}`);

    // Get all students who need summaries
    const usersSnapshot = await adminDb
      .collection('users')
      .where('role', '==', 'student')
      .get();

    const eligibleUsers: UserData[] = [];

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data() as Omit<UserData, 'uid'>;
      const user: UserData = { uid: doc.id, ...userData };

      // Skip if no email
      if (!user.email) continue;

      // Check if user needs a summary
      const lastSummary = user.lastSummaryDate?.toDate();

      if (!lastSummary) {
        // First summary - wait INITIAL_WAIT_DAYS from account creation
        const createdAt = user.createdAt?.toDate() || now;
        const waitUntil = new Date(createdAt.getTime() + INITIAL_WAIT_DAYS * 24 * 60 * 60 * 1000);

        if (now < waitUntil) {
          console.log(`Skipping ${user.email}: waiting until ${waitUntil.toISOString()} for initial summary`);
          continue;
        }
      } else if (lastSummary > cutoffDate) {
        // Already got summary recently
        continue;
      }

      eligibleUsers.push(user);

      if (eligibleUsers.length >= MAX_USERS_PER_RUN) {
        break;
      }
    }

    console.log(`Found ${eligibleUsers.length} eligible users for summaries`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [] as { email: string; status: string; completionRate?: number }[],
    };

    for (const user of eligibleUsers) {
      try {
        // Get user's workouts from the period
        const workoutsSnapshot = await adminDb
          .collection('workouts')
          .where('assignedTo', '==', user.uid)
          .where('date', '>=', admin.firestore.Timestamp.fromDate(periodStart))
          .where('date', '<=', admin.firestore.Timestamp.fromDate(now))
          .get();

        const workouts = workoutsSnapshot.docs.map(doc => doc.data() as WorkoutData);

        // Skip if no workouts in period
        if (workouts.length === 0) {
          results.skipped++;
          results.details.push({ email: user.email, status: 'skipped - no workouts' });
          continue;
        }

        // Calculate stats
        const totalAssigned = workouts.length;
        const completedWorkouts = workouts.filter(w => w.completed);
        const totalCompleted = completedWorkouts.length;
        const completionRate = Math.round((totalCompleted / totalAssigned) * 100);

        // Count by type
        const byType = {
          run: workouts.filter(w => w.type === 'run' && w.completed).length,
          bike: workouts.filter(w => w.type === 'bike' && w.completed).length,
          swim: workouts.filter(w => w.type === 'swim' && w.completed).length,
          strength: workouts.filter(w => w.type === 'strength' && w.completed).length,
        };

        // Aggregate Strava stats if available
        let stravaStats: SummaryData['stravaStats'] | undefined;
        const workoutsWithStats = completedWorkouts.filter(w => w.actualStats);

        if (workoutsWithStats.length > 0) {
          const totalDistance = workoutsWithStats.reduce((sum, w) => sum + (w.actualStats?.distance || 0), 0);
          const totalDuration = workoutsWithStats.reduce((sum, w) => sum + (w.actualStats?.duration || 0), 0);
          const totalCalories = workoutsWithStats.reduce((sum, w) => sum + (w.actualStats?.calories || 0), 0);

          if (totalDistance > 0 || totalDuration > 0 || totalCalories > 0) {
            stravaStats = {
              distance: totalDistance / 1000, // Convert meters to km
              time: totalDuration / 60, // Convert seconds to minutes
              calories: totalCalories,
            };
          }
        }

        // Get coach email for CC
        let coachEmail: string | null = null;
        if (user.coachId) {
          coachEmail = await getCoachEmail(user.coachId);
        }

        // Prepare summary data
        const summaryData: SummaryData = {
          userName: user.displayName || user.email.split('@')[0],
          totalAssigned,
          totalCompleted,
          completionRate,
          byType,
          stravaStats,
          periodDays: SUMMARY_INTERVAL_DAYS,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://workout-tracker.onrender.com',
        };

        // Send email
        const sent = await sendSummaryEmail(user.email, summaryData.userName, summaryData, coachEmail);

        if (sent) {
          // Update lastSummaryDate
          await adminDb.collection('users').doc(user.uid).update({
            lastSummaryDate: admin.firestore.FieldValue.serverTimestamp(),
          });

          results.sent++;
          results.details.push({
            email: user.email,
            status: 'sent',
            completionRate,
          });
        } else {
          results.failed++;
          results.details.push({ email: user.email, status: 'failed to send' });
        }

        results.processed++;
      } catch (error: any) {
        console.error(`Error processing user ${user.email}:`, error);
        results.failed++;
        results.details.push({ email: user.email, status: `error: ${error.message}` });
      }
    }

    const duration = Date.now() - startTime;

    console.log(`📧 Summary email job completed in ${duration}ms`);
    console.log(`Results: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      results,
    });
  } catch (error: any) {
    console.error('Summary email job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
