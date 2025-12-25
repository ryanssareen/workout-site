import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface StudentStats {
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
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const { coachId } = await req.json();

    if (!coachId) {
      return NextResponse.json(
        { error: 'Coach ID is required' },
        { status: 400 }
      );
    }

    console.log('📊 Generating suggestions for coach:', coachId);

    // Get all students for this coach
    const usersRef = collection(db, 'users');
    const studentsQuery = query(usersRef, where('coachId', '==', coachId));
    const studentsSnap = await getDocs(studentsQuery);

    if (studentsSnap.empty) {
      return NextResponse.json({
        suggestions: [],
        summary: 'No students found. Start by inviting students to join!',
      });
    }

    // Get all workouts for this coach
    const workoutsRef = collection(db, 'workouts');
    const workoutsQuery = query(workoutsRef, where('createdBy', '==', coachId));
    const workoutsSnap = await getDocs(workoutsQuery);

    // Analyze each student
    const studentStats: StudentStats[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      const studentId = studentDoc.id;

      // Get student's workouts
      const studentWorkouts = workoutsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((w: any) => w.assignedTo === studentId);

      const recentWorkouts = studentWorkouts.filter((w: any) => {
        const workoutDate = w.date.toDate();
        return workoutDate >= thirtyDaysAgo;
      });

      const completed = recentWorkouts.filter((w: any) => w.completed);
      const late = completed.filter((w: any) => w.completedLate);
      const missed = recentWorkouts.filter((w: any) => {
        const workoutDate = w.date.toDate();
        return !w.completed && workoutDate < new Date();
      });

      const lastWorkout = studentWorkouts
        .sort((a: any, b: any) => b.date.toDate().getTime() - a.date.toDate().getTime())[0];

      studentStats.push({
        name: student.displayName || 'Unnamed Student',
        email: student.email,
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
        lastWorkoutDate: lastWorkout?.date.toDate(),
      });
    }

    // Build analysis context for AI
    const analysisContext = `
COACHING DASHBOARD ANALYSIS - Last 30 Days

Total Students: ${studentStats.length}
Total Workouts Assigned: ${studentStats.reduce((sum, s) => sum + s.totalWorkouts, 0)}
Overall Completion Rate: ${Math.round(
  studentStats.reduce((sum, s) => sum + s.completedWorkouts, 0) / 
  Math.max(studentStats.reduce((sum, s) => sum + s.totalWorkouts, 0), 1) * 100
)}%

STUDENT BREAKDOWN:
${studentStats.map(s => `
- ${s.name} (${s.email}):
  * Completion Rate: ${s.completionRate}%
  * Completed: ${s.completedWorkouts}/${s.totalWorkouts} workouts
  * Late Completions: ${s.lateCompletions}
  * Missed: ${s.missedWorkouts}
  * Last Workout: ${s.lastWorkoutDate ? s.lastWorkoutDate.toLocaleDateString() : 'Never'}
  * Recent: ${s.recentActivity.join(', ')}
`).join('\n')}

IDENTIFY:
1. Students who need attention (low completion, many missed workouts)
2. Students doing well (consistent, high completion)
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
      "students": ["student names if relevant"]
    }
  ]
}
`;

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY.trim(),
    });

    console.log('🤖 Calling Groq for analysis...');
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert fitness coach advisor. Analyze student workout data and provide actionable coaching suggestions. Return ONLY valid JSON, no markdown or explanations.',
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
    console.log('✅ AI analysis complete');

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
            description: 'Your students are making progress! Keep monitoring their activity.',
            priority: 'low',
            students: [],
          },
        ],
      };
    }

    return NextResponse.json({
      ...aiSuggestions,
      stats: {
        totalStudents: studentStats.length,
        totalWorkouts: studentStats.reduce((sum, s) => sum + s.totalWorkouts, 0),
        overallCompletionRate: Math.round(
          studentStats.reduce((sum, s) => sum + s.completedWorkouts, 0) / 
          Math.max(studentStats.reduce((sum, s) => sum + s.totalWorkouts, 0), 1) * 100
        ),
      },
    });
  } catch (error: any) {
    console.error('Suggestions API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
