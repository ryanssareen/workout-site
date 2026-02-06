import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

// Helper to analyze training patterns
function analyzeTrainingData(recentWorkouts: any[]) {
  if (!recentWorkouts || recentWorkouts.length === 0) {
    return {
      totalWorkouts: 0,
      workoutsByType: {},
      dominantType: 'none',
      averageFrequency: 0,
      hasConsistency: false,
      needsVariety: true,
      lastWorkoutDaysAgo: null,
      longestGapDays: null,
      totalDurationMinutes: 0,
      averageDurationMinutes: 0,
      completedRate: 0,
      distanceByType: {},
      tagCounts: {},
    };
  }

  const workoutsByType: Record<string, number> = {};
  const distanceByType: Record<string, Record<string, number>> = {};
  const tagCounts: Record<string, number> = {};
  const dates: Date[] = [];
  let totalDurationMinutes = 0;
  let durationSamples = 0;
  let completedCount = 0;

  const addDistance = (type: string, distance?: number, unit?: string) => {
    if (!distance || !unit) return;
    if (!distanceByType[type]) distanceByType[type] = {};
    distanceByType[type][unit] = (distanceByType[type][unit] || 0) + distance;
  };

  recentWorkouts.forEach((w: any) => {
    if (!w) return;

    if (w.type) {
      workoutsByType[w.type] = (workoutsByType[w.type] || 0) + 1;
    }

    if (Array.isArray(w.tags)) {
      w.tags.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }

    if (w.completed) completedCount += 1;

    const parsedDate = w.date ? new Date(w.date) : null;
    if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
      dates.push(parsedDate);
    }

    const sessionMinutes =
      w.duration ??
      w.run?.time ??
      w.bike?.time ??
      w.swim?.time ??
      w.strength?.totalTime ??
      w.other?.duration;

    if (typeof sessionMinutes === 'number' && !Number.isNaN(sessionMinutes)) {
      totalDurationMinutes += sessionMinutes;
      durationSamples += 1;
    }

    if (w.type === 'run' && w.run) addDistance('run', w.run.distance, w.run.distanceUnit);
    if (w.type === 'bike' && w.bike) addDistance('bike', w.bike.distance, w.bike.distanceUnit);
    if (w.type === 'swim' && w.swim) addDistance('swim', w.swim.distance, w.swim.distanceUnit);
  });

  const dominantType = Object.entries(workoutsByType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
  const averageDurationMinutes = durationSamples > 0 ? totalDurationMinutes / durationSamples : 0;
  const completedRate = recentWorkouts.length > 0
    ? Math.round((completedCount / recentWorkouts.length) * 100)
    : 0;

  let averageFrequency = recentWorkouts.length / 4; // Fallback to 4-week assumption
  let lastWorkoutDaysAgo: number | null = null;
  let longestGapDays: number | null = null;

  if (dates.length > 0) {
    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const first = sortedDates[0];
    const last = sortedDates[sortedDates.length - 1];
    const spanDays = Math.max(7, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
    averageFrequency = recentWorkouts.length / (spanDays / 7);
    lastWorkoutDaysAgo = Math.round((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));

    if (sortedDates.length > 1) {
      let maxGap = 0;
      for (let i = 1; i < sortedDates.length; i += 1) {
        const gap = (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        if (gap > maxGap) maxGap = gap;
      }
      longestGapDays = Math.round(maxGap);
    } else {
      longestGapDays = 0;
    }
  }

  return {
    totalWorkouts: recentWorkouts.length,
    workoutsByType,
    dominantType,
    averageFrequency,
    hasConsistency: recentWorkouts.length >= 8,
    needsVariety: Object.keys(workoutsByType).length < 2,
    lastWorkoutDaysAgo,
    longestGapDays,
    totalDurationMinutes,
    averageDurationMinutes,
    completedRate,
    distanceByType,
    tagCounts,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, recentWorkouts, preferences } = body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured. Please add it to the environment.' },
        { status: 503 },
      );
    }

    const groq = new Groq({ apiKey });

    // Analyze training patterns
    const analysis = analyzeTrainingData(recentWorkouts);

    const distanceSummary = Object.entries(analysis.distanceByType || {})
      .map(([type, units]) => {
        const unitSummary = Object.entries(units || {})
          .map(([unit, value]) => `${value.toFixed(1)} ${unit}`)
          .join(', ');
        return unitSummary ? `${type}: ${unitSummary}` : '';
      })
      .filter(Boolean)
      .join(' • ') || 'None';

    const tagSummary = Object.entries(analysis.tagCounts || {})
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => `${tag}: ${count}`)
      .join(', ') || 'None';

    const recentHistory = recentWorkouts && recentWorkouts.length > 0
      ? recentWorkouts.map((w: any) => {
          const parsedDate = w.date ? new Date(w.date) : null;
          const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toISOString().slice(0, 10)
            : (typeof w.date === 'string' ? w.date : 'Recent');
          const duration = w.duration ?? w.run?.time ?? w.bike?.time ?? w.swim?.time ?? w.strength?.totalTime ?? w.other?.duration;
          const distance = w.run?.distance
            ? `${w.run.distance}${w.run.distanceUnit}`
            : w.bike?.distance
              ? `${w.bike.distance}${w.bike.distanceUnit}`
              : w.swim?.distance
                ? `${w.swim.distance}${w.swim.distanceUnit}`
                : null;
          const tagList = Array.isArray(w.tags) && w.tags.length > 0 ? ` | tags: ${w.tags.join(', ')}` : '';
          const status = w.completed ? 'completed' : 'planned';
          return `- ${(w.type || 'workout').toUpperCase()}: ${w.name || 'Unnamed'} (${dateLabel}) | ${status}${duration ? ` | ${duration} min` : ''}${distance ? ` | ${distance}` : ''}${tagList}`;
        }).join('\n')
      : 'No recent workouts - New athlete or returning from break';

    const prompt = `You are an experienced endurance sports coach and exercise physiologist. Analyze the athlete's training history and create 3 comprehensive, progressive workout plans.

## ATHLETE PROFILE

Recent Training History (Last 30 days):
${recentHistory}

Training Analysis:
- Total Workouts: ${analysis.totalWorkouts}
- Workout Distribution: ${Object.entries(analysis.workoutsByType).map(([type, count]) => `${type}: ${count}`).join(', ') || 'None'}
- Dominant Sport: ${analysis.dominantType}
- Training Frequency: ${analysis.averageFrequency.toFixed(1)} sessions/week
- Consistency: ${analysis.hasConsistency ? 'Good' : 'Needs Improvement'}
- Variety: ${analysis.needsVariety ? 'Needs More Cross-Training' : 'Well-Balanced'}
- Completion Rate: ${analysis.completedRate}%
- Total Training Time: ${analysis.totalDurationMinutes.toFixed(0)} min (avg ${analysis.averageDurationMinutes.toFixed(0)} min/session)
- Distance Totals: ${distanceSummary}
- Last Workout: ${analysis.lastWorkoutDaysAgo ?? 'Unknown'} day(s) ago
- Longest Gap: ${analysis.longestGapDays ?? 'Unknown'} day(s)
- Tag Summary: ${tagSummary}

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
      "objective": "Improve lactate threshold and pacing control",
      "sessionType": "tempo / threshold",
      "description": "Build aerobic endurance with sustained tempo effort",
      "rationale": "Your recent running has been mostly easy pace. This workout develops lactate threshold and race pace sustainment, crucial for improving performance without excessive fatigue.",
      "benefits": ["Improves lactate threshold", "Builds aerobic capacity", "Enhances pacing discipline", "Prepares for race efforts"],
      "energySystems": ["aerobic", "threshold"],
      "rpe": 7,
      "warmup": "10 min easy jog, 5 min dynamic stretches (leg swings, lunges, high knees)",
      "mainSet": "3x 10 minutes at tempo pace (comfortably hard, conversational but challenging) with 3 min easy jog recovery between intervals",
      "cooldown": "10 min easy jog, 5 min static stretching focusing on hamstrings, calves, hip flexors",
      "targetPace": "15-20 seconds slower than 5K race pace",
      "intensityZones": "Zone 3-4 (75-85% max HR)",
      "zoneDistribution": "Z1 10m, Z2 15m, Z3 25m, Z4 10m",
      "keyFocus": ["Consistent pace", "Controlled breathing", "Relaxed shoulders", "Mid-foot strike"],
      "techniqueCues": ["Tall posture", "Quick cadence", "Soft landing", "Relaxed jaw"],
      "commonMistakes": ["Starting too fast", "Overstriding", "Holding breath"],
      "run": {
        "distance": 12,
        "distanceUnit": "km",
        "time": 60,
        "terrain": "road",
        "elevationGain": 100,
        "intervals": "3x10min tempo @ 4:30/km, 3min recovery"
      },
      "segments": [
        { "name": "Warmup", "duration": 15, "intensity": "Z1-2", "notes": "Easy jog + dynamic drills" },
        { "name": "Main Set", "duration": 30, "intensity": "Z3-4", "notes": "3x10 min tempo, 3 min easy jog" },
        { "name": "Cooldown", "duration": 10, "intensity": "Z1", "notes": "Easy jog + mobility" }
      ],
      "equipment": ["Running shoes", "Watch or timer"],
      "environment": "Road or treadmill",
      "nutrition": {
        "pre": "Light carb snack 60-90 min before",
        "during": "Water; electrolytes if hot",
        "post": "Carbs + protein within 60 min"
      },
      "recoveryTips": ["5-10 min easy walk", "Foam roll calves and quads", "Prioritize sleep tonight"],
      "timeCrunchedOption": "2x10 min tempo with 2 min recovery",
      "lowImpactAlternative": "Elliptical tempo intervals at same RPE",
      "progression": "Add 1-2 min to each tempo rep next time",
      "safetyNotes": ["Stop if sharp pain", "Adjust pace if HR drifts excessively"]
    },
    {
      "name": "Pyramid Swim Endurance",
      "type": "swim",
      "difficulty": "moderate",
      "estimatedDuration": 55,
      "objective": "Build aerobic endurance and stroke efficiency",
      "sessionType": "aerobic endurance",
      "description": "Build swimming endurance with progressive distance pyramid",
      "rationale": "Swimming provides excellent cross-training and recovery while building cardiovascular fitness. The pyramid structure keeps the session engaging while building aerobic capacity.",
      "benefits": ["Low-impact cardio", "Full-body conditioning", "Improved swim efficiency", "Active recovery for running legs"],
      "energySystems": ["aerobic"],
      "rpe": 6,
      "warmup": "400m easy mixed stroke (200 free, 100 back, 100 choice), 4x50m drill (catch-up, fingertip drag)",
      "mainSet": "Pyramid: 100-200-300-400-300-200-100m freestyle with 30-45 sec rest between each. Maintain consistent pace throughout.",
      "cooldown": "200m easy backstroke, 100m choice stroke focusing on long, smooth strokes",
      "targetPace": "Sustainable aerobic pace - able to complete full pyramid",
      "intensityZones": "Zone 2-3 (65-80% max HR)",
      "zoneDistribution": "Z1 10m, Z2 30m, Z3 15m",
      "keyFocus": ["High elbow catch", "Bilateral breathing", "Strong kick", "Streamlined body position"],
      "techniqueCues": ["Long strokes", "Early vertical forearm", "Stable head"],
      "commonMistakes": ["Overkicking early", "Crossing midline", "Holding breath"],
      "swim": {
        "distance": 2500,
        "distanceUnit": "meters",
        "laps": 100,
        "stroke": "freestyle",
        "pool": "25m",
        "sets": "400m warmup + 1600m main (pyramid) + 300m cooldown"
      },
      "segments": [
        { "name": "Warmup", "duration": 12, "intensity": "Easy", "notes": "Mixed strokes + drills" },
        { "name": "Main Set", "duration": 33, "intensity": "Steady", "notes": "Pyramid 100-200-300-400-300-200-100" },
        { "name": "Cooldown", "duration": 10, "intensity": "Easy", "notes": "Backstroke + choice stroke" }
      ],
      "equipment": ["Goggles", "Pull buoy (optional)"],
      "environment": "Pool (25m or 25y)",
      "nutrition": {
        "pre": "Small carb snack 30-60 min before",
        "during": "Water on deck",
        "post": "Protein + carbs"
      },
      "recoveryTips": ["Light shoulder mobility", "Hydrate post-session"],
      "timeCrunchedOption": "100-200-300-200-100 pyramid",
      "lowImpactAlternative": "Easy spin on bike at Z2 for 40 min",
      "progression": "Add 50m to the peak of the pyramid",
      "safetyNotes": ["Stop if shoulder pain increases"]
    },
    {
      "name": "Hill Power Intervals - Bike",
      "type": "bike",
      "difficulty": "hard",
      "estimatedDuration": 75,
      "objective": "Develop climbing power and muscular endurance",
      "sessionType": "hill intervals",
      "description": "Develop climbing power and leg strength through hill repeats",
      "rationale": "Hill intervals build muscular endurance, power output, and mental toughness. They're crucial for developing the strength needed for racing and challenging terrain.",
      "benefits": ["Increases power output", "Strengthens climbing muscles", "Improves lactate clearance", "Builds mental resilience"],
      "energySystems": ["threshold", "VO2"],
      "rpe": 8,
      "warmup": "20 min easy spinning on flat terrain, gradually building from Z1 to Z2, include 3x 30sec spin-ups (high cadence)",
      "mainSet": "6x 4-minute hill intervals at hard effort (85-90% max HR), maintaining cadence 70-80 RPM. Descend easy for full recovery (4-5 min)",
      "cooldown": "15 min easy spinning on flat, gradually reducing intensity, finish with light stretching on bike",
      "targetPace": "Sustainable hard effort - should finish each interval strong",
      "intensityZones": "Intervals: Zone 4-5 (85-95% max HR), Recovery: Zone 1-2",
      "zoneDistribution": "Z1 20m, Z2 15m, Z4-5 24m",
      "keyFocus": ["Steady power output", "Maintain cadence on climbs", "Stay seated for first 3 intervals", "Use standing for last 3 intervals"],
      "techniqueCues": ["Smooth torque", "Stable core", "Relaxed upper body"],
      "commonMistakes": ["Grinding too low cadence", "Skipping full recovery", "Overpacing early"],
      "bike": {
        "distance": 38,
        "distanceUnit": "km",
        "time": 75,
        "terrain": "hills",
        "elevationGain": 650,
        "power": 240,
        "cadence": 75,
        "intervals": "6x4min hill repeats @ 240W, 4-5min recovery"
      },
      "segments": [
        { "name": "Warmup", "duration": 20, "intensity": "Z1-2", "notes": "Include 3x30s spin-ups" },
        { "name": "Main Set", "duration": 30, "intensity": "Z4-5", "notes": "6x4 min hill repeats" },
        { "name": "Cooldown", "duration": 15, "intensity": "Z1", "notes": "Easy spin + stretch" }
      ],
      "equipment": ["Bike", "Helmet", "HR monitor or power meter"],
      "environment": "Hilly route or indoor trainer",
      "nutrition": {
        "pre": "Carb-rich meal 2-3 hours before",
        "during": "30-45g carbs/hour + electrolytes",
        "post": "20-30g protein + carbs"
      },
      "recoveryTips": ["Easy spin later in day", "Legs up for 10 min"],
      "timeCrunchedOption": "4x4 min hill repeats with 3 min recovery",
      "lowImpactAlternative": "Seated high-resistance intervals on trainer",
      "progression": "Add 1 interval or increase power by 5-10W",
      "safetyNotes": ["Use controlled descents", "Avoid slick roads"]
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
- keyFocus must be a JSON array of 3-4 technique points
- objective and sessionType must be specific and concise
- techniqueCues must be a JSON array of 3-5 items
- commonMistakes must be a JSON array of 2-4 items
- energySystems must be a JSON array
- rpe must be a number from 1-10
- segments must be an array of objects with name, duration (minutes), intensity, notes
- nutrition must include pre, during, post fields
- recoveryTips and safetyNotes must be JSON arrays
- timeCrunchedOption, lowImpactAlternative, progression must be specific and actionable`;

    console.log('🤖 Generating comprehensive AI workout suggestions...');
    console.log('📊 Training analysis:', analysis);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an experienced endurance sports coach and exercise physiologist. You create detailed, evidence-based workout plans with comprehensive structure including warmup, main sets, cooldown, segments, technique cues, fueling, recovery, and expected benefits. Always respond with properly formatted JSON.'
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
          objective: workout.objective || '',
          sessionType: workout.sessionType || '',
          description: workout.description || '',
          rationale: workout.rationale || 'Recommended based on your training history',
          benefits: Array.isArray(workout.benefits) ? workout.benefits : [],
          energySystems: Array.isArray(workout.energySystems) ? workout.energySystems : [],
          rpe: typeof workout.rpe === 'number' ? workout.rpe : undefined,
          warmup: workout.warmup || 'Standard warmup routine',
          mainSet: workout.mainSet || 'Main workout set',
          cooldown: workout.cooldown || 'Standard cooldown routine',
          zoneDistribution: workout.zoneDistribution || '',
          keyFocus: Array.isArray(workout.keyFocus) ? workout.keyFocus : [],
          techniqueCues: Array.isArray(workout.techniqueCues) ? workout.techniqueCues : [],
          commonMistakes: Array.isArray(workout.commonMistakes) ? workout.commonMistakes : [],
          segments: Array.isArray(workout.segments) ? workout.segments : [],
          equipment: Array.isArray(workout.equipment) ? workout.equipment : [],
          environment: workout.environment || '',
          nutrition: {
            pre: workout.nutrition?.pre || '',
            during: workout.nutrition?.during || '',
            post: workout.nutrition?.post || '',
          },
          recoveryTips: Array.isArray(workout.recoveryTips) ? workout.recoveryTips : [],
          timeCrunchedOption: workout.timeCrunchedOption || '',
          lowImpactAlternative: workout.lowImpactAlternative || '',
          progression: workout.progression || '',
          safetyNotes: Array.isArray(workout.safetyNotes) ? workout.safetyNotes : [],
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
