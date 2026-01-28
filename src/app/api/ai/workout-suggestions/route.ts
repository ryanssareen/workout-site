import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper to analyze training patterns
function analyzeTrainingData(recentWorkouts: any[]) {
  if (!recentWorkouts || recentWorkouts.length === 0) {
    return {
      totalWorkouts: 0,
      workoutsByType: {},
      averageFrequency: 0,
      lastWorkoutDaysAgo: null,
      hasConsistency: false,
    };
  }

  const workoutsByType: Record<string, number> = {};
  recentWorkouts.forEach((w: any) => {
    workoutsByType[w.type] = (workoutsByType[w.type] || 0) + 1;
  });

  return {
    totalWorkouts: recentWorkouts.length,
    workoutsByType,
    dominantType: Object.entries(workoutsByType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
    averageFrequency: recentWorkouts.length / 4, // Assuming last 4 weeks
    hasConsistency: recentWorkouts.length >= 8, // At least 2 per week
    needsVariety: Object.keys(workoutsByType).length < 2,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, recentWorkouts, preferences } = body;

    // Analyze training patterns
    const analysis = analyzeTrainingData(recentWorkouts);

    const prompt = `You are an experienced endurance sports coach and exercise physiologist. Analyze the athlete's training history and create 3 comprehensive, progressive workout plans.

## ATHLETE PROFILE

Recent Training History (Last 30 days):
${recentWorkouts && recentWorkouts.length > 0
  ? recentWorkouts.map((w: any) => `- ${w.type.toUpperCase()}: ${w.name} (${w.date})`).join('\n')
  : 'No recent workouts - New athlete or returning from break'}

Training Analysis:
- Total Workouts: ${analysis.totalWorkouts}
- Workout Distribution: ${Object.entries(analysis.workoutsByType).map(([type, count]) => `${type}: ${count}`).join(', ') || 'None'}
- Dominant Sport: ${analysis.dominantType}
- Training Frequency: ${analysis.averageFrequency.toFixed(1)} sessions/week
- Consistency: ${analysis.hasConsistency ? 'Good' : 'Needs Improvement'}
- Variety: ${analysis.needsVariety ? 'Needs More Cross-Training' : 'Well-Balanced'}

User Profile:
- Experience Level: ${preferences?.level || 'Intermediate'}
- Preferred Sports: ${preferences?.sports || 'Multi-sport athlete'}

## REQUIREMENTS

Create 3 COMPREHENSIVE workout plans that:
1. Fill training gaps (add variety if lacking, add volume if inconsistent)
2. Follow progressive overload principles
3. Balance intensity (include easy, moderate, and hard sessions)
4. Include sport-specific and cross-training options
5. Are realistic for the athlete's current level
6. Have detailed structure with warmup, main set, cooldown
7. Include clear rationale and expected benefits

## OUTPUT FORMAT

Respond ONLY with valid JSON - NO markdown, NO preamble, NO explanation outside JSON.

Return a JSON object with key "workouts" containing an array of 3 workouts in this EXACT structure:

{
  "workouts": [
    {
      "name": "Progressive Tempo Run",
      "type": "run",
      "difficulty": "moderate",
      "estimatedDuration": 60,
      "description": "Build aerobic endurance with sustained tempo effort",
      "rationale": "Your recent running has been mostly easy pace. This workout develops lactate threshold and race pace sustainment, crucial for improving performance without excessive fatigue.",
      "benefits": ["Improves lactate threshold", "Builds aerobic capacity", "Enhances pacing discipline", "Prepares for race efforts"],
      "warmup": "10 min easy jog, 5 min dynamic stretches (leg swings, lunges, high knees)",
      "mainSet": "3x 10 minutes at tempo pace (comfortably hard, conversational but challenging) with 3 min easy jog recovery between intervals",
      "cooldown": "10 min easy jog, 5 min static stretching focusing on hamstrings, calves, hip flexors",
      "targetPace": "15-20 seconds slower than 5K race pace",
      "intensityZones": "Zone 3-4 (75-85% max HR)",
      "keyFocus": ["Consistent pace", "Controlled breathing", "Relaxed shoulders", "Mid-foot strike"],
      "run": {
        "distance": 12,
        "distanceUnit": "km",
        "time": 60,
        "terrain": "road",
        "elevationGain": 100,
        "intervals": "3x10min tempo @ 4:30/km, 3min recovery"
      }
    },
    {
      "name": "Pyramid Swim Endurance",
      "type": "swim",
      "difficulty": "moderate",
      "estimatedDuration": 55,
      "description": "Build swimming endurance with progressive distance pyramid",
      "rationale": "Swimming provides excellent cross-training and recovery while building cardiovascular fitness. The pyramid structure keeps the session engaging while building aerobic capacity.",
      "benefits": ["Low-impact cardio", "Full-body conditioning", "Improved swim efficiency", "Active recovery for running legs"],
      "warmup": "400m easy mixed stroke (200 free, 100 back, 100 choice), 4x50m drill (catch-up, fingertip drag)",
      "mainSet": "Pyramid: 100-200-300-400-300-200-100m freestyle with 30-45 sec rest between each. Maintain consistent pace throughout.",
      "cooldown": "200m easy backstroke, 100m choice stroke focusing on long, smooth strokes",
      "targetPace": "Sustainable aerobic pace - able to complete full pyramid",
      "intensityZones": "Zone 2-3 (65-80% max HR)",
      "keyFocus": ["High elbow catch", "Bilateral breathing", "Strong kick", "Streamlined body position"],
      "swim": {
        "distance": 2500,
        "distanceUnit": "meters",
        "laps": 100,
        "stroke": "freestyle",
        "pool": "25m",
        "sets": "400m warmup + 1600m main (pyramid) + 300m cooldown"
      }
    },
    {
      "name": "Hill Power Intervals - Bike",
      "type": "bike",
      "difficulty": "hard",
      "estimatedDuration": 75,
      "description": "Develop climbing power and leg strength through hill repeats",
      "rationale": "Hill intervals build muscular endurance, power output, and mental toughness. They're crucial for developing the strength needed for racing and challenging terrain.",
      "benefits": ["Increases power output", "Strengthens climbing muscles", "Improves lactate clearance", "Builds mental resilience"],
      "warmup": "20 min easy spinning on flat terrain, gradually building from Z1 to Z2, include 3x 30sec spin-ups (high cadence)",
      "mainSet": "6x 4-minute hill intervals at hard effort (85-90% max HR), maintaining cadence 70-80 RPM. Descend easy for full recovery (4-5 min)",
      "cooldown": "15 min easy spinning on flat, gradually reducing intensity, finish with light stretching on bike",
      "targetPace": "Sustainable hard effort - should finish each interval strong",
      "intensityZones": "Intervals: Zone 4-5 (85-95% max HR), Recovery: Zone 1-2",
      "keyFocus": ["Steady power output", "Maintain cadence on climbs", "Stay seated for first 3 intervals", "Use standing for last 3 intervals"],
      "bike": {
        "distance": 38,
        "distanceUnit": "km",
        "time": 75,
        "terrain": "hills",
        "elevationGain": 650,
        "power": 240,
        "cadence": 75,
        "intervals": "6x4min hill repeats @ 240W, 4-5min recovery"
      }
    }
  ]
}

CRITICAL RULES:
- Must include all fields shown in the example
- All 3 workouts must have DIFFERENT types
- If athlete lacks variety, prioritize cross-training options
- Scale difficulty appropriately to athlete's recent training
- mainSet should be specific and detailed with exact intervals/sets
- rationale must explain WHY this workout NOW based on their training
- benefits must be a JSON array of strings
- keyFocus must be a JSON array of 3-4 technique points`;

    console.log('🤖 Generating comprehensive AI workout suggestions...');
    console.log('📊 Training analysis:', analysis);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an experienced endurance sports coach and exercise physiologist. You create detailed, evidence-based workout plans with comprehensive structure including warmup, main sets, cooldown, rationale, and expected benefits. Always respond with properly formatted JSON.'
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8, // Slightly higher for more creative workout variations
      max_tokens: 4000, // Increased for comprehensive responses
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    console.log('✅ AI response received, parsing...');

    // Parse the JSON response
    let suggestions;
    try {
      const parsed = JSON.parse(responseText);

      // Extract workouts array from the response
      suggestions = parsed.workouts || parsed.suggestions || [];

      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        console.error('Invalid response structure:', parsed);
        throw new Error('AI did not return valid workout suggestions');
      }

      // Validate each suggestion has required fields
      suggestions = suggestions.map((workout: any, index: number) => {
        if (!workout.name || !workout.type) {
          console.warn(`Workout ${index} missing required fields, skipping`);
          return null;
        }

        // Ensure all expected fields exist with defaults
        return {
          ...workout,
          difficulty: workout.difficulty || 'moderate',
          estimatedDuration: workout.estimatedDuration || 60,
          description: workout.description || '',
          rationale: workout.rationale || 'Recommended based on your training history',
          benefits: Array.isArray(workout.benefits) ? workout.benefits : [],
          warmup: workout.warmup || 'Standard warmup routine',
          mainSet: workout.mainSet || 'Main workout set',
          cooldown: workout.cooldown || 'Standard cooldown routine',
          keyFocus: Array.isArray(workout.keyFocus) ? workout.keyFocus : [],
        };
      }).filter(Boolean); // Remove any null entries

      console.log(`✅ Successfully parsed ${suggestions.length} comprehensive workouts`);
    } catch (parseError) {
      console.error('Failed to parse Groq response:', responseText);
      console.error('Parse error:', parseError);
      throw new Error('Failed to parse AI suggestions - invalid JSON format');
    }

    return NextResponse.json({
      suggestions,
      analysis, // Include training analysis in response
      success: true,
    });
  } catch (error: any) {
    console.error('❌ AI workout suggestions error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to generate suggestions',
        success: false,
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
