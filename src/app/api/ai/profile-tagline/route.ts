export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import Groq from 'groq-sdk';

export async function POST(request: NextRequest) {
  try {
    const { username, force } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'username required' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const userDoc = await adminDb.collection('users').doc(username).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data()!;

    // Return cached tagline unless force regeneration
    if (userData.profileTagline && !force) {
      return NextResponse.json({ tagline: userData.profileTagline });
    }

    // Gather context for the tagline
    const workoutsSnap = await adminDb
      .collection('users').doc(username).collection('workouts')
      .where('completed', '==', true)
      .get();

    const totalWorkouts = workoutsSnap.size;
    const sports = userData.sportPreferences?.join(', ') || 'various sports';
    const experience = userData.experienceLevel || 'dedicated';
    const name = userData.displayName || username;

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const doc of workoutsSnap.docs) {
      const type = doc.data().type || 'other';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    const favoriteType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

    const prompt = `Write a one-sentence motivational tagline for an athlete's public profile page. Max 12 words. Be subtly impressive, not boastful. Make it feel personal and aspirational.

Examples of good taglines:
- "Chasing sunrises and personal records, one mile at a time."
- "Where discipline meets the open road."
- "Building strength through consistency and quiet determination."

Athlete context:
- Name: ${name}
- Sports: ${sports}
- Experience: ${experience}
- Total completed workouts: ${totalWorkouts}
${favoriteType ? `- Favorite activity: ${favoriteType}` : ''}

Return ONLY a JSON object: {"tagline": "your tagline here"}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a creative writer for athlete profiles. Return only valid JSON. Be poetic and brief.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 60,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(response);
    const tagline = parsed.tagline && typeof parsed.tagline === 'string'
      ? parsed.tagline.slice(0, 120)
      : null;

    if (tagline) {
      await adminDb.collection('users').doc(username).update({
        profileTagline: tagline,
      });
    }

    return NextResponse.json({ tagline: tagline || null });
  } catch (error: any) {
    console.error('Profile tagline error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
