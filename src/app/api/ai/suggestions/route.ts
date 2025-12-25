import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getUserWorkouts, getCoachStudents } from '@/lib/firebase/firestore';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY?.trim(),
});

const SYSTEM_PROMPT = `You are an expert fitness business consultant and coach advisor. Analyze coaching data and provide actionable, specific suggestions to improve their coaching business.

Your suggestions should be:
- Data-driven and specific (use the numbers provided)
- Actionable (clear next steps)
- Encouraging but honest
- Focused on improving student outcomes and business growth
- Professional and expert-level

Format your response with clear sections:
1. **Key Insights** - What the data shows
2. **Strengths** - What they're doing well
3. **Opportunities** - Where they can improve
4. **Action Items** - Specific steps to take this week

Use emojis sparingly and professionally. Be concise but thorough.`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const { userId, role } = await req.json();

    if (role !== 'coach') {
      return NextResponse.json(
        { error: 'Only available for coaches' },
        { status: 403 }
      );
    }

    // Get coach's data
    const [students, workouts] = await Promise.all([
      getCoachStudents(userId),
      getUserWorkouts(userId, 'coach'),
    ]);

    // Analyze the data
    const totalWorkouts = workouts.length;
    const completedWorkouts = workouts.filter(w => w.completed).length;
    const lateCompletions = workouts.filter(w => w.completedLate).length;
    const missedWorkouts = workouts.filter(w => {
      const isPast = w.date.toDate() < new Date();
      return isPast && !w.completed;
    }).length;

    const completionRate = totalWorkouts > 0 
      ? Math.round((completedWorkouts / totalWorkouts) * 100) 
      : 0;

    // Workout type distribution
    const typeDistribution: Record<string, number> = {};
    workouts.forEach(w => {
      typeDistribution[w.type] = (typeDistribution[w.type] || 0) + 1;
    });

    // Recent 30 days activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentWorkouts = workouts.filter(w => w.date.toDate() >= thirtyDaysAgo);

    // Student-specific stats
    const studentStats: Record<string, { assigned: number; completed: number }> = {};
    workouts.forEach(w => {
      if (!studentStats[w.assignedTo]) {
        studentStats[w.assignedTo] = { assigned: 0, completed: 0 };
      }
      studentStats[w.assignedTo].assigned++;
      if (w.completed) {
        studentStats[w.assignedTo].completed++;
      }
    });

    const avgStudentCompletion = Object.values(studentStats).reduce((sum, stats) => {
      const rate = stats.assigned > 0 ? stats.completed / stats.assigned : 0;
      return sum + rate;
    }, 0) / Math.max(Object.keys(studentStats).length, 1);

    // Workouts with notes vs without
    const workoutsWithNotes = workouts.filter(w => w.description && w.description.length > 50);
    const completionRateWithNotes = workoutsWithNotes.length > 0
      ? Math.round((workoutsWithNotes.filter(w => w.completed).length / workoutsWithNotes.length) * 100)
      : 0;
    const completionRateWithoutNotes = (totalWorkouts - workoutsWithNotes.length) > 0
      ? Math.round(((completedWorkouts - workoutsWithNotes.filter(w => w.completed).length) / (totalWorkouts - workoutsWithNotes.length)) * 100)
      : 0;

    // Build context for AI
    const dataContext = `
COACH BUSINESS DATA ANALYSIS:

Student Base:
- Total Active Students: ${students.length}
- Students with Workouts: ${Object.keys(studentStats).length}

Workout Programming:
- Total Workouts Created: ${totalWorkouts}
- Last 30 Days: ${recentWorkouts.length} workouts assigned
- Workout Types: ${Object.entries(typeDistribution)
      .map(([type, count]) => `${type}: ${count} (${Math.round((count / totalWorkouts) * 100)}%)`)
      .join(', ')}

Student Engagement:
- Overall Completion Rate: ${completionRate}%
- Average Student Completion: ${Math.round(avgStudentCompletion * 100)}%
- Completed Workouts: ${completedWorkouts}
- Late Completions: ${lateCompletions} (${totalWorkouts > 0 ? Math.round((lateCompletions / totalWorkouts) * 100) : 0}%)
- Missed Workouts: ${missedWorkouts}

Programming Quality:
- Detailed Workouts (good descriptions): ${workoutsWithNotes.length}
- Basic Workouts (minimal description): ${totalWorkouts - workoutsWithNotes.length}
- Completion Rate (Detailed): ${completionRateWithNotes}%
- Completion Rate (Basic): ${completionRateWithoutNotes}%

Top Performing Students:
${Object.entries(studentStats)
  .sort((a, b) => {
    const rateA = a[1].completed / a[1].assigned;
    const rateB = b[1].completed / b[1].assigned;
    return rateB - rateA;
  })
  .slice(0, 3)
  .map((s, i) => {
    const student = students.find(st => st.uid === s[0]);
    const rate = Math.round((s[1].completed / s[1].assigned) * 100);
    return `${i + 1}. ${student?.displayName || 'Student'}: ${rate}% (${s[1].completed}/${s[1].assigned})`;
  })
  .join('\n')}

Students Needing Attention:
${Object.entries(studentStats)
  .filter(([_, stats]) => stats.assigned >= 5) // Only students with at least 5 workouts
  .sort((a, b) => {
    const rateA = a[1].completed / a[1].assigned;
    const rateB = b[1].completed / b[1].assigned;
    return rateA - rateB;
  })
  .slice(0, 3)
  .map((s, i) => {
    const student = students.find(st => st.uid === s[0]);
    const rate = Math.round((s[1].completed / s[1].assigned) * 100);
    return `${i + 1}. ${student?.displayName || 'Student'}: ${rate}% (${s[1].completed}/${s[1].assigned})`;
  })
  .join('\n')}

Based on this data, provide specific, actionable suggestions to improve this coaching business.`;

    console.log('🤖 Generating AI suggestions for coach:', userId);

    // Call Groq API
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: dataContext },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 0.9,
    });

    const suggestions = completion.choices[0]?.message?.content || 'Unable to generate suggestions';

    console.log('✅ AI suggestions generated successfully');

    return NextResponse.json({
      suggestions,
      dataSnapshot: {
        students: students.length,
        totalWorkouts,
        completionRate,
        recentActivity: recentWorkouts.length,
      },
    });

  } catch (error: any) {
    console.error('AI suggestions error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate suggestions',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
