import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    console.log('🔓 Disconnecting Strava for user:', userId);

    // Remove Strava tokens from Firestore
    await adminDb.collection('users').doc(userId).update({
      stravaConnected: false,
      stravaId: null, // Frontend checks for this field
      stravaAccessToken: null,
      stravaRefreshToken: null,
      stravaTokenExpiresAt: null,
      stravaAthleteId: null,
      stravaAthlete: null,
      stravaDisconnectedAt: new Date(),
    });

    console.log('✅ Strava disconnected successfully');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Strava disconnect error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
