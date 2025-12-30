import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, recentWorkouts, preferences } = body;

    const prompt = `You are a professional fitness coach. Based on the following information about an athlete, suggest 3 diverse workout templates they should try next.

Recent Workouts:
${recentWorkouts && recentWorkouts.length > 0 
  ? recentWorkouts.map((w: any) => `- ${w.type}: ${w.name} (${w.date})`).join('\n')
  : 'No recent workouts'}

User Preferences:
- Sports/Activities: ${preferences?.sports || 'Various'}
- Experience Level: ${preferences?.level || 'Intermediate'}

Requirements:
1. Suggest 3 different workout types (swim, bike, run, strength, or other)
2. Make them varied and progressive
3. Each workout should be realistic and achievable
4. Include specific details (distances, durations, sets/reps)

Respond ONLY with valid JSON in this exact format (no markdown, no preamble):
[
  {
    "name": "Morning Speed Session",
    "type": "run",
    "description": "Interval training focused on building speed endurance",
    "duration": 60,
    "notes": "Warm up for 10 minutes, then 6x800m at 5K pace with 2 min recovery, cool down"
  },
  {
    "name": "Endurance Swim",
    "type": "swim",
    "description": "Build aerobic capacity with steady-state swimming",
    "duration": 45,
    "notes": "10x100m freestyle at moderate pace, 15 sec rest between sets"
  },
  {
    "name": "Core Strength Circuit",
    "type": "strength",
    "description": "Functional strength training for athletic performance",
    "duration": 40,
    "notes": "3 rounds: planks 60s, deadlifts 10 reps, russian twists 20 reps, rest 90s"
  }
]`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a professional fitness coach who provides workout suggestions in JSON format.'
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';

    // Parse the JSON response
    let suggestions;
    try {
      const parsed = JSON.parse(responseText);
      // Handle both array format and object with array property
      suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || parsed.workouts || []);
    } catch (parseError) {
      console.error('Failed to parse Groq response:', responseText);
      throw new Error('Failed to parse AI suggestions');
    }

    return NextResponse.json({
      suggestions,
      success: true,
    });
  } catch (error: any) {
    console.error('AI workout suggestions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions', success: false },
      { status: 500 }
    );
  }
}
