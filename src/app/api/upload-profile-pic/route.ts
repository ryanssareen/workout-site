import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountBase64) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');

  const serviceAccount = JSON.parse(
    Buffer.from(serviceAccountBase64, 'base64').toString('utf-8')
  );

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const uid = formData.get('uid') as string | null;

    if (!file || !uid) {
      return NextResponse.json({ error: 'Missing file or uid' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    const app = getAdminApp();
    const bucket = getStorage(app).bucket();
    const db = getFirestore(app);

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `profile-pics/${uid}/${Date.now()}.${ext}`;

    // Upload to Firebase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileRef = bucket.file(fileName);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Make the file publicly accessible
    await fileRef.makePublic();

    // Get public URL
    const photoURL = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    // Update user document
    await db.collection('users').doc(uid).update({
      photoURL,
      updatedAt: new Date(),
    });

    return NextResponse.json({ photoURL });
  } catch (error: unknown) {
    console.error('Profile pic upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
      { status: 500 }
    );
  }
}
