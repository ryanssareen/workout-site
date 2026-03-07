import { doc, getDoc } from 'firebase/firestore';
import { getDbInstance } from './config';

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export const RESERVED_USERNAMES = [
  'admin', 'api', 'preview', 'settings', 'profile', 'dashboard',
  'workouts', 'calendar', 'reports', 'login', 'register', 'onboarding',
  'coach', 'athlete', 'help', 'support', 'about', 'contact',
  'ai-coach', 'suggestions', 'features', 'connect-strava',
];

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username) return { valid: false, error: 'Username is required' };
  if (username.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
  if (username.length > 20) return { valid: false, error: 'Username must be 20 characters or less' };
  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, error: 'Username can only contain lowercase letters, numbers, and underscores' };
  }
  if (RESERVED_USERNAMES.includes(username)) {
    return { valid: false, error: 'This username is reserved' };
  }
  return { valid: true };
}

export async function getUsernameFromUid(uid: string): Promise<string | null> {
  try {
    // Fast path: userMappings collection
    const mappingDoc = await getDoc(doc(getDbInstance(), 'userMappings', uid));
    if (mappingDoc.exists()) {
      return mappingDoc.data().username;
    }

    // Fallback: query users collection by uid field (for accounts created
    // before the userMappings system). If found, backfill the mapping.
    const { query, collection, where, limit, getDocs, setDoc } = await import('firebase/firestore');
    const db = getDbInstance();
    const q = query(collection(db, 'users'), where('uid', '==', uid), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const username = snapshot.docs[0].id;
      // Backfill for next time
      setDoc(doc(db, 'userMappings', uid), { username }).catch(() => {});
      return username;
    }

    return null;
  } catch (error) {
    console.error('Error looking up username for UID:', error);
    return null;
  }
}

// ── In-memory cache for username availability checks ──
// Caches results to avoid burning Firestore reads on repeated checks.
// Cache entries expire after 2 minutes to stay reasonably fresh.
const usernameCache = new Map<string, { available: boolean; timestamp: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getCachedResult(username: string): boolean | null {
  const entry = usernameCache.get(username);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    usernameCache.delete(username);
    return null;
  }
  return entry.available;
}

function setCachedResult(username: string, available: boolean) {
  usernameCache.set(username, { available, timestamp: Date.now() });
  // Cap cache size (prevent unbounded growth)
  if (usernameCache.size > 200) {
    const oldest = usernameCache.keys().next().value;
    if (oldest) usernameCache.delete(oldest);
  }
}

export async function isUsernameAvailable(username: string): Promise<boolean | 'error'> {
  // Check cache first — zero network calls
  const cached = getCachedResult(username);
  if (cached !== null) return cached;

  // Try 1: API route (uses Admin SDK, bypasses security rules — works for unauthenticated users)
  try {
    const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    if (!data.serverError) {
      const available = data.available === true;
      setCachedResult(username, available);
      return available;
    }
    // Admin SDK failed — fall through to client-side
  } catch {}

  // Try 2: Client-side Firestore (works when user is authenticated, e.g. choose-username page)
  try {
    const userDoc = await getDoc(doc(getDbInstance(), 'users', username));
    const available = !userDoc.exists();
    setCachedResult(username, available);
    return available;
  } catch {
    return 'error';
  }
}
