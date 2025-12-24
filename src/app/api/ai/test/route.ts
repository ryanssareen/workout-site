import { NextResponse } from 'next/server';

export async function GET() {
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  const keyPreview = process.env.GROQ_API_KEY 
    ? `${process.env.GROQ_API_KEY.substring(0, 7)}...${process.env.GROQ_API_KEY.substring(process.env.GROQ_API_KEY.length - 4)}`
    : 'NOT SET';

  return NextResponse.json({
    groqApiKey: {
      configured: hasGroqKey,
      preview: keyPreview,
    },
    status: hasGroqKey ? 'ready' : 'missing GROQ_API_KEY',
  });
}
