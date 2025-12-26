export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Find the reset token using Admin SDK
    const resetsSnapshot = await adminDb.collection('passwordResets')
      .where('token', '==', token)
      .where('used', '==', false)
      .limit(1)
      .get();

    if (resetsSnapshot.empty) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      );
    }

    const resetDoc = resetsSnapshot.docs[0];
    const resetData = resetDoc.data();

    // Check if token has expired
    const expiresAt = resetData.expiresAt.toDate();
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Reset link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const email = resetData.email;

    // Get user by email and update password using Firebase Admin
    const userRecord = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    // Mark token as used
    await resetDoc.ref.update({
      used: true,
      usedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset password' },
      { status: 500 }
    );
  }
}
