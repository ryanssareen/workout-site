export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const { workout, userContext, athleteProfile } = await req.json();

    if (!workout) {
      return NextResponse.json(
        { error: 'Workout data is required' },
        { status: 400 }
      );
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY.trim(),
    });

    const prompt = `Analyze this workout and provide brief, actionable recommendations:

WORKOUT:
- Name: ${workout.name}
- Type: ${workout.type}
- Duration: ${workout.duration || 'Not specified'} minutes
- Description: ${workout.description}
- Date: ${workout.date}
${workout.completed ? `- Status: Completed${workout.completedLate ? ' (late)' : ''}` : '- Status: Upcoming'}
${workout.completionNotes ? `- Completion Notes: ${workout.completionNotes}` : ''}

${userContext ? `USER CONTEXT: ${userContext}` : ''}
${athleteProfile?.sportPreferences?.length ? `PREFERRED SPORTS: ${athleteProfile.sportPreferences.join(', ')}` : ''}
${athleteProfile?.fitnessGoals?.length ? `FITNESS GOALS: ${athleteProfile.fitnessGoals.join(', ')}` : ''}

Provide 3-5 brief, specific recommendations in JSON format:
{
  "recommendations": [
    "Short actionable suggestion 1",
    "Short actionable suggestion 2",
    "Short actionable suggestion 3"
  ],
  "summary": "One sentence overall assessment"
}

Focus on:
- Workout optimization (timing, intensity, recovery)
- Technique tips for the exercise type
- Motivation or completion strategies
- Recovery or preparation advice

Keep each recommendation under 20 words.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a professional fitness coach providing brief, actionable workout recommendations. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(response);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Workout recommendation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}
