export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { adminDb } from '@/lib/firebase/admin';
import { adminResolveUsername } from '@/lib/firebase/adminUserMapping';
import { getTemplate } from '@/lib/reports/templates';
import { getCachedReport, setCachedReport } from '@/lib/reports/cache';
import type { WorkoutDoc } from '@/lib/reports/templates';
import type { DeepDiveReportType } from '@/types/reports-hub';

const VALID_TYPES: DeepDiveReportType[] = [
  'sport-deep-dive',
  'trend-report',
  'pr-timeline',
  'recovery-report',
  'goal-tracker',
];

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const { reportType, params = {}, userId, refresh = false, athleteUsername } = await req.json();

    if (!reportType || !userId) {
      return NextResponse.json({ error: 'reportType and userId are required' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(reportType)) {
      return NextResponse.json({ error: `Invalid report type: ${reportType}` }, { status: 400 });
    }

    const template = getTemplate(reportType);
    if (!template) {
      return NextResponse.json({ error: `No template for: ${reportType}` }, { status: 400 });
    }

    // Resolve username — coaches can pass athleteUsername to view athlete reports
    const username = athleteUsername || await adminResolveUsername(userId);

    // Check cache first (skip if refresh requested)
    if (!refresh) {
      const cached = await getCachedReport(username, reportType, params);
      if (cached) {
        console.log(`📊 Cache hit for ${reportType} (${username})`);
        return NextResponse.json({
          report: cached,
          isInsufficient: false,
          hasData: true,
          cached: true,
        });
      }
    } else {
      console.log(`📊 Refresh requested, skipping cache for ${reportType} (${username})`);
    }

    console.log(`📊 Generating ${reportType} for ${username}`);

    // Fetch all workouts via Admin SDK
    const workoutsSnapshot = await adminDb
      .collection('users')
      .doc(username)
      .collection('workouts')
      .get();

    const workouts: WorkoutDoc[] = workoutsSnapshot.docs.map((doc) => doc.data() as WorkoutDoc);

    if (workouts.length === 0) {
      return NextResponse.json({
        report: null,
        isInsufficient: true,
        insufficientMessage: 'No workout data found. Log some workouts first!',
        hasData: false,
      });
    }

    // Build context using template
    const context = template.buildContext(workouts, params);

    // Call Groq
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: template.systemPrompt },
          { role: 'user', content: `Here is the athlete's data:\n\n${context}\n\nGenerate the report.` },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });
    } catch (err: unknown) {
      // Fallback to 8B on rate limit
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 429) {
        console.log('📊 Rate limited on 70B, falling back to 8B');
        completion = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: template.systemPrompt },
            { role: 'user', content: `Here is the athlete's data:\n\n${context}\n\nGenerate the report.` },
          ],
          temperature: 0.7,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        });
      } else {
        throw err;
      }
    }

    const responseText = completion.choices[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('❌ Failed to parse AI response:', responseText.slice(0, 200));
      return NextResponse.json({
        report: null,
        isInsufficient: true,
        insufficientMessage: 'Failed to generate report. Please try again.',
        hasData: true,
      });
    }

    // Normalize chart sections — auto-detect yKeys for multi-series data
    if (parsed.sections && Array.isArray(parsed.sections)) {
      for (const section of parsed.sections) {
        if (section.type === 'chart' && section.data?.length > 0 && !section.yKeys) {
          const firstPoint = section.data[0];
          const numericKeys = Object.keys(firstPoint).filter(
            (k) => k !== section.xKey && typeof firstPoint[k] === 'number'
          );
          // If yKey doesn't exist in data or there are multiple numeric keys, set yKeys
          if (numericKeys.length > 1) {
            section.yKeys = numericKeys;
          } else if (numericKeys.length === 1 && !(section.yKey in firstPoint)) {
            section.yKey = numericKeys[0];
          }
        }
      }
    }

    // Check insufficient data response
    if (parsed.insufficient) {
      return NextResponse.json({
        report: null,
        isInsufficient: true,
        insufficientMessage: parsed.message || 'Not enough data for this report.',
        hasData: true,
      });
    }

    // Cache the result
    await setCachedReport(username, reportType, params, parsed, template.cacheTTL);

    return NextResponse.json({
      report: parsed,
      isInsufficient: false,
      hasData: true,
      cached: false,
    });
  } catch (error: unknown) {
    console.error('📊 Report generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 }
    );
  }
}
