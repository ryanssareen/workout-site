export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import Groq from 'groq-sdk';

export async function POST(request: NextRequest) {
  try {
    const { workoutId, ownerUsername } = await request.json();

    if (!workoutId || !ownerUsername) {
      return NextResponse.json({ error: 'workoutId and ownerUsername required' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const doc = await adminDb.collection('users').doc(ownerUsername).collection('workouts').doc(workoutId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    const workout = doc.data()!;

    if (workout.routeData?.aiComment) {
      return NextResponse.json({ comment: workout.routeData.aiComment });
    }

    if (!workout.routeData?.polyline && !workout.routeData?.startLatLng) {
      return NextResponse.json({ error: 'No route data' }, { status: 400 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

    const distance = workout.actualStats?.distance
      ? `${(workout.actualStats.distance / 1000).toFixed(1)} km`
      : workout.stravaData?.distance
        ? `${(workout.stravaData.distance / 1000).toFixed(1)} km`
        : null;
    const elevation = workout.actualStats?.elevationGain || workout.stravaData?.elevationGain;
    const duration = workout.duration || (workout.actualStats?.duration ? Math.round(workout.actualStats.duration / 60) : null);

    const prompt = `Write a SHORT fun comment (1 sentence, max 15 words) about this workout route — be playful, like a hype coach reacting to where/how they trained. Include one emoji.

Examples: "Sandy beach vibes, perfect spot for a morning run! 🏖️", "Hill climbing beast mode activated! 🏔️", "City streets at dawn — nothing beats that energy! 🌆"

Workout: ${workout.name}
Type: ${workout.type}
${distance ? `Distance: ${distance}` : ''}
${duration ? `Duration: ${duration} min` : ''}
${elevation ? `Elevation gain: ${elevation}m` : ''}
Has GPS route: Yes

Return ONLY a JSON object: {"comment": "your fun comment here"}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a hype fitness coach. Return only valid JSON. Be fun and brief.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 80,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(response);
    const comment = parsed.comment && typeof parsed.comment === 'string'
      ? parsed.comment.slice(0, 100)
      : null;

    if (comment) {
      await adminDb.collection('users').doc(ownerUsername).collection('workouts').doc(workoutId).update({
        'routeData.aiComment': comment,
      });
    }

    return NextResponse.json({ comment: comment || null });
  } catch (error: any) {
    console.error('Route comment error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
