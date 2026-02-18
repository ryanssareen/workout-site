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

    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You check if display names are appropriate for a fitness app. Return ONLY valid JSON: {"isClean": true} or {"isClean": false, "reason": "brief reason"}. A name is inappropriate if it contains profanity, slurs, hate speech, or sexually explicit content. Normal names, nicknames, and fitness-related names are fine.',
        },
        {
          role: 'user',
          content: `Is this display name appropriate? "${text}"`,
        },
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '{"isClean": true}';
    const result = JSON.parse(response);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Profanity check error:', error);
    return NextResponse.json({ isClean: true });
  }
}
