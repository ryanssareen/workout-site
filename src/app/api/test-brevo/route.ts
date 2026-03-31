export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as brevo from '@getbrevo/brevo';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Brevo API...');
    console.log('🔵 BREVO_API_KEY exists?', !!process.env.BREVO_API_KEY);
    
    if (!process.env.BREVO_API_KEY) {
      return NextResponse.json({ error: 'BREVO_API_KEY not set' }, { status: 500 });
    }

    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'The Daily Athlete', email: 'ryansareen6@gmail.com' };
    sendSmtpEmail.to = [{ email: 'ryansareen6@gmail.com' }];
    sendSmtpEmail.subject = '🧪 Test Email - Brevo API';
    sendSmtpEmail.htmlContent = '<h1>Test email from Brevo!</h1><p>If you see this, Brevo is working!</p>';

    console.log('📧 Sending test email...');
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log('✅ Test email sent!');
    console.log('📬 Response:', JSON.stringify(data));

    return NextResponse.json({ 
      success: true, 
      message: 'Test email sent! Check ryansareen6@gmail.com',
      response: data 
    });
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    console.error('❌ Error message:', error.message);
    return NextResponse.json(
      { error: error.message, details: error.toString() },
      { status: 500 }
    );
  }
}
