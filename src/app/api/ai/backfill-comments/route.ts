export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min for batch

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import Groq from 'groq-sdk';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

    // Find all workouts with route data but no AI comment (collectionGroup for subcollections)
    const snapshot = await adminDb.collectionGroup('workouts')
      .where('routeData.polyline', '!=', null)
      .get();

    const workoutsToUpdate = snapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.routeData?.aiComment && data.routeData?.polyline;
    });

    console.log(`🔄 Backfilling ${workoutsToUpdate.length} workouts with AI comments`);

    let success = 0;
    let failed = 0;

    for (const doc of workoutsToUpdate) {
      const workout = doc.data();
      try {
        const distance = workout.actualStats?.distance
          ? `${(workout.actualStats.distance / 1000).toFixed(1)} km`
          : workout.stravaData?.distance
            ? `${(workout.stravaData.distance / 1000).toFixed(1)} km`
            : null;
        const elevation = workout.actualStats?.elevationGain || workout.stravaData?.elevationGain;
        const duration = workout.duration || (workout.actualStats?.duration ? Math.round(workout.actualStats.duration / 60) : null);
        const city = workout.routeData?.location_city || '';
        const state = workout.routeData?.location_state || '';
        const country = workout.routeData?.location_country || '';
        const locationStr = [city, state, country].filter(Boolean).join(', ');

        const prompt = `Write a SHORT fun comment (1 sentence, max 15 words) about this workout — be playful, like a hype coach reacting to where/how they trained. Include one emoji.

Workout: ${workout.name || 'Workout'}
Type: ${workout.type || 'unknown'}
${distance ? `Distance: ${distance}` : ''}
${duration ? `Duration: ${duration} min` : ''}
${elevation ? `Elevation gain: ${elevation}m` : ''}
${locationStr ? `Location: ${locationStr}` : ''}
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
        const comment = parsed.comment?.slice(0, 100);

        if (comment) {
          // Use ownerUsername from workout data to construct subcollection path
          const ownerUsername = workout.ownerUsername || workout.assignedTo;
          await adminDb.collection('users').doc(ownerUsername).collection('workouts').doc(doc.id).update({
            'routeData.aiComment': comment,
          });
          success++;
          console.log(`✅ ${doc.id}: ${comment}`);
        } else {
          failed++;
        }

        // Rate limit — small delay between requests
        await new Promise(r => setTimeout(r, 200));
      } catch (err: any) {
        console.error(`❌ ${doc.id}:`, err.message);
        failed++;
      }
    }

    return NextResponse.json({
      total: workoutsToUpdate.length,
      success,
      failed,
      message: `Backfilled ${success} workouts with AI comments`,
    });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
