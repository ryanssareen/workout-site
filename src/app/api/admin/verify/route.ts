export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';
import {
  verifyAdminSession,
  getAdminUids,
  checkOrigin,
  checkPasswordMatches,
  createPasswordSessionToken,
} from '@/lib/admin-auth';

// In-memory rate limiter (best-effort in serverless — resets on cold start)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// GET — check current session
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, uid: session.uid });
}

// POST — exchange password or Firebase ID token for a session cookie
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  if (!checkOrigin(request)) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
  }

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts', retryAfterSeconds: rateCheck.retryAfterSeconds },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    await delay(2000);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── Password-based auth ────────────────────────────────────────────────────
  if (typeof body.password === 'string') {
    if (!checkPasswordMatches(body.password)) {
      await delay(2000);
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = createPasswordSessionToken();
    const expiresInMs = 4 * 60 * 60 * 1000;
    const response = NextResponse.json({ authenticated: true, uid: 'password-admin' });
    response.cookies.set('admin_pw_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: expiresInMs / 1000,
      path: '/',
    });
    return response;
  }

  // ── Firebase ID token auth ─────────────────────────────────────────────────
  if (typeof body.idToken !== 'string' || !body.idToken) {
    await delay(2000);
    return NextResponse.json({ error: 'Missing password or idToken' }, { status: 400 });
  }

  const adminAuth = getAdminAuth();

  let decodedToken: { uid: string };
  try {
    decodedToken = await adminAuth.verifyIdToken(body.idToken);
  } catch {
    await delay(2000);
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const allowedUids = getAdminUids();
  if (allowedUids.length > 0 && !allowedUids.includes(decodedToken.uid)) {
    await delay(2000);
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Firebase session cookie — 4 hours
  const expiresInMs = 4 * 60 * 60 * 1000;
  let sessionCookie: string;
  try {
    sessionCookie = await adminAuth.createSessionCookie(body.idToken, { expiresIn: expiresInMs });
  } catch {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  const response = NextResponse.json({ authenticated: true, uid: decodedToken.uid });
  response.cookies.set('admin_session', sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: expiresInMs / 1000,
    path: '/',
  });
  return response;
}

// DELETE — logout
export async function DELETE(request: NextRequest) {
  if (!checkOrigin(request)) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
  }
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set('admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  response.cookies.set('admin_pw_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return response;
}
