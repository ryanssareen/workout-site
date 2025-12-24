import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Secret unlock passphrase to allow off-topic conversations
const UNLOCK_PASSPHRASE = 'WSDFGJM,GHMJNGTIODTGIHMNDIOTHMNXDIOTHMIODTXHJIO;DTHJIO;JHI;OTJHIYX;ETJXIJ;;RH;HJIX;HJ;IXHJ;RJ';

const SYSTEM_PROMPT = `You are a professional fitness and training coach AI assistant. You help users with:
- Workout planning and programming
- Training advice and technique
- Nutrition for athletes
- Recovery and injury prevention
- Performance analysis
- Goal setting and motivation
- Exercise form and safety

STRICT RULES:
1. ONLY discuss fitness, training, sports, nutrition, and health topics
2. If asked about anything else (politics, jokes, general knowledge, etc.), politely redirect to fitness topics
3. Example redirect: "I'm focused on helping with fitness and training. How can I help with your workouts today?"
4. Be encouraging, professional, and evidence-based
5. If unsure about medical issues, recommend seeing a healthcare professional

You have access to the user's workout history and can provide personalized advice based on their data.`;

const UNLOCKED_PROMPT = `You are Claude, a helpful AI assistant created by Anthropic. You can discuss any topic the user wants.`;

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, workoutData } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Check if user sent the unlock passphrase
    const lastMessage = messages[messages.length - 1];
    const isUnlocked = lastMessage?.content === UNLOCK_PASSPHRASE;

    // Build context with workout data
    let contextMessage = '';
    if (workoutData && !isUnlocked) {
      const { totalWorkouts, completedWorkouts, recentWorkouts, completionRate } = workoutData;
      
      contextMessage = `\n\nUSER'S WORKOUT CONTEXT:
- Total workouts assigned: ${totalWorkouts}
- Completed: ${completedWorkouts} (${completionRate}% completion rate)
- Recent activity: ${recentWorkouts.length} workouts in last 30 days

Recent workouts:
${recentWorkouts.map((w: any) => 
  `- ${w.date}: ${w.name} (${w.type}) ${w.completed ? '✅ Completed' : '❌ Missed'}${w.completedLate ? ' (completed late)' : ''}`
).join('\n')}

Use this data to provide personalized advice.`;
    }

    // Choose system prompt based on unlock status
    const systemPrompt = isUnlocked ? UNLOCKED_PROMPT : SYSTEM_PROMPT + contextMessage;

    // If unlocked, send friendly confirmation
    if (isUnlocked) {
      return NextResponse.json({
        message: "🔓 Dev mode unlocked! I can now discuss anything you'd like. What's on your mind?",
        unlocked: true,
      });
    }

    // Call Groq API
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 0.9,
    });

    const response = completion.choices[0]?.message?.content || 'No response generated';

    return NextResponse.json({
      message: response,
      unlocked: false,
    });
  } catch (error: any) {
    console.error('Groq API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get AI response' },
      { status: 500 }
    );
  }
}
