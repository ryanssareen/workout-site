export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as brevo from '@getbrevo/brevo';

interface RequestBody {
  pdfBase64?: string;
  filename?: string;
  toEmail?: string;
  subject?: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.BREVO_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const body = (await request.json()) as RequestBody;
    const { pdfBase64, filename = 'coachtrack-report.pdf', toEmail, subject } = body;

    if (!pdfBase64 || !toEmail) {
      return NextResponse.json({ error: 'pdfBase64 and toEmail are required' }, { status: 400 });
    }

    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'CoachTrack', email: 'noreply@coachtrack.app' };
    sendSmtpEmail.to = [{ email: toEmail }];
    sendSmtpEmail.subject = subject || 'Your CoachTrack Report';
    sendSmtpEmail.htmlContent = `<p>Your report is attached.</p><p>Generated ${new Date().toLocaleString()}</p>`;
    sendSmtpEmail.attachment = [
      {
        content: pdfBase64,
        name: filename,
      },
    ];

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ send report email error:', error);
    return NextResponse.json({ error: error.message || 'Failed to email report' }, { status: 500 });
  }
}
