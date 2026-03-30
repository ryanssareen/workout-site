export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import Groq from 'groq-sdk';
import { MAX_USERS_PER_RUN } from '@/lib/constants';

const SPORT_LABELS: Record<string, string> = {
  run: 'running', bike: 'cycling', swim: 'swimming', walk: 'walking', strength: 'strength', other: 'training',
};

const SYSTEM_PROMPT = `You are a friendly sports coach analyzing an athlete's recent training data. Generate a single personalized insight — something non-obvious that helps the athlete understand their training.

RULES:
1. Be specific with numbers from the data (don't be vague)
2. Lead with the non-obvious (the athlete can see basic stats themselves)
3. Keep it to 1-2 sentences, warm but not over-enthusiastic
4. If there's very little data, give an encouraging insight about getting started

Respond with ONLY valid JSON:
{
  "text": "Your main insight sentence here",
  "detail": "Optional brief elaboration (or null)",
  "reportType": "sport-deep-dive" | "trend-report" | "pr-timeline" | "recovery-report" | null,
  "reportParams": {"sport": "run"} or null
}

reportType should link to the most relevant report for this insight.`;

interface WorkoutDoc {
  type: string;
  completed: boolean;
  duration?: number;
  date: admin.firestore.Timestamp;
  tags?: string[];
  prs?: Array<{ exercise: string; value: string }>;
  actualStats?: {
    distance?: number;
    duration?: number;
    calories?: number;
  };
}

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this header for cron jobs)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

    // Fetch only active users (logged in within last 7 days) to save Firestore reads
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    let usersSnapshot;
    try {
      usersSnapshot = await adminDb
        .collection('users')
        .where('lastLoginAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
        .limit(MAX_USERS_PER_RUN)
        .get();
    } catch {
      // Fallback if lastLoginAt field doesn't exist on all docs
      usersSnapshot = await adminDb
        .collection('users')
        .limit(MAX_USERS_PER_RUN)
        .get();
    }

    console.log(`🧠 Generating insights for ${usersSnapshot.size} users`);

    let successCount = 0;
    let errorCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const username = userDoc.id;
      const userData = userDoc.data();
      const displayName = userData.displayName || 'Athlete';

      try {
        // Fetch last 30 days of workouts
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const workoutsSnapshot = await adminDb
          .collection('users')
          .doc(username)
          .collection('workouts')
          .where('date', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
          .get();

        const workouts: WorkoutDoc[] = workoutsSnapshot.docs.map((d) => d.data() as WorkoutDoc);
        const completed = workouts.filter((w) => w.completed);

        // Build compact context
        const sportCounts: Record<string, number> = {};
        let totalDurationMin = 0;
        let totalDistanceKm = 0;
        let prCount = 0;
        const restDays = new Set<string>();
        const activeDays = new Set<string>();

        for (const w of completed) {
          sportCounts[w.type] = (sportCounts[w.type] || 0) + 1;
          if (w.duration) totalDurationMin += w.duration;
          if (w.actualStats?.distance) totalDistanceKm += w.actualStats.distance / 1000;
          if (w.prs && w.prs.length > 0) prCount += w.prs.length;

          const dateStr = w.date?.toDate?.().toISOString().slice(0, 10) || '';
          if (dateStr) activeDays.add(dateStr);
        }

        // Count rest days (days in last 30 with no workout)
        for (let i = 0; i < 30; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const ds = d.toISOString().slice(0, 10);
          if (!activeDays.has(ds)) restDays.add(ds);
        }

        const sportSummary = Object.entries(sportCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([type, count]) => `${SPORT_LABELS[type] || type}: ${count}`)
          .join(', ');

        const context = `Athlete: ${displayName}
Last 30 days: ${completed.length} completed workouts out of ${workouts.length} total
Sports: ${sportSummary || 'none'}
Total duration: ${Math.round(totalDurationMin)} minutes (${(totalDurationMin / 60).toFixed(1)} hours)
Total distance: ${totalDistanceKm.toFixed(1)} km
Rest days: ${restDays.size} out of 30
Personal records this month: ${prCount}
Active days: ${activeDays.size} out of 30`;

        // Call Groq 8B (cheap + fast)
        const completion = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: context },
          ],
          temperature: 0.7,
          max_tokens: 300,
          response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        let parsed;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          console.error(`❌ Failed to parse insight for ${username}:`, responseText);
          errorCount++;
          continue;
        }

        if (!parsed.text) {
          errorCount++;
          continue;
        }

        // Write to Firestore
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

        await adminDb
          .collection('users')
          .doc(username)
          .collection('insights')
          .doc('daily')
          .set({
            text: parsed.text,
            detail: parsed.detail || null,
            reportType: parsed.reportType || null,
            reportParams: parsed.reportParams || null,
            generatedAt: admin.firestore.Timestamp.fromDate(now),
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          });

        successCount++;
      } catch (err) {
        console.error(`❌ Error generating insight for ${username}:`, err);
        errorCount++;
      }
    }

    console.log(`🧠 Insights complete: ${successCount} success, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      processed: usersSnapshot.size,
      generated: successCount,
      errors: errorCount,
    });
  } catch (error: unknown) {
    console.error('❌ Generate insights cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
