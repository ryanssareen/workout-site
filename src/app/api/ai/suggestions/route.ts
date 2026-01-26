export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { adminDb } from '@/lib/firebase/admin';

interface AthleteStats {
  name: string;
  email: string;
  totalWorkouts: number;
  completedWorkouts: number;
  completionRate: number;
  lateCompletions: number;
  missedWorkouts: number;
  recentActivity: string[];
  lastWorkoutDate?: Date;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error('❌ GROQ_API_KEY is not set');
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const { coachId, userEmail } = await req.json();

    if (!coachId) {
      console.error('❌ No coachId provided');
      return NextResponse.json(
        { error: 'Coach ID is required' },
        { status: 400 }
      );
    }

    console.log('📊 Generating suggestions for coach:', coachId);

    // Admin override: rsareen@gmail.com sees ALL athletes
    const isAdmin = userEmail === 'rsareen@gmail.com';
    console.log('👑 Admin mode:', isAdmin);

    // Get athletes
    console.log('1️⃣ Fetching athletes...');
    let athletesSnapshot;
    if (isAdmin) {
      // Admin sees ALL athletes (role = athlete)
      athletesSnapshot = await adminDb
        .collection('users')
        .where('role', '==', 'athlete')
        .get();
    } else {
      // Regular coach sees only their athletes
      athletesSnapshot = await adminDb
        .collection('users')
        .where('coachId', '==', coachId)
        .get();
    }
    console.log('   Found athletes:', athletesSnapshot.size);

    if (athletesSnapshot.empty) {
      console.log('⚠️ No athletes found');
      return NextResponse.json({
        suggestions: [],
        summary: 'No athletes found. Start by inviting athletes to join!',
        stats: {
          totalAthletes: 0,
          totalWorkouts: 0,
          overallCompletionRate: 0,
        },
      });
    }

    // Get workouts
    console.log('2️⃣ Fetching workouts...');
    let workoutsSnapshot;
    if (isAdmin) {
      // Admin sees ALL workouts
      workoutsSnapshot = await adminDb
        .collection('workouts')
        .get();
    } else {
      // Regular coach sees only their workouts
      workoutsSnapshot = await adminDb
        .collection('workouts')
        .where('createdBy', '==', coachId)
        .get();
    }
    console.log('   Found workouts:', workoutsSnapshot.size);

    // Analyze each athlete
    console.log('3️⃣ Analyzing athlete data...');
    const athleteStats: AthleteStats[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const athleteDoc of athletesSnapshot.docs) {
      const athlete = athleteDoc.data();
      const athleteId = athleteDoc.id;
      console.log(`   Processing athlete: ${athlete.displayName || 'Unnamed'} (${athleteId})`);

      // Get athlete's workouts with proper typing
      const athleteWorkouts = workoutsSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((w: any) => w.assignedTo === athleteId) as any[];
      console.log(`     -> ${athleteWorkouts.length} workouts assigned`);

      const recentWorkouts = athleteWorkouts.filter((w: any) => {
        const workoutDate = w.date?.toDate ? w.date.toDate() : new Date(w.date);
        return workoutDate >= thirtyDaysAgo;
      });

      const completed = recentWorkouts.filter((w: any) => w.completed);
      const late = completed.filter((w: any) => w.completedLate);
      const missed = recentWorkouts.filter((w: any) => {
        const workoutDate = w.date?.toDate ? w.date.toDate() : new Date(w.date);
        return !w.completed && workoutDate < new Date();
      });

      const lastWorkout = athleteWorkouts
        .sort((a: any, b: any) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        })[0];

      const lastWorkoutDate = lastWorkout?.date?.toDate 
        ? lastWorkout.date.toDate() 
        : lastWorkout?.date 
        ? new Date(lastWorkout.date)
        : undefined;

      athleteStats.push({
        name: athlete.displayName || 'Unnamed Athlete',
        email: athlete.email,
        totalWorkouts: recentWorkouts.length,
        completedWorkouts: completed.length,
        completionRate: recentWorkouts.length > 0 
          ? Math.round((completed.length / recentWorkouts.length) * 100)
          : 0,
        lateCompletions: late.length,
        missedWorkouts: missed.length,
        recentActivity: recentWorkouts.slice(0, 5).map((w: any) => 
          `${w.name} - ${w.completed ? '✅' : '❌'}`
        ),
        lastWorkoutDate: lastWorkoutDate,
      });
    }

    // Build analysis context for AI
    const analysisContext = `
COACHING DASHBOARD ANALYSIS - Last 30 Days

Total Athletes: ${athleteStats.length}
Total Workouts Assigned: ${athleteStats.reduce((sum, s) => sum + s.totalWorkouts, 0)}
Overall Completion Rate: ${Math.round(
  athleteStats.reduce((sum, s) => sum + s.completedWorkouts, 0) /
  Math.max(athleteStats.reduce((sum, s) => sum + s.totalWorkouts, 0), 1) * 100
)}%

ATHLETE BREAKDOWN:
${athleteStats.map(s => `
- ${s.name} (${s.email}):
  * Completion Rate: ${s.completionRate}%
  * Completed: ${s.completedWorkouts}/${s.totalWorkouts} workouts
  * Late Completions: ${s.lateCompletions}
  * Missed: ${s.missedWorkouts}
  * Last Workout: ${s.lastWorkoutDate ? s.lastWorkoutDate.toLocaleDateString() : 'Never'}
  * Recent: ${s.recentActivity.join(', ')}
`).join('\n')}

IDENTIFY:
1. Athletes who need attention (low completion, many missed workouts)
2. Athletes doing well (consistent, high completion)
3. Patterns (everyone missing Mondays? Too much volume?)
4. Actionable recommendations for the coach

Provide 5-7 specific, actionable suggestions in JSON format:
{
  "suggestions": [
    {
      "type": "warning" | "success" | "info",
      "title": "Short title",
      "description": "Detailed recommendation",
      "priority": "high" | "medium" | "low",
      "athletes": ["athlete names if relevant"]
    }
  ]
}
`;

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY.trim(),
    });

    console.log('4️⃣ Calling Groq AI...');
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert fitness coach advisor. Analyze athlete workout data and provide actionable coaching suggestions. Return ONLY valid JSON, no markdown or explanations.',
        },
        {
          role: 'user',
          content: analysisContext,
        },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '{}';
    console.log('✅ AI analysis complete, response length:', response.length);

    let aiSuggestions;
    try {
      aiSuggestions = JSON.parse(response);
    } catch (e) {
      console.error('Failed to parse AI response:', response);
      aiSuggestions = {
        suggestions: [
          {
            type: 'info',
            title: 'Analysis Complete',
            description: 'Your athletes are making progress! Keep monitoring their activity.',
            priority: 'low',
            athletes: [],
          },
        ],
      };
    }

    return NextResponse.json({
      ...aiSuggestions,
      stats: {
        totalAthletes: athleteStats.length,
        totalWorkouts: athleteStats.reduce((sum, s) => sum + s.totalWorkouts, 0),
        overallCompletionRate: Math.round(
          athleteStats.reduce((sum, s) => sum + s.completedWorkouts, 0) /
          Math.max(athleteStats.reduce((sum, s) => sum + s.totalWorkouts, 0), 1) * 100
        ),
      },
    });
  } catch (error: any) {
    console.error('❌ Suggestions API error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate suggestions',
        errorType: error.name || 'Unknown',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
