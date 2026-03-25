import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, checkOrigin, logAdminAction } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase/admin';
import { generateFeatureUpdateEmail } from '@/lib/email/announcementTemplate';
import * as brevo from '@getbrevo/brevo';

export async function POST(request: NextRequest) {
  if (!checkOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const session = await verifyAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.BREVO_API_KEY) {
    return NextResponse.json({ error: 'BREVO_API_KEY not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { dryRun = false, maxUsers = 100 } = body;

  try {
    const db = getAdminDb();

    // Fetch all active users with emails
    const usersSnap = await db.collection('users')
      .where('role', 'in', ['athlete', 'student'])
      .limit(maxUsers)
      .get();

    const users = usersSnap.docs
      .map(doc => {
        const data = doc.data();
        return {
          email: data.email as string,
          displayName: (data.displayName || 'Athlete') as string,
          username: doc.id,
        };
      })
      .filter(u => u.email);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        userCount: users.length,
        users: users.map(u => ({ email: u.email, name: u.displayName })),
      });
    }

    // Set up Brevo
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const user of users) {
      try {
        const firstName = user.displayName.split(' ')[0] || 'Athlete';
        const { subject, html } = generateFeatureUpdateEmail(firstName);

        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = { name: 'The Daily Athlete', email: 'ryansareen6@gmail.com' };
        sendSmtpEmail.to = [{ email: user.email, name: user.displayName }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;
        sendSmtpEmail.headers = {
          'List-Unsubscribe': `<mailto:ryansareen6@gmail.com?subject=unsubscribe>`,
        };

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        sent++;

        // Small delay between sends to avoid rate limits
        if (sent % 10 === 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err: any) {
        failed++;
        errors.push(`${user.email}: ${err.message}`);
      }
    }

    await logAdminAction(session.uid, 'broadcast_sent', {
      type: 'feature_update',
      sent,
      failed,
      totalUsers: users.length,
    });

    return NextResponse.json({ sent, failed, total: users.length, errors: errors.slice(0, 10) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — dry run to see recipient list
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const usersSnap = await db.collection('users')
      .where('role', 'in', ['athlete', 'student'])
      .limit(200)
      .get();

    const users = usersSnap.docs
      .map(doc => {
        const data = doc.data();
        return {
          email: data.email as string,
          displayName: (data.displayName || 'Athlete') as string,
          username: doc.id,
        };
      })
      .filter(u => u.email);

    return NextResponse.json({ userCount: users.length, users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
