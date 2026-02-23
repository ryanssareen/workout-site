import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  const snap = await adminDb.collection('users').get();
  const users = snap.docs.map(d => {
    const data = d.data();
    return { uid: d.id, email: data.email, role: data.role, strava: !!data.stravaId };
  });
  return NextResponse.json(users);
}
