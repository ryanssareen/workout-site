import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, checkOrigin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }

  const admin = await verifyAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { messages, system } = await request.json();

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: system || 'You are an AI assistant for The Daily Athlete admin dashboard. Help with data analysis, user management questions, and platform insights. Be concise.',
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Claude API error: ${res.status}`, details: err }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
