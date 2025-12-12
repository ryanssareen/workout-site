import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get user's Strava access token to revoke it
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (userData?.stravaAccessToken) {
      // Revoke access on Strava's end
      try {
        await fetch('https://www.strava.com/oauth/deauthorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `access_token=${userData.stravaAccessToken}`,
        });
      } catch (revokeError) {
        console.error('Failed to revoke Strava token:', revokeError);
        // Continue anyway - we'll remove from our DB
      }
    }

    // Remove Strava data from user document
    const userRef = adminDb.collection('users').doc(userId);
    await userRef.update({
      stravaId: admin.firestore.FieldValue.delete(),
      stravaAccessToken: admin.firestore.FieldValue.delete(),
      stravaRefreshToken: admin.firestore.FieldValue.delete(),
      stravaTokenExpiresAt: admin.firestore.FieldValue.delete(),
      stravaConnectedAt: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Strava disconnect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect Strava' },
      { status: 500 }
    );
  }
}
