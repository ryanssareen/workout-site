export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import * as brevo from '@getbrevo/brevo';
import {
  generateWrapEmail, generateWrapSubject,
  WrapEmailData, WrapSportStat,
} from '@/lib/email/wrapTemplate';
import { sendPushNotification } from '@/lib/push';

const MAX_USERS_PER_RUN = 50;

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', walk: '🚶', strength: '💪', other: '🏋️',
};
const TYPE_LABEL: Record<string, string> = {
  run: 'ran', bike: 'cycled', swim: 'swam', walk: 'walked', strength: 'lifted', other: 'trained',
};
const TYPE_COLOR: Record<string, string> = {
  run: '#22c55e', bike: '#f97316', swim: '#3b82f6', walk: '#10b981', strength: '#a855f7', other: '#6b7280',
};

interface WorkoutDoc {
  type: string;
  completed: boolean;
  duration?: number;
  date: admin.firestore.Timestamp;
  actualStats?: {
    distance?: number;
    duration?: number;
    calories?: number;
  };
  photos?: string[];
  name?: string;
}

function pctChange(curr: number, prev: number): { text: string; isPositive: boolean } | null {
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return { text: 'new this week', isPositive: true };
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return { text: `${pct}% more than last week`, isPositive: true };
  if (pct < 0) return { text: `${Math.abs(pct)}% less than last week`, isPositive: false };
  return { text: 'same as last week', isPositive: true };
}

function getWeekRating(totalCount: number, totalPrev: number): { word: string; emoji: string } {
  if (totalCount === 0) return { word: 'quiet', emoji: '😴' };
  if (totalPrev === 0) return { word: 'a great start', emoji: '🚀' };
  const ratio = totalCount / totalPrev;
  if (ratio >= 1.3) return { word: 'incredible', emoji: '🔥' };
  if (ratio >= 1.1) return { word: 'solid', emoji: '💪' };
  if (ratio >= 0.9) return { word: 'consistent', emoji: '✅' };
  return { word: 'a recovery week', emoji: '🧘' };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate last week's range (Monday–Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    // How many days back to get to the most recent Monday of a completed week
    const daysBackToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysBackToLastMonday - 7);
    lastMonday.setHours(0, 0, 0, 0);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    // Previous week for comparison
    const prevMonday = new Date(lastMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevSunday2 = new Date(lastSunday);
    prevSunday2.setDate(prevSunday2.getDate() - 7);

    const weekLabel = `${lastMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${lastSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    console.log(`📦 Starting weekly wrap job for ${weekLabel}`);

    // Get all athletes
    const [athleteSnapshot, studentSnapshot] = await Promise.all([
      adminDb.collection('users').where('role', '==', 'athlete').get(),
      adminDb.collection('users').where('role', '==', 'student').get(),
    ]);

    const allUserDocs = [...athleteSnapshot.docs, ...studentSnapshot.docs];
    const results = {
      processed: 0, sent: 0, failed: 0, skipped: 0,
      details: [] as { email: string; status: string }[],
    };

    let processed = 0;

    for (const userDoc of allUserDocs) {
      if (processed >= MAX_USERS_PER_RUN) break;

      const userData = userDoc.data();
      const username = userDoc.id;
      const email = userData.email;
      const displayName = userData.displayName || email?.split('@')[0] || 'Athlete';

      if (!email) continue;

      // Check if already sent this week's wrap
      const lastWrapDate = userData.lastWrapDate?.toDate?.();
      if (lastWrapDate && lastWrapDate > lastMonday) {
        continue; // Already sent
      }

      try {
        // Get this week's and last week's workouts
        const [thisWeekSnap, lastWeekSnap] = await Promise.all([
          adminDb.collection('users').doc(username).collection('workouts')
            .where('date', '>=', admin.firestore.Timestamp.fromDate(lastMonday))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(lastSunday))
            .get(),
          adminDb.collection('users').doc(username).collection('workouts')
            .where('date', '>=', admin.firestore.Timestamp.fromDate(prevMonday))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(prevSunday2))
            .get(),
        ]);

        const thisWeek = thisWeekSnap.docs.map(d => d.data() as WorkoutDoc);
        const lastWeek = lastWeekSnap.docs.map(d => d.data() as WorkoutDoc);

        if (thisWeek.length === 0) {
          results.skipped++;
          results.details.push({ email, status: 'skipped - no workouts' });
          continue;
        }

        // Compute per-sport stats
        const types = new Set<string>();
        [...thisWeek, ...lastWeek].forEach(w => types.add(w.type));

        const sportStats: WrapSportStat[] = Array.from(types).map(type => {
          const tw = thisWeek.filter(w => w.type === type);
          const lw = lastWeek.filter(w => w.type === type);

          const sumDist = (ws: WorkoutDoc[]) => ws.reduce((s, w) => s + (w.actualStats?.distance || 0), 0) / 1000;
          const sumDur = (ws: WorkoutDoc[]) => ws.reduce((s, w) => {
            if (w.actualStats?.duration) return s + w.actualStats.duration / 60;
            if (w.duration) return s + w.duration;
            return s;
          }, 0);

          const distKm = Math.round(sumDist(tw) * 10) / 10;
          const durMin = Math.round(sumDur(tw));
          const prevDistKm = Math.round(sumDist(lw) * 10) / 10;
          const prevDurMin = Math.round(sumDur(lw));

          const metric = distKm > 0 ? `${distKm}km` : durMin > 0 ? `${durMin} min` : `${tw.length} session${tw.length > 1 ? 's' : ''}`;
          const comp = distKm > 0
            ? pctChange(distKm, prevDistKm)
            : durMin > 0
              ? pctChange(durMin, prevDurMin)
              : pctChange(tw.length, lw.length);

          return {
            type,
            emoji: TYPE_EMOJI[type] || '🏋️',
            label: TYPE_LABEL[type] || 'trained',
            metric,
            color: TYPE_COLOR[type] || '#6b7280',
            comparison: comp?.text || null,
            isPositive: comp?.isPositive ?? true,
          };
        }).sort((a, b) => {
          const countA = thisWeek.filter(w => w.type === a.type).length;
          const countB = thisWeek.filter(w => w.type === b.type).length;
          return countB - countA;
        });

        // Detect highlight
        let highlight: WrapEmailData['highlight'] = null;
        let longestDur = 0;
        let longestW: WorkoutDoc | null = null;

        for (const w of thisWeek) {
          const dur = w.actualStats?.duration ? w.actualStats.duration / 60 : w.duration || 0;
          if (dur > longestDur) { longestDur = dur; longestW = w; }
        }

        if (longestDur >= 60 && longestW) {
          const hours = Math.floor(longestDur / 60);
          const mins = Math.round(longestDur % 60);
          const timeStr = hours > 0
            ? `${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`
            : `${Math.round(longestDur)} minutes`;
          highlight = {
            emoji: TYPE_EMOJI[longestW.type] || '🏋️',
            label: `You ${TYPE_LABEL[longestW.type] || 'trained'} for ${timeStr} non-stop`,
            detail: longestW.name || 'Workout',
          };
        } else {
          const completed = thisWeek.filter(w => w.completed).length;
          if (completed > 0) {
            highlight = {
              emoji: '🔥',
              label: `You completed ${completed} workout${completed > 1 ? 's' : ''} this week`,
              detail: 'Keep showing up!',
            };
          }
        }

        const rating = getWeekRating(thisWeek.length, lastWeek.length);

        const wrapData: WrapEmailData = {
          userName: displayName.split(' ')[0],
          weekLabel,
          ratingWord: rating.word,
          ratingEmoji: rating.emoji,
          sportStats,
          highlight,
          totalWorkouts: thisWeek.length,
          completedWorkouts: thisWeek.filter(w => w.completed).length,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://thedailyathlete.in',
        };

        // Send email
        const apiInstance = new brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = { name: 'The Daily Athlete', email: 'ryansareen6@gmail.com' };
        sendSmtpEmail.to = [{ email, name: displayName }];
        sendSmtpEmail.subject = generateWrapSubject(rating.emoji, thisWeek.length);
        sendSmtpEmail.htmlContent = generateWrapEmail(wrapData);

        await apiInstance.sendTransacEmail(sendSmtpEmail);

        // Send push notification alongside email
        await sendPushNotification(username, {
          title: `${rating.emoji} Your Weekly Wrap is Ready`,
          body: `You logged ${thisWeek.length} workout${thisWeek.length !== 1 ? 's' : ''} this week. See how it went!`,
          url: '/wrap',
        }).catch(() => {}); // non-fatal

        // Mark as sent
        await adminDb.collection('users').doc(username).update({
          lastWrapDate: admin.firestore.FieldValue.serverTimestamp(),
        });

        results.sent++;
        results.details.push({ email, status: 'sent' });
      } catch (error: any) {
        console.error(`Error for ${email}:`, error);
        results.failed++;
        results.details.push({ email, status: `error: ${error.message}` });
      }

      results.processed++;
      processed++;
    }

    const duration = Date.now() - startTime;
    console.log(`📦 Weekly wrap job done in ${duration}ms — ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`);

    return NextResponse.json({ success: true, duration: `${duration}ms`, results });
  } catch (error: any) {
    console.error('Weekly wrap job failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
