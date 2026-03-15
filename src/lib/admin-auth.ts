import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { NextRequest } from 'next/server';
import admin from 'firebase-admin';
import { createHmac, timingSafeEqual } from 'crypto';

export function getAdminUids(): string[] {
  return (process.env.ADMIN_UIDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// ─── Password-based session helpers ───────────────────────────────────────────

const SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

function getSecret(): string {
  return process.env.ADMIN_SECRET ?? 'fallback-dev-secret';
}

export function createPasswordSessionToken(): string {
  const ts = Date.now().toString();
  const mac = createHmac('sha256', getSecret()).update(ts).digest('hex');
  return `${ts}:${mac}`;
}

export function verifyPasswordSessionToken(token: string): boolean {
  try {
    const [ts, mac] = token.split(':');
    if (!ts || !mac) return false;

    // Check expiry
    if (Date.now() - parseInt(ts, 10) > SESSION_DURATION_MS) return false;

    // Constant-time compare
    const expected = createHmac('sha256', getSecret()).update(ts).digest('hex');
    const a = Buffer.from(mac, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function checkPasswordMatches(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(adminPassword);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Session verification ──────────────────────────────────────────────────────

export async function verifyAdminSession(
  request: NextRequest
): Promise<{ uid: string } | null> {
  // 1. Check password-based session cookie first
  const pwCookie = request.cookies.get('admin_pw_session')?.value;
  if (pwCookie && verifyPasswordSessionToken(pwCookie)) {
    return { uid: 'password-admin' };
  }

  // 2. Fall back to Firebase session cookie
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
