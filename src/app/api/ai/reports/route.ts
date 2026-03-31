export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { adminDb } from '@/lib/firebase/admin';
import { adminResolveUsername } from '@/lib/firebase/adminUserMapping';

const SYSTEM_PROMPT = `You are The Daily Athlete's AI report generator. Analyze workout data and create beautifully structured reports using JSON format.

CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no explanations, just the JSON object.

JSON STRUCTURE:
{
  "reportType": "progress" | "comparison" | "summary" | "prs" | "insight" | "analysis",
  "title": "Report Title",
  "subtitle": "Optional subtitle",
  "dateRange": "Optional date range like 'Jan 1 - Jan 31, 2025'",
  "sections": [
    {"type": "stat", "label": "Total Workouts", "value": 42, "trend": "up", "change": "+15%", "subtitle": "vs last period"},
    {"type": "table", "headers": ["Exercise", "Sets"], "rows": [["Bench", 5]], "caption": "Table Title"},
    {"type": "chart", "chartType": "line", "title": "Progress", "data": [{"week": "W1", "value": 90}], "xKey": "week", "yKey": "value", "label": "Weight"},
    {"type": "text", "content": "Analysis text", "variant": "default"},
    {"type": "highlight", "icon": "trophy", "content": "Great job!", "variant": "success"},
    {"type": "pr", "exercise": "Bench Press", "value": "100kg x 5", "date": "Jan 15", "previous": "95kg x 5"},
    {"type": "divider"}
  ],
  "summary": "Overall summary",
  "footer": "Custom footer"
}

INSUFFICIENT DATA: If not enough data, respond with:
{"insufficient": true, "message": "Not enough workout data available. Try a different date range."}

RULES:
1. Use stat cards for key metrics at the beginning (they display in a grid)
2. Use charts for trends/progress over time (line=progress, bar=comparison, pie=distribution)
3. Use tables for detailed exercise breakdowns
4. Use highlights for insights/achievements/warnings
5. Use PR badges for personal records
6. Be specific with numbers from the data
7. Return ONLY valid JSON`;

interface WorkoutData {
  id: string;
  name: string;
  type: string;
  date: Date;
  completed: boolean;
  completedLate?: boolean;
  assignedTo: string;
  duration?: number;
}

interface AthleteData {
  id: string;
  name: string;
  email: string;
  workouts: WorkoutData[];
  completedCount: number;
  totalCount: number;
  completionRate: number;
  lateCount: number;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const { question, userId, userEmail, userRole } = await req.json();

    if (!question || !userId) {
      return NextResponse.json(
        { error: 'Question and user ID are required' },
        { status: 400 }
      );
    }

    console.log('📊 Reports query:', question, 'Role:', userRole);

    const isCoach = userRole === 'coach';

    // Resolve UID to username
    const username = await adminResolveUsername(userId);

    let dataContext: string;
    let hasData = false;

    if (isCoach) {
      // Coach flow - analyze their assigned athletes
      let athleteDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
      const coachAthletesSnapshot = await adminDb
        .collection('users')
        .where('coachUsername', '==', username)
        .get();
      athleteDocs = coachAthletesSnapshot.docs;

      const athleteMap = new Map<string, AthleteData>();
      athleteDocs.forEach(doc => {
        const data = doc.data();
        athleteMap.set(doc.id, {
          id: doc.id,
          name: data.displayName || 'Unknown',
          email: data.email || '',
          workouts: [],
          completedCount: 0,
          totalCount: 0,
          completionRate: 0,
          lateCount: 0,
        });
      });

      // Query each athlete's workout subcollection
      const allWorkouts: WorkoutData[] = [];
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      for (const athleteDoc of athleteDocs) {
        const athleteUsername = athleteDoc.id;
        const workoutsSnapshot = await adminDb
          .collection('users').doc(athleteUsername).collection('workouts')
          .get();

        workoutsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const workoutDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);

          const workout: WorkoutData = {
            id: doc.id,
            name: data.name || 'Unnamed',
            type: data.type || 'other',
            date: workoutDate,
            completed: !!data.completed,
            completedLate: !!data.completedLate,
            assignedTo: data.assignedTo || '',
            duration: data.duration,
          };

          allWorkouts.push(workout);

          const athlete = athleteMap.get(athleteUsername);
          if (athlete) {
            athlete.workouts.push(workout);
            athlete.totalCount++;
            if (workout.completed) {
              athlete.completedCount++;
              if (workout.completedLate) {
                athlete.lateCount++;
              }
            }
          }
        });
      }

      athleteMap.forEach(athlete => {
        athlete.completionRate = athlete.totalCount > 0
          ? Math.round((athlete.completedCount / athlete.totalCount) * 100)
          : 0;
      });

      const athletes = Array.from(athleteMap.values());
      const totalWorkouts = allWorkouts.length;
      const completedWorkouts = allWorkouts.filter(w => w.completed).length;
      const overallCompletionRate = totalWorkouts > 0
        ? Math.round((completedWorkouts / totalWorkouts) * 100)
        : 0;

      hasData = athletes.length > 0 || totalWorkouts > 0;

      const last7Days = allWorkouts.filter(w => w.date >= sevenDaysAgo);
      const last30Days = allWorkouts.filter(w => w.date >= thirtyDaysAgo);
      const last90Days = allWorkouts.filter(w => w.date >= ninetyDaysAgo);

      const workoutsByType: Record<string, { total: number; completed: number }> = {};
      allWorkouts.forEach(w => {
        if (!workoutsByType[w.type]) {
          workoutsByType[w.type] = { total: 0, completed: 0 };
        }
        workoutsByType[w.type].total++;
        if (w.completed) workoutsByType[w.type].completed++;
      });

      dataContext = `
COACH'S DATA SUMMARY
====================

OVERVIEW:
- Total Athletes: ${athletes.length}
- Total Workouts (all time): ${totalWorkouts}
- Completed Workouts: ${completedWorkouts} (${overallCompletionRate}%)

RECENT ACTIVITY:
- Last 7 days: ${last7Days.length} workouts, ${last7Days.filter(w => w.completed).length} completed
- Last 30 days: ${last30Days.length} workouts, ${last30Days.filter(w => w.completed).length} completed
- Last 90 days: ${last90Days.length} workouts, ${last90Days.filter(w => w.completed).length} completed

WORKOUTS BY TYPE:
${Object.entries(workoutsByType).length > 0
  ? Object.entries(workoutsByType).map(([type, data]) =>
    `- ${type}: ${data.total} total, ${data.completed} completed (${data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0}%)`
  ).join('\n')
  : '- No workout data available'}

ATHLETE DETAILS:
${athletes.length > 0
  ? athletes.map(a => `
${a.name} (${a.email}):
  - Total Workouts: ${a.totalCount}
  - Completed: ${a.completedCount} (${a.completionRate}%)
  - Late Completions: ${a.lateCount}
  - Recent workouts: ${a.workouts.slice(-5).map(w =>
    `${w.name} (${w.type}) on ${w.date.toLocaleDateString()} - ${w.completed ? '✅' : '❌'}`
  ).join(', ') || 'None'}
`).join('\n')
  : '- No athletes found'}

Today's Date: ${now.toLocaleDateString()}
`;
    } else {
      // Athlete flow - analyze only their own workouts (subcollection)
      const workoutsSnapshot = await adminDb
        .collection('users').doc(username).collection('workouts')
        .get();

      const userDoc = await adminDb.collection('users').doc(username).get();
      const userName = userDoc.exists ? userDoc.data()?.displayName || 'Athlete' : 'Athlete';

      const allWorkouts: WorkoutData[] = [];
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      workoutsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const workoutDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);

        allWorkouts.push({
          id: doc.id,
          name: data.name || 'Unnamed',
          type: data.type || 'other',
          date: workoutDate,
          completed: !!data.completed,
          completedLate: !!data.completedLate,
          assignedTo: data.assignedTo || '',
          duration: data.duration,
        });
      });

      const totalWorkouts = allWorkouts.length;
      const completedWorkouts = allWorkouts.filter(w => w.completed).length;
      const lateWorkouts = allWorkouts.filter(w => w.completedLate).length;
      const overallCompletionRate = totalWorkouts > 0
        ? Math.round((completedWorkouts / totalWorkouts) * 100)
        : 0;

      hasData = totalWorkouts > 0;

      const last7Days = allWorkouts.filter(w => w.date >= sevenDaysAgo);
      const last30Days = allWorkouts.filter(w => w.date >= thirtyDaysAgo);
      const last90Days = allWorkouts.filter(w => w.date >= ninetyDaysAgo);

      const workoutsByType: Record<string, { total: number; completed: number }> = {};
      allWorkouts.forEach(w => {
        if (!workoutsByType[w.type]) {
          workoutsByType[w.type] = { total: 0, completed: 0 };
        }
        workoutsByType[w.type].total++;
        if (w.completed) workoutsByType[w.type].completed++;
      });

      const pendingWorkouts = allWorkouts
        .filter(w => !w.completed && w.date >= now)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 5);

      const missedWorkouts = allWorkouts
        .filter(w => !w.completed && w.date < now)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 5);

      dataContext = `
${userName.toUpperCase()}'S WORKOUT DATA
${'='.repeat(userName.length + 15)}

OVERVIEW:
- Total Workouts (all time): ${totalWorkouts}
- Completed: ${completedWorkouts} (${overallCompletionRate}%)
- Late Completions: ${lateWorkouts}

RECENT ACTIVITY:
- Last 7 days: ${last7Days.length} workouts, ${last7Days.filter(w => w.completed).length} completed
- Last 30 days: ${last30Days.length} workouts, ${last30Days.filter(w => w.completed).length} completed
- Last 90 days: ${last90Days.length} workouts, ${last90Days.filter(w => w.completed).length} completed

WORKOUTS BY TYPE:
${Object.entries(workoutsByType).length > 0
  ? Object.entries(workoutsByType).map(([type, data]) =>
    `- ${type}: ${data.total} total, ${data.completed} completed (${data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0}%)`
  ).join('\n')
  : '- No workout data available'}

UPCOMING WORKOUTS:
${pendingWorkouts.length > 0
  ? pendingWorkouts.map(w => `- ${w.name} (${w.type}) - ${w.date.toLocaleDateString()}`).join('\n')
  : '- No upcoming workouts scheduled'}

MISSED WORKOUTS:
${missedWorkouts.length > 0
  ? missedWorkouts.map(w => `- ${w.name} (${w.type}) - ${w.date.toLocaleDateString()}`).join('\n')
  : '- No missed workouts'}

RECENT WORKOUT HISTORY (last 10):
${allWorkouts.length > 0
  ? allWorkouts
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10)
    .map(w => `- ${w.date.toLocaleDateString()}: ${w.name} (${w.type}) ${w.completed ? '✅' : '❌'}${w.completedLate ? ' (late)' : ''}`)
    .join('\n')
  : '- No workout history'}

Today's Date: ${now.toLocaleDateString()}
`;
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY.trim(),
    });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Here is my workout data:\n\n${dataContext}\n\nGenerate a report for: ${question}` },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    console.log('📝 AI response length:', responseText.length);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', responseText);
      return NextResponse.json({
        report: null,
        isInsufficient: true,
        insufficientMessage: 'Failed to generate report. Please try again.',
        hasData,
      });
    }

    // Normalize chart sections — auto-detect yKeys for multi-series data
    if (parsedResponse.sections && Array.isArray(parsedResponse.sections)) {
      for (const section of parsedResponse.sections) {
        if (section.type === 'chart' && section.data?.length > 0 && !section.yKeys) {
          const firstPoint = section.data[0];
          const numericKeys = Object.keys(firstPoint).filter(
            (k: string) => k !== section.xKey && typeof firstPoint[k] === 'number'
          );
          if (numericKeys.length > 1) {
            section.yKeys = numericKeys;
          } else if (numericKeys.length === 1 && !(section.yKey in firstPoint)) {
            section.yKey = numericKeys[0];
          }
        }
      }
    }

    // Check if it's an insufficient data response
    if (parsedResponse.insufficient) {
      return NextResponse.json({
        report: null,
        isInsufficient: true,
        insufficientMessage: parsedResponse.message || 'Not enough data available.',
        hasData,
      });
    }

    return NextResponse.json({
      report: parsedResponse,
      isInsufficient: false,
      hasData,
    });
  } catch (error: any) {
    console.error('Reports API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
}
