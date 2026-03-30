export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import { generateAccountDisabledEmail, generateAccountDeletedEmail, generateAccountRestoredEmail } from '@/lib/email/accountActionTemplate';
import admin from 'firebase-admin';
import * as brevo from '@getbrevo/brevo';

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

// DELETE — soft-delete user (disable Auth + set deletedAt + send email with reason)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  const { uid: username } = await params;
  const body = await request.json().catch(() => ({}));
  const reason: string = body.reason || 'No reason provided';

  try {
    const db = getAdminDb();
    const adminAuth = getAdminAuth();

    const userDoc = await db.collection('users').doc(username).get();
    if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const userData = userDoc.data()!;
    const uid = userData.uid;
    if (uid) {
      await adminAuth.updateUser(uid, { disabled: true });
    }

    await db
      .collection('users')
      .doc(username)
      .update({
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        disableReason: reason,
      });

    await logAdminAction(session.uid, 'user_deleted', { targetUid: username, reason });

    // Send notification email
    if (userData.email && process.env.BREVO_API_KEY) {
      try {
        const firstName = (userData.displayName || 'Athlete').split(' ')[0];
        const { subject, html } = generateAccountDisabledEmail(firstName, reason);

        const apiInstance = new brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = { name: 'The Daily Athlete', email: 'ryansareen6@gmail.com' };
        sendSmtpEmail.to = [{ email: userData.email, name: userData.displayName || 'Athlete' }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;

        await apiInstance.sendTransacEmail(sendSmtpEmail);
      } catch {
        // Email failure shouldn't block the disable action
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT — permanently delete user (removes Auth user, Firestore doc, workouts, PRs)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkOrigin(request)) return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });

  const { uid: username } = await params;
  const body = await request.json().catch(() => ({}));
  const reason: string = body.reason || 'No reason provided';

  try {
    const db = getAdminDb();
    const adminAuth = getAdminAuth();

    const userDoc = await db.collection('users').doc(username).get();
    if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const userData = userDoc.data()!;
    const uid = userData.uid;

    // Send email before deleting (need user data)
    if (userData.email && process.env.BREVO_API_KEY) {
      try {
        const firstName = (userData.displayName || 'Athlete').split(' ')[0];
        const { subject, html } = generateAccountDeletedEmail(firstName, reason);

        const apiInstance = new brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = { name: 'The Daily Athlete', email: 'ryansareen6@gmail.com' };
        sendSmtpEmail.to = [{ email: userData.email, name: userData.displayName || 'Athlete' }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;

        await apiInstance.sendTransacEmail(sendSmtpEmail);
      } catch {
        // Email failure shouldn't block the delete
      }
    }

    // Delete workouts subcollection
    const workoutsSnap = await db.collection('users').doc(username).collection('workouts').get();
    const batch1 = db.batch();
    workoutsSnap.docs.forEach(doc => batch1.delete(doc.ref));
    if (workoutsSnap.docs.length > 0) await batch1.commit();

    // Delete personal records
    const prsSnap = await db.collection('personalRecords').where('userId', '==', username).get();
    const batch2 = db.batch();
    prsSnap.docs.forEach(doc => batch2.delete(doc.ref));
    if (prsSnap.docs.length > 0) await batch2.commit();

    // Delete user document
    await db.collection('users').doc(username).delete();

    // Delete Firebase Auth user
    if (uid) {
      try {
        await adminAuth.deleteUser(uid);
      } catch {
        // Auth user may not exist
      }
    }

    await logAdminAction(session.uid, 'user_permanently_deleted', { targetUid: username, reason });

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
      .update({
        deletedAt: admin.firestore.FieldValue.delete(),
        disableReason: admin.firestore.FieldValue.delete(),
      });

    await logAdminAction(session.uid, 'user_restored', { targetUid: username });

    const userData = userDoc.data()!;
    if (userData.email && process.env.BREVO_API_KEY) {
      try {
        const firstName = (userData.displayName || 'Athlete').split(' ')[0];
        const { subject, html } = generateAccountRestoredEmail(firstName);

        const apiInstance = new brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = { name: 'The Daily Athlete', email: 'ryansareen6@gmail.com' };
        sendSmtpEmail.to = [{ email: userData.email, name: userData.displayName || 'Athlete' }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;

        await apiInstance.sendTransacEmail(sendSmtpEmail);
      } catch {
        // Email failure shouldn't block the restore action
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
