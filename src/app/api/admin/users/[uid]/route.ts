export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import admin from 'firebase-admin';

// GET — export single user data as JSON (?export=json)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { uid: username } = await params;

  try {
    const db = getAdminDb();

    const userDoc = await db.collection('users').doc(username).get();
    if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const workoutsSnap = await db
      .collection('users')
      .doc(username)
      .collection('workouts')
      .get();

    const prsSnap = await db
      .collection('personalRecords')
      .where('userId', '==', username)
      .get();

    const exportData = {
      user: { id: userDoc.id, ...userDoc.data() },
      workouts: workoutsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      personalRecords: prsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    };

    const exportMode = request.nextUrl.searchParams.get('export');
    if (exportMode === 'json') {
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${username}-${Date.now()}.json"`,
        },
      });
    }

    return NextResponse.json(exportData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — soft-delete user (disable Auth + set deletedAt)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  const { uid: username } = await params;

  try {
    const db = getAdminDb();
    const adminAuth = getAdminAuth();

    // Look up the Firebase UID from the user doc
    const userDoc = await db.collection('users').doc(username).get();
    if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const uid = userDoc.data()?.uid;
    if (uid) {
      await adminAuth.updateUser(uid, { disabled: true });
    }

    await db
      .collection('users')
      .doc(username)
      .update({ deletedAt: admin.firestore.FieldValue.serverTimestamp() });

    await logAdminAction(session.uid, 'user_deleted', { targetUid: username });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — restore (re-enable) a soft-deleted user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  const { uid: username } = await params;

  try {
    const db = getAdminDb();
    const adminAuth = getAdminAuth();

    const userDoc = await db.collection('users').doc(username).get();
    if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const uid = userDoc.data()?.uid;
    if (uid) {
      await adminAuth.updateUser(uid, { disabled: false });
    }

    await db
      .collection('users')
      .doc(username)
      .update({ deletedAt: admin.firestore.FieldValue.delete() });

    await logAdminAction(session.uid, 'user_restored', { targetUid: username });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
