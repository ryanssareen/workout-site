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
    const mappingDoc = await getDoc(doc(getDbInstance(), 'userMappings', uid));
    if (mappingDoc.exists()) {
      return mappingDoc.data().username;
    }
    return null;
  } catch (error) {
    console.error('Error looking up username for UID:', error);
    return null;
  }
}

export async function isUsernameAvailable(username: string): Promise<boolean | 'error'> {
  try {
    // Check Firestore directly via client SDK — avoids Admin SDK dependency
    const userDoc = await getDoc(doc(getDbInstance(), 'users', username));
    return !userDoc.exists();
  } catch (error) {
    console.error('Error checking username availability:', error);
    // Fallback to API route if client-side check fails (e.g. security rules)
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data.serverError) return 'error';
      return data.available === true;
    } catch {
      return 'error';
    }
  }
}
