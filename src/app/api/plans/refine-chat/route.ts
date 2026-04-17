/**
 * POST /api/plans/refine-chat (Unit 8 / R2)
 *
 * Wizard-step chat endpoint — operates on an in-memory preview before the
 * plan is persisted. No plan id involved.
 *
 * Scope gate: chat is limited to *within-plan* refinements (day shuffles,
 * duration/intensity tweaks, sport swaps, session add/remove within-week).
 * Goal re-scoping (distance, date, target time) is declined with a
 * redirect message.
 *
 * Returns:
 *   - `assistantMessage` — the coach's response
 *   - `outOfScope: true` + `redirect` when the user asks for goal changes
 *   - `suggestions?` — optional structured hints the wizard UI can display
 *
 * Enforces per-session turn cap to avoid unbounded Groq spend.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { verifyPlanAccess, isVerifiedUser } from '@/lib/api-auth';

const MAX_TURNS = 5;
const GROQ_MODEL_70B = 'llama-3.3-70b-versatile';
const GROQ_MODEL_8B = 'llama-3.1-8b-instant';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface RefineChatBody {
  goal: {
    type: 'dated-event' | 'distance-pr';
    goalLabel: string;
    eventDate?: string;
    daysPerWeek: number;
    typicalSessionMinutes: number;
    sports?: string[];
  };
  chatHistory: ChatTurn[];
  userMessage: string;
}

// Patterns that trigger the scope gate — requests to change the goal itself.
const GOAL_RESCOPE_PATTERNS = [
  /change\s+(?:my\s+)?(?:goal|target|distance|event)/i,
  /(?:switch|move)\s+to\s+(?:a\s+)?(?:\d+k|marathon|triathlon|ironman)/i,
  /reschedule\s+(?:the\s+)?(?:event|race)/i,
  /new\s+(?:target\s+time|event\s+date)/i,
  /instead\s+of\s+(?:running|cycling|swimming)\s+(?:the|a)\s+/i,
  /(?:postpone|push\s+back)\s+(?:the|my)\s+(?:event|race)/i,
];

export async function POST(request: NextRequest) {
  const access = await verifyPlanAccess(request);
  if (!isVerifiedUser(access)) return access;
  const user = access;

  let body: RefineChatBody;
  try {
    body = (await request.json()) as RefineChatBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body?.goal || !body?.userMessage?.trim()) {
    return NextResponse.json({ error: '`goal` and `userMessage` are required' }, { status: 400 });
  }
  const history = Array.isArray(body.chatHistory) ? body.chatHistory : [];

  // Enforce turn cap server-side (client UI also caps; this is the real limit).
  const userTurnCount = history.filter(t => t.role === 'user').length;
  if (userTurnCount >= MAX_TURNS) {
    return NextResponse.json(
      {
        assistantMessage:
          `You've reached the ${MAX_TURNS}-turn refinement limit. Go back to the previous step to adjust your inputs, or confirm the plan as-is.`,
        outOfScope: false,
        turnLimitReached: true,
      },
      { status: 200 },
    );
  }

  // ── Scope gate ────────────────────────────────────────────────────────
  const msg = body.userMessage.trim();
  const isGoalRescope = GOAL_RESCOPE_PATTERNS.some(p => p.test(msg));
  if (isGoalRescope) {
    return NextResponse.json({
      assistantMessage:
        "I can help with within-plan tweaks — shuffling days, adjusting durations, swapping sport focus, or adding/removing individual sessions. To change your goal itself (distance, event date, or target time), go back to the Goal step of the wizard.",
      outOfScope: true,
      redirect: 'goal',
    });
  }

  // ── Groq call ─────────────────────────────────────────────────────────
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      assistantMessage:
        "Chat refinement is temporarily unavailable. You can proceed with the preview as-is — the generated plan will be well-formed either way.",
      outOfScope: false,
    });
  }

  const systemPrompt = [
    'You are a senior endurance coach helping an athlete refine their training plan BEFORE it is generated.',
    'You have NOT yet seen a full plan — only the athlete\'s goal inputs. Your job: answer questions about their setup, suggest sensible tweaks to the inputs, and confirm when their setup looks reasonable.',
    '',
    `Athlete goal: ${body.goal.goalLabel}${body.goal.eventDate ? ` on ${body.goal.eventDate}` : ''}.`,
    `Sports: ${(body.goal.sports ?? ['run']).join(', ')}.`,
    `Availability: ${body.goal.daysPerWeek} days/week, ~${body.goal.typicalSessionMinutes} min/session.`,
    '',
    'SCOPE: you may answer questions about within-plan refinements only — day shuffles, duration/intensity tweaks, sport swaps, session add/remove within a week. DO NOT change the goal itself (distance, event date, target time) — if the athlete asks for that, redirect them to the Goal step of the wizard.',
    '',
    'Keep responses short (2-4 sentences). Be specific and practical.',
  ].join('\n');

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map(t => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: msg },
  ];

  try {
    const groq = new Groq({ apiKey });
    const res = await callWithFallback(groq, messages);
    const assistantMessage = res.choices[0]?.message?.content?.trim()
      ?? "I couldn't formulate a response, but your current inputs look reasonable. Confirm the plan when you're ready.";
    return NextResponse.json({
      assistantMessage,
      outOfScope: false,
      turnsRemaining: MAX_TURNS - userTurnCount - 1,
    });
  } catch (err) {
    console.warn(`[refine-chat] Groq call failed for ${user.username}:`, err);
    return NextResponse.json({
      assistantMessage:
        "I'm having trouble reaching the coaching model right now. Your current inputs look well-formed — you can confirm the plan as-is, and we'll adapt it on the next weekly review.",
      outOfScope: false,
      degraded: true,
    });
  }
}

async function callWithFallback(
  groq: Groq,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
) {
  try {
    return await groq.chat.completions.create({
      model: GROQ_MODEL_70B,
      messages,
      max_tokens: 400,
      temperature: 0.7,
    });
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e?.status !== 429) throw err;
    // 429 → fall back to 8B.
    return groq.chat.completions.create({
      model: GROQ_MODEL_8B,
      messages,
      max_tokens: 400,
      temperature: 0.7,
    });
  }
}
