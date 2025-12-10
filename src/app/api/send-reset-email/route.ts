import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminDb } from '@/lib/firebase/admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    console.log('🔵 Reset email API called for:', email);
    console.log('🔵 GMAIL_USER:', process.env.GMAIL_USER ? 'Set ✅' : 'Missing ❌');
    console.log('🔵 GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'Set ✅' : 'Missing ❌');

    if (!email) {
      console.log('❌ No email provided');
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user exists using Admin SDK
    console.log('🔍 Checking if user exists:', email);
    const usersSnapshot = await adminDb.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log('⚠️ User not found, but returning success for security');
      // Don't reveal if user exists or not for security
      return NextResponse.json({ success: true });
    }

    console.log('✅ User found!');

    // Generate secure reset token
    console.log('🔐 Generating reset token...');
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

    // Create Gmail transporter
    console.log('📧 Creating Gmail transporter...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Create reset link
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password/confirm?token=${resetToken}`;
    console.log('🔗 Reset link:', resetLink);

    // Send email
    console.log('📨 Sending email to:', email);
    const info = await transporter.sendMail({
      from: `"Workout Tracker" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🔐 Reset Your Password - Workout Tracker',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #f9fafb;
                padding: 30px;
                border-radius: 0 0 10px 10px;
              }
              .button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                color: #666;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Reset Your Password</h1>
              </div>
              <div class="content">
                <p>Hi there! 👋</p>
                <p>We received a request to reset your password for Workout Tracker.</p>
                <p>Click the button below to reset your password:</p>
                <div style="text-align: center;">
                  <a href="${resetLink}" class="button">Reset Password</a>
                </div>
                <p><strong>This link will expire in 1 hour.</strong></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
                <div class="footer">
                  <p>Or copy and paste this link into your browser:</p>
                  <p style="word-break: break-all; color: #667eea;">${resetLink}</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log('📬 Message ID:', info.messageId);
    console.log('📊 Response:', info.response);

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
