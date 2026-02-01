export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { adminDb } from '@/lib/firebase/admin';

const SYSTEM_PROMPT = `You are an expert fitness coach analytics assistant. You help coaches analyze their athletes' workout data and performance.

When responding to questions:
1. Be concise but thorough
2. Use data to support your answers
3. Format responses with markdown for readability (headers, bullet points, tables when appropriate)
4. Highlight key insights and actionable recommendations
5. If asked about specific athletes, focus on their data
6. If asked for comparisons, use tables or clear comparisons
7. Always be encouraging but honest about areas for improvement

You have access to the coach's complete workout and athlete data. Use it to provide accurate, data-driven answers.`;

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

    const { question, coachId, userEmail } = await req.json();

    if (!question || !coachId) {
      return NextResponse.json(
        { error: 'Question and coach ID are required' },
        { status: 400 }
      );
    }

    console.log('📊 Reports query:', question);

    // Admin override for rsareen@gmail.com
    const isAdmin = userEmail === 'rsareen@gmail.com';

    // Fetch athletes
    let athleteDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (isAdmin) {
      const [athleteSnapshot, studentSnapshot] = await Promise.all([
        adminDb.collection('users').where('role', '==', 'athlete').get(),
        adminDb.collection('users').where('role', '==', 'student').get()
      ]);
      athleteDocs = [...athleteSnapshot.docs, ...studentSnapshot.docs];
    } else {
      const coachAthletesSnapshot = await adminDb
        .collection('users')
        .where('coachId', '==', coachId)
        .get();
      athleteDocs = coachAthletesSnapshot.docs;
    }

    // Fetch workouts
    let workoutsSnapshot;
    if (isAdmin) {
      workoutsSnapshot = await adminDb.collection('workouts').get();
    } else {
      workoutsSnapshot = await adminDb
        .collection('workouts')
        .where('createdBy', '==', coachId)
        .get();
    }

    // Process data
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

    // Process workouts
    const allWorkouts: WorkoutData[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

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

      // Add to athlete's workouts
      const athlete = athleteMap.get(workout.assignedTo);
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

    // Calculate completion rates
    athleteMap.forEach(athlete => {
      athlete.completionRate = athlete.totalCount > 0
        ? Math.round((athlete.completedCount / athlete.totalCount) * 100)
        : 0;
    });

    const athletes = Array.from(athleteMap.values());

    // Build context for AI
    const totalWorkouts = allWorkouts.length;
    const completedWorkouts = allWorkouts.filter(w => w.completed).length;
    const overallCompletionRate = totalWorkouts > 0
      ? Math.round((completedWorkouts / totalWorkouts) * 100)
      : 0;

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

    const dataContext = `
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
${Object.entries(workoutsByType).map(([type, data]) =>
  `- ${type}: ${data.total} total, ${data.completed} completed (${Math.round((data.completed / data.total) * 100)}%)`
).join('\n')}

ATHLETE DETAILS:
${athletes.map(a => `
${a.name} (${a.email}):
  - Total Workouts: ${a.totalCount}
  - Completed: ${a.completedCount} (${a.completionRate}%)
  - Late Completions: ${a.lateCount}
  - Recent workouts: ${a.workouts.slice(-5).map(w =>
    `${w.name} (${w.type}) on ${w.date.toLocaleDateString()} - ${w.completed ? '✅' : '❌'}`
  ).join(', ')}
`).join('\n')}

Today's Date: ${now.toLocaleDateString()}
`;

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY.trim(),
    });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Here is my coaching data:\n\n${dataContext}\n\nMy question: ${question}` },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    const response = completion.choices[0]?.message?.content || 'Unable to generate response';

    return NextResponse.json({
      answer: response,
      stats: {
        totalAthletes: athletes.length,
        totalWorkouts,
        completionRate: overallCompletionRate,
      },
    });
  } catch (error: any) {
    console.error('Reports API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
}
