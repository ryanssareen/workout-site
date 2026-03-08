export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

/**
 * Server-side user creation route.
 * Uses Admin SDK to bypass Firestore security rules, handling edge cases like:
 * - Existing userMappings from previous failed registrations
 * - Re-registration after partial state
 * - Atomic user + mapping creation
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Firebase auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const body = await request.json();
    const { username, email, displayName, role, photoURL, coachUsername } = body;

    // Validate username
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
    }

    const RESERVED = [
      'admin', 'api', 'preview', 'settings', 'profile', 'dashboard',
      'workouts', 'calendar', 'reports', 'login', 'register', 'onboarding',
      'coach', 'athlete', 'help', 'support', 'about', 'contact',
      'ai-coach', 'suggestions', 'features', 'connect-strava',
    ];
    if (RESERVED.includes(username)) {
      return NextResponse.json({ error: 'This username is reserved' }, { status: 400 });
    }

    const adminDb = getAdminDb();

    // Check if username is already taken by a DIFFERENT user
    const existingUserDoc = await adminDb.collection('users').doc(username).get();
    if (existingUserDoc.exists) {
      const existingUid = existingUserDoc.data()?.uid;
      if (existingUid === uid) {
        // Same user re-registering (idempotent) — return existing profile
        console.log(`✅ User ${username} already exists for uid ${uid}, returning existing`);
        return NextResponse.json({
          success: true,
          user: { username, ...existingUserDoc.data() },
          alreadyExists: true,
        });
      }
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
    }

    // Check if this uid already has a mapping to a different username
    const existingMapping = await adminDb.collection('userMappings').doc(uid).get();
    if (existingMapping.exists) {
      const oldUsername = existingMapping.data()?.username;
      if (oldUsername && oldUsername !== username) {
        // Clean up old user doc if it belongs to this uid
        const oldUserDoc = await adminDb.collection('users').doc(oldUsername).get();
        if (oldUserDoc.exists && oldUserDoc.data()?.uid === uid) {
          console.log(`🧹 Cleaning up old user doc: ${oldUsername} for uid ${uid}`);
          await adminDb.collection('users').doc(oldUsername).delete();
        }
      }
    }

    // Create user profile
    const userProfile: Record<string, any> = {
      uid,
      username,
      email: email || decodedToken.email || '',
      displayName: displayName || decodedToken.name || '',
      role: role || 'athlete',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      onboardingCompleted: false,
    };

    if (photoURL) userProfile.photoURL = photoURL;
    if (coachUsername) userProfile.coachUsername = coachUsername;

    // Atomic batch: create user doc + set mapping
    // Using set() (not create()) for mapping to handle pre-existing mappings
    const batch = adminDb.batch();
    const userRef = adminDb.collection('users').doc(username);
    const mappingRef = adminDb.collection('userMappings').doc(uid);

    batch.set(userRef, userProfile);
    batch.set(mappingRef, { username }); // overwrites if exists

    await batch.commit();

    console.log(`✅ Created user ${username} for uid ${uid}`);

    return NextResponse.json({
      success: true,
      user: userProfile,
    });
  } catch (error: any) {
    console.error('Create user error:', error);

    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
