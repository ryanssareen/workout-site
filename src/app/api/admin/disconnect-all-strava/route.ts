export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

// POST: Disconnect all users from Strava
// This is an admin endpoint - use with caution
export async function POST(request: NextRequest) {
  try {
    // Optional: Add admin authentication here
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Find all users with Strava connected
    const usersSnapshot = await adminDb
      .collection('users')
      .where('stravaId', '!=', null)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No users with Strava connections found',
        disconnected: 0,
      });
    }

    const batch = adminDb.batch();
    let count = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();

      // Try to revoke token on Strava's end (optional, may fail)
      if (userData.stravaAccessToken) {
        try {
          await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `access_token=${userData.stravaAccessToken}`,
          });
        } catch (revokeError) {
          console.error(`Failed to revoke token for user ${doc.id}:`, revokeError);
          // Continue anyway - we'll remove the data from our side
        }
      }

      // Remove Strava fields from user document
      batch.update(doc.ref, {
        stravaId: admin.firestore.FieldValue.delete(),
        stravaAccessToken: admin.firestore.FieldValue.delete(),
        stravaRefreshToken: admin.firestore.FieldValue.delete(),
        stravaTokenExpiresAt: admin.firestore.FieldValue.delete(),
        stravaConnectedAt: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      count++;
    }

    await batch.commit();

    console.log(`Disconnected ${count} users from Strava`);

    return NextResponse.json({
      success: true,
      message: `Disconnected ${count} users from Strava`,
      disconnected: count,
    });
  } catch (error: any) {
    console.error('Error disconnecting all Strava:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect all Strava connections' },
      { status: 500 }
    );
  }
}

// GET: Check how many users have Strava connected
export async function GET() {
  try {
    const usersSnapshot = await adminDb
      .collection('users')
      .where('stravaId', '!=', null)
      .get();

    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      email: doc.data().email,
      displayName: doc.data().displayName,
      stravaId: doc.data().stravaId,
      stravaConnectedAt: doc.data().stravaConnectedAt?.toDate?.()?.toISOString() || null,
    }));

    return NextResponse.json({
      count: users.length,
      users,
    });
  } catch (error: any) {
    console.error('Error getting Strava users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
