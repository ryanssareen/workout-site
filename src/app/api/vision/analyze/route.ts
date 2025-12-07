import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * Vision API endpoint for whiteboard workout extraction
 * 
 * Workflow:
 * 1. Receives base64-encoded image from client
 * 2. Sends to OpenAI GPT-4 Vision with structured prompt
 * 3. Extracts workout information (name, type, description, date, duration)
 * 4. Returns structured JSON array of workouts
 * 
 * Error handling:
 * - Validates image presence
 * - Handles API failures gracefully
 * - Provides fallback parsing for malformed responses
 * 
 * Response format:
 * {
 *   "workouts": [
 *     {
 *       "name": "Morning Run",
 *       "type": "run",
 *       "description": "5K easy pace",
 *       "date": "2024-01-15",
 *       "duration": 30
 *     }
 *   ],
 *   "notes": "Additional context from analysis"
 * }
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this whiteboard image containing workout planning notes. Extract ALL workout information you can identify and return it in the following JSON format:
              
{
  "workouts": [
    {
      "name": "workout name",
      "type": "swim|run|bike|strength",
      "description": "detailed workout description",
      "date": "YYYY-MM-DD format if date is mentioned (leave empty if not)",
      "duration": number in minutes if mentioned (leave empty if not)
    }
  ],
  "notes": "any additional context, observations, or uncertainties"
}

IMPORTANT:
- Extract ALL workouts visible in the image
- For "type", choose the closest match from: swim, run, bike, or strength
- Include all details you can read from the whiteboard
- If you cannot clearly identify workout information, return an empty workouts array and explain why in the notes field
- Be generous in interpretation but indicate uncertainty in the notes field`,
            },
            {
              type: 'image_url',
              image_url: {
                url: image,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;
    
    // Parse the JSON response
    let parsedData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content?.match(/```json\n([\s\S]*?)\n```/) || 
                       content?.match(/```\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      parsedData = JSON.parse(jsonString || '{}');
      
      // Ensure workouts array exists
      if (!parsedData.workouts) {
        parsedData.workouts = [];
      }
      
      // Validate workout structure
      parsedData.workouts = parsedData.workouts.map((w: any) => ({
        name: w.name || 'Untitled Workout',
        type: ['swim', 'run', 'bike', 'strength'].includes(w.type) ? w.type : 'strength',
        description: w.description || '',
        date: w.date || undefined,
        duration: w.duration || undefined,
      }));
      
    } catch (parseError) {
      parsedData = {
        workouts: [],
        notes: 'Failed to parse vision response. Raw content: ' + content,
      };
    }

    return NextResponse.json(parsedData);
    
  } catch (error: any) {
    console.error('Vision API error:', error);
    
    // Handle specific OpenAI errors
    if (error.code === 'insufficient_quota') {
      return NextResponse.json(
        { error: 'OpenAI API quota exceeded. Please check your API key and billing.' },
        { status: 402 }
      );
    }
    
    if (error.code === 'invalid_api_key') {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key. Please check your environment variables.' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to analyze image',
        details: error.code || 'unknown_error'
      },
      { status: 500 }
    );
  }
}
