export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as brevo from '@getbrevo/brevo';
import { adminDb } from '@/lib/firebase/admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    console.log('🔵 Reset email API called for:', email);
    console.log('🔵 BREVO_API_KEY:', process.env.BREVO_API_KEY ? 'Set ✅' : 'Missing ❌');
    console.log('🔵 FIREBASE_SERVICE_ACCOUNT:', process.env.FIREBASE_SERVICE_ACCOUNT ? 'Set ✅' : 'Missing ❌');

    if (!email) {
      console.log('❌ No email provided');
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Skip user check - just generate token and send email
    // (For security, we won't reveal if user exists or not)
    console.log('🔐 Generating reset token for:', email);
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in Firestore using Admin SDK
    console.log('💾 Storing reset token in Firestore...');
    await adminDb.collection('passwordResets').add({
      email,
      token: resetToken,
      expiresAt: resetTokenExpiry,
      used: false,
      createdAt: new Date(),
    });
    console.log('✅ Token stored!');

    // Create reset link
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password/confirm?token=${resetToken}`;
    console.log('🔗 Reset link:', resetLink);

    // Send email using Brevo
    console.log('📧 Sending email via Brevo...');
    
    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY || ''
    );

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'CoachTrack', email: 'ryansareen6@gmail.com' };
    sendSmtpEmail.to = [{ email: email }];
    sendSmtpEmail.subject = 'Reset Your Password — CoachTrack';
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 32px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
                COACHTRACK
              </div>
              <div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 6px; text-transform: uppercase; letter-spacing: 3px;">
                Password Reset
              </div>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="color: #ffffff; font-size: 18px; margin: 0 0 10px 0; font-weight: 700;">Hey there,</p>
              <p style="color: rgba(255,255,255,0.5); font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
                We received a request to reset your password. Click the button below to set a new one.
              </p>

              <!-- Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                  Reset Password
                </a>
              </div>

              <!-- Expiry notice -->
              <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; margin: 25px 0;">
                <p style="color: rgba(255,255,255,0.6); font-size: 13px; margin: 0; text-align: center;">
                  This link expires in <strong style="color: #ef4444;">1 hour</strong>. If you didn&apos;t request this, ignore this email.
                </p>
              </div>

              <!-- Fallback link -->
              <p style="color: rgba(255,255,255,0.3); font-size: 12px; text-align: center; margin-top: 25px;">
                Or copy this link into your browser:
              </p>
              <p style="word-break: break-all; color: #ef4444; font-size: 12px; text-align: center; margin-top: 5px;">
                ${resetLink}
              </p>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 25px 30px; text-align: center;">
              <p style="margin: 0; color: rgba(255,255,255,0.25); font-size: 12px;">
                Sent from CoachTrack — Train Harder. Track Smarter.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log('✅ Email sent successfully via Brevo!');
    console.log('📬 Response:', JSON.stringify(data));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error sending reset email:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to send reset email' },
      { status: 500 }
    );
  }
}
