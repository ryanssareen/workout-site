import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { NextRequest } from 'next/server';
import admin from 'firebase-admin';

export function getAdminUids(): string[] {
  return (process.env.ADMIN_UIDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export async function verifyAdminSession(
  request: NextRequest
): Promise<{ uid: string } | null> {
  try {
    const sessionCookie = request.cookies.get('admin_session')?.value;
    if (!sessionCookie) return null;

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);

    const allowedUids = getAdminUids();
    if (allowedUids.length > 0 && !allowedUids.includes(decoded.uid)) return null;

    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

// Allow requests with no Origin (server-to-server). Block mismatched origins.
export function checkOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const host = request.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function logAdminAction(
  adminUid: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection('adminLogs').add({
      action,
      adminUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ...(details ?? {}),
    });
  } catch (err) {
    console.error('Failed to write admin log:', err);
  }
}
