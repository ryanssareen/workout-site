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
4. Include STRUCTURED data for each type with proper fields

Respond ONLY with valid JSON in this EXACT format (no markdown, no preamble):

For RUN workouts:
{
  "name": "Morning Speed Session",
  "type": "run",
  "run": {
    "distance": 10,
    "distanceUnit": "km",
    "time": 55,
    "terrain": "road",
    "elevationGain": 150
  }
}

For SWIM workouts:
{
  "name": "Endurance Swim",
  "type": "swim",
  "swim": {
    "distance": 2000,
    "distanceUnit": "meters",
    "laps": 40,
    "stroke": "freestyle",
    "pool": "25m"
  }
}

For BIKE workouts:
{
  "name": "Hill Intervals",
  "type": "bike",
  "bike": {
    "distance": 30,
    "distanceUnit": "km",
    "time": 75,
    "terrain": "hills",
    "power": 220,
    "cadence": 85
  }
}

For STRENGTH workouts:
{
  "name": "Core Strength Circuit",
  "type": "strength",
  "strength": {
    "exercises": ["Planks", "Deadlifts", "Russian Twists", "Pull-ups"],
    "sets": 3,
    "reps": 10,
    "weight": 60,
    "restTime": 90
  }
}

For OTHER workouts:
{
  "name": "Mobility Work",
  "type": "other",
  "other": {
    "description": "Full body mobility and flexibility routine",
    "duration": 45,
    "notes": "Focus on hip flexors, shoulders, and ankle mobility"
  }
}

Return an array of exactly 3 workouts with different types.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a professional fitness coach who provides workout suggestions with structured data in JSON format.'
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
