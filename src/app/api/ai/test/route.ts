import { NextResponse } from 'next/server';

export async function GET() {
  const rawKey = process.env.GROQ_API_KEY || '';
  const trimmedKey = rawKey.trim();
  const hasGroqKey = !!trimmedKey;
  
  const keyPreview = trimmedKey
    ? `${trimmedKey.substring(0, 7)}...${trimmedKey.substring(trimmedKey.length - 4)}`
    : 'NOT SET';

  return NextResponse.json({
    groqApiKey: {
      configured: hasGroqKey,
      preview: keyPreview,
      hasWhitespace: rawKey !== trimmedKey,
      rawLength: rawKey.length,
      trimmedLength: trimmedKey.length,
    },
    status: hasGroqKey ? 'ready' : 'missing GROQ_API_KEY',
  });
}
