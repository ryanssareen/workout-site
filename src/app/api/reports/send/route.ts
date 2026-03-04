export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import * as brevo from '@getbrevo/brevo';
import { generateSummaryEmail, generateSummarySubject, SummaryData } from '@/lib/email/summaryTemplate';
import { adminResolveUsername } from '@/lib/firebase/adminUserMapping';

interface RequestBody {
  userId?: string;
  periodDays?: number;
}

async function buildSummary(username: string, periodDays: number): Promise<{ summary: SummaryData; coachEmail?: string | null } | null> {
  const userDoc = await adminDb.collection('users').doc(username).get();
  if (!userDoc.exists) return null;

  const userData = userDoc.data() as any;
  const userEmail = userData.email as string | undefined;
  const userName = userData.displayName || 'Athlete';
  const coachUsername = userData.coachUsername as string | undefined;

  if (!userEmail) return null;

  // Determine window
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const workoutsSnapshot = await adminDb
    .collection('users').doc(username).collection('workouts')
    .where('date', '>=', admin.firestore.Timestamp.fromDate(periodStart))
    .where('date', '<=', admin.firestore.Timestamp.fromDate(now))
    .get();

  const workouts = workoutsSnapshot.docs.map(doc => doc.data() as any);
  if (workouts.length === 0) return null;

  const totalAssigned = workouts.length;
  const completedWorkouts = workouts.filter(w => w.completed);
  const totalCompleted = completedWorkouts.length;
  const completionRate = Math.round((totalCompleted / totalAssigned) * 100);

  const byType = {
    run: completedWorkouts.filter((w: any) => w.type === 'run').length,
    bike: completedWorkouts.filter((w: any) => w.type === 'bike').length,
    swim: completedWorkouts.filter((w: any) => w.type === 'swim').length,
    strength: completedWorkouts.filter((w: any) => w.type === 'strength').length,
  } satisfies SummaryData['byType'];

  let stravaStats: SummaryData['stravaStats'] | undefined;
  const workoutsWithStats = completedWorkouts.filter((w: any) => w.actualStats);

  if (workoutsWithStats.length > 0) {
    const totalDistance = workoutsWithStats.reduce((sum: number, w: any) => sum + (w.actualStats?.distance || 0), 0);
    const totalDuration = workoutsWithStats.reduce((sum: number, w: any) => sum + (w.actualStats?.duration || 0), 0);
    const totalCalories = workoutsWithStats.reduce((sum: number, w: any) => sum + (w.actualStats?.calories || 0), 0);

    if (totalDistance > 0 || totalDuration > 0 || totalCalories > 0) {
      stravaStats = {
        distance: totalDistance / 1000, // convert meters to km if provided in meters
        time: totalDuration / 60, // seconds to minutes if provided in seconds
        calories: totalCalories,
      };
    }
  }

  const summary: SummaryData = {
    userName,
    totalAssigned,
    totalCompleted,
    completionRate,
    byType,
    stravaStats,
    periodDays,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://workout-site-hac0.onrender.com',
  };

  let coachEmail: string | null = null;
  if (coachUsername) {
    const coachDoc = await adminDb.collection('users').doc(coachUsername).get();
    if (coachDoc.exists) coachEmail = (coachDoc.data() as any)?.email || null;
  }

  return { summary, coachEmail };
}

async function sendEmail(to: string, name: string, summary: SummaryData, coachEmail?: string | null) {
  if (!process.env.BREVO_API_KEY) {
    throw new Error('Email service not configured');
  }

  const apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: 'CoachTrack', email: 'ryansareen6@gmail.com' };
  sendSmtpEmail.to = [{ email: to, name }];
  if (coachEmail && coachEmail !== to) {
    sendSmtpEmail.cc = [{ email: coachEmail }];
  }
  sendSmtpEmail.subject = generateSummarySubject(summary.completionRate, summary.periodDays);
  sendSmtpEmail.htmlContent = generateSummaryEmail(summary);

  await apiInstance.sendTransacEmail(sendSmtpEmail);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const userId = body.userId;
    const periodDays = Math.min(Math.max(body.periodDays || 30, 7), 90); // clamp 7-90

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    // Resolve UID to username
    const username = await adminResolveUsername(userId);

    const summaryResult = await buildSummary(username, periodDays);
    if (!summaryResult) {
      return NextResponse.json({ success: false, error: 'No workouts or user/email not found' }, { status: 404 });
    }

    const userDoc = await adminDb.collection('users').doc(username).get();
    const userData = userDoc.data() as any;
    const userEmail = userData.email as string | undefined;
    const userName = userData.displayName || 'Athlete';

    if (!userEmail) {
      return NextResponse.json({ success: false, error: 'User has no email on file' }, { status: 400 });
    }

    await sendEmail(userEmail, userName, summaryResult.summary, summaryResult.coachEmail);

    await adminDb.collection('users').doc(username).update({ lastSummaryDate: admin.firestore.FieldValue.serverTimestamp() });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ send report error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to send report' }, { status: 500 });
  }
}
