export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import * as z from 'zod/v4';
import { getFirebaseAdminDb, getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { adminResolveUsername } from '@/lib/firebase/adminUserMapping';

const DEFAULT_WORKOUT_LIMIT = 20;
const MAX_WORKOUT_LIMIT = 50;

type WorkoutDoc = Record<string, unknown>;
type UserDoc = Record<string, unknown>;

// ─── Safe output types ────────────────────────────────────────────────────────

interface SafeWorkout {
  id: string;
  name: string | null;
  type: string | null;
  date: string | null;
  completed: boolean;
  duration: number | null;
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string | null;
  description: string | null;
  tags: string[];
  source: string | null;
  completedAt: string | null;
  completedLate: boolean | null;
  rating: number | null;
  feedback: string | null;
  // type-specific summaries
  swim: unknown | null;
  bike: unknown | null;
  run: unknown | null;
  strength: unknown | null;
  other: unknown | null;
}

interface SafeUser {
  username: string;
  displayName: string | null;
  email: string | null;
  role: string | null;
  coachUsername: string | null;
  createdAt: string | null;
  onboardingCompleted: boolean;
  stravaConnected: boolean;
}

// ─── Value helpers ────────────────────────────────────────────────────────────

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
      const parsed = (value as { toDate: () => Date }).toDate();
      if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function toSafeWorkout(id: string, data: WorkoutDoc): SafeWorkout {
  return {
    id,
    name: toOptionalString(data.name),
    type: toOptionalString(data.type),
    date: toIsoString(data.date),
    completed: data.completed === true,
    duration: toOptionalNumber(data.duration),
    assignedTo: toOptionalString(data.assignedTo),
    assignedToName: toOptionalString(data.assignedToName),
    createdBy: toOptionalString(data.createdBy),
    description: toOptionalString(data.description),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    source: toOptionalString(data.source),
    completedAt: toIsoString(data.completedAt),
    completedLate: typeof data.completedLate === 'boolean' ? data.completedLate : null,
    rating: toOptionalNumber(data.rating),
    feedback: toOptionalString(data.feedback),
    swim: data.swim ?? null,
    bike: data.bike ?? null,
    run: data.run ?? null,
    strength: data.strength ?? null,
    other: data.other ?? null,
  };
}

function toSafeUser(username: string, data: UserDoc): SafeUser {
  return {
    username,
    displayName: toOptionalString(data.displayName),
    email: toOptionalString(data.email),
    role: toOptionalString(data.role),
    coachUsername: toOptionalString(data.coachUsername),
    createdAt: toIsoString(data.createdAt),
    onboardingCompleted: data.onboardingCompleted === true,
    stravaConnected: typeof data.stravaId === 'string' && data.stravaId.length > 0,
  };
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

type UserRole = 'admin' | 'coach' | 'athlete' | 'student';

interface AuthenticatedUser {
  uid: string;
  username: string | null; // null for admin (API key) — tools resolve target via input
  role: UserRole;
}

function isValidApiKey(candidate: string, expected: string): boolean {
  const cb = Buffer.from(candidate.trim());
  const eb = Buffer.from(expected.trim());
  if (cb.length !== eb.length) return false;
  return timingSafeEqual(cb, eb);
}

async function resolveFirebaseUser(uid: string): Promise<AuthenticatedUser> {
  const username = await adminResolveUsername(uid);
  const db = getFirebaseAdminDb();
  const userDoc = await db.collection('users').doc(username).get();
  const role = (userDoc.data()?.role as UserRole) || 'athlete';
  return { uid, username, role };
}

async function authenticateRequest(request: NextRequest): Promise<AuthenticatedUser> {
  // Method 1: API key via x-api-key header — grants admin access to all users
  const apiKey = request.headers.get('x-api-key');
  const mcpSecret = process.env.MCP_SECRET;
  if (apiKey && mcpSecret && isValidApiKey(apiKey, mcpSecret)) {
    return { uid: 'mcp-api-key', username: null, role: 'admin' };
  }

  // Method 2 & 3: Bearer token (Firebase ID token or Google OAuth ID token)
  const authHeader = request.headers.get('authorization');
  if (!authHeader) throw new Error('Missing authorization');

  const [scheme, ...tokenParts] = authHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || tokenParts.length === 0) {
    throw new Error('Invalid authorization header');
  }

  const token = tokenParts.join(' ');
  if (!token) throw new Error('Empty bearer token');

  const adminAuth = getFirebaseAdminAuth();

  // Try Firebase ID token first
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return resolveFirebaseUser(decoded.uid);
  } catch {
    // Not a Firebase token — fall through to Google OAuth
  }

  // Method 3: Google OAuth ID token — verify via Google tokeninfo, then map to Firebase user
  try {
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (!googleRes.ok) throw new Error('Invalid Google token');

    const googlePayload = await googleRes.json() as { email?: string; email_verified?: string; aud?: string };
    const email = googlePayload.email;
    if (!email || googlePayload.email_verified !== 'true') {
      throw new Error('Google token email not verified');
    }

    // Verify the token audience matches our Firebase project's OAuth client ID
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && googlePayload.aud !== expectedClientId) {
      throw new Error('Google token audience mismatch');
    }

    // Look up the Firebase user by email
    const firebaseUser = await adminAuth.getUserByEmail(email);
    return resolveFirebaseUser(firebaseUser.uid);
  } catch (err) {
    throw new Error(`Authentication failed: ${err instanceof Error ? err.message : 'invalid token'}`);
  }
}

// ─── Coach helpers ───────────────────────────────────────────────────────────

async function verifyCoachAthlete(
  db: FirebaseFirestore.Firestore,
  coachUsername: string,
  athleteUsername: string,
): Promise<boolean> {
  const athleteDoc = await db.collection('users').doc(athleteUsername).get();
  if (!athleteDoc.exists) return false;
  return athleteDoc.data()?.coachUsername === coachUsername;
}

interface LinkedAthlete {
  username: string;
  displayName: string | null;
  email: string | null;
}

async function getLinkedAthletes(
  db: FirebaseFirestore.Firestore,
  coachUsername: string,
): Promise<LinkedAthlete[]> {
  const snapshot = await db.collection('users')
    .where('coachUsername', '==', coachUsername)
    .get();
  return snapshot.docs.map(d => ({
    username: d.id,
    displayName: toOptionalString(d.data().displayName),
    email: toOptionalString(d.data().email),
  }));
}

// ─── Target resolution ──────────────────────────────────────────────────────

/** Resolves which username a tool should operate on.
 *  - admin (API key): inputUsername required
 *  - coach + inputUsername: verifies coach-athlete link
 *  - regular user: returns own username, ignores inputUsername
 */
async function resolveTargetUsername(
  db: FirebaseFirestore.Firestore,
  authedUser: AuthenticatedUser,
  inputUsername?: string,
): Promise<{ target: string } | { error: string }> {
  const { username, role } = authedUser;

  if (role === 'admin') {
    if (!inputUsername) return { error: 'Admin callers must provide a username' };
    return { target: inputUsername };
  }

  if (inputUsername && inputUsername !== username) {
    if (role === 'coach') {
      const ok = await verifyCoachAthlete(db, username!, inputUsername);
      if (!ok) return { error: 'Not authorized to access this athlete' };
      return { target: inputUsername };
    }
    return { error: 'You can only access your own data' };
  }

  return { target: username! };
}

function errResponse(msg: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }] };
}

// ─── MCP server ───────────────────────────────────────────────────────────────

function createMcpServer(authedUser: AuthenticatedUser): McpServer {
  const server = new McpServer({ name: 'workout-site-mcp', version: '3.1.0' });
  const db = getFirebaseAdminDb();
  const { username, uid, role } = authedUser;
  const isAdmin = role === 'admin';

  // ── 1. get_user_workouts ──────────────────────────────────────────────────
  server.registerTool(
    'get_user_workouts',
    {
      title: 'Get User Workouts',
      description: 'Fetches recent workouts for a user. Admin: username required. Athletes: defaults to own.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin, optional for athletes/coaches)'),
        limit: z.number().int().min(1).max(MAX_WORKOUT_LIMIT).default(DEFAULT_WORKOUT_LIMIT),
      },
    },
    async (input: { username?: string; limit?: number }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const { limit = DEFAULT_WORKOUT_LIMIT } = input;
      const snapshot = await db.collection('users').doc(resolved.target).collection('workouts')
        .orderBy('date', 'desc').limit(limit).get();
      const workouts = snapshot.docs.map((d) => toSafeWorkout(d.id, d.data() as WorkoutDoc));
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ username: resolved.target, count: workouts.length, workouts }, null, 2),
        }],
      };
    }
  );

  // ── 2. get_workout_detail ─────────────────────────────────────────────────
  server.registerTool(
    'get_workout_detail',
    {
      title: 'Get Workout Detail',
      description: 'Returns full details of a workout by ID, including all sport-specific fields.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin)'),
        workoutId: z.string().min(1).max(128),
      },
    },
    async (input: { username?: string; workoutId: string }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const ref = db.collection('users').doc(resolved.target).collection('workouts').doc(input.workoutId);
      const doc = await ref.get();
      if (!doc.exists) return errResponse('Workout not found');
      const workout = toSafeWorkout(doc.id, doc.data() as WorkoutDoc);
      return { content: [{ type: 'text', text: JSON.stringify(workout, null, 2) }] };
    }
  );

  // ── 3. get_user_profile ─────────────────────────────────────────────────────
  server.registerTool(
    'get_user_profile',
    {
      title: 'Get User Profile',
      description: 'Returns a user profile. Admin: username required. Athletes: defaults to own.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin)'),
      },
    },
    async (input: { username?: string }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const doc = await db.collection('users').doc(resolved.target).get();
      if (!doc.exists) return errResponse('Profile not found');
      const profile = toSafeUser(doc.id, doc.data() as UserDoc);
      return { content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }] };
    }
  );

  // ── 4. get_user_stats ──────────────────────────────────────────────────────
  server.registerTool(
    'get_user_stats',
    {
      title: 'Get User Stats',
      description: 'Returns workout statistics: total workouts, completion rate, and breakdown by sport type.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin)'),
      },
    },
    async (input: { username?: string }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const workoutsSnap = await db.collection('users').doc(resolved.target).collection('workouts').get();

      const typeCount: Record<string, { total: number; completed: number }> = {};
      let completed = 0;
      for (const d of workoutsSnap.docs) {
        const w = d.data() as WorkoutDoc;
        const type = toOptionalString(w.type) ?? 'unknown';
        if (!typeCount[type]) typeCount[type] = { total: 0, completed: 0 };
        typeCount[type].total++;
        if (w.completed === true) { typeCount[type].completed++; completed++; }
      }

      const total = workoutsSnap.size;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            username: resolved.target,
            workouts: {
              total,
              completed,
              pending: total - completed,
              completionRate: total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%',
              byType: typeCount,
            },
          }, null, 2),
        }],
      };
    }
  );

  // ── 5. create_workout ─────────────────────────────────────────────────────
  server.registerTool(
    'create_workout',
    {
      title: 'Create Workout',
      description: 'Creates a new workout. Admin: username required. Coaches can assign to linked athletes.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin, optional for coaches to assign)'),
        name: z.string().min(1).max(200),
        type: z.enum(['swim', 'bike', 'run', 'walk', 'strength', 'other']),
        date: z.string().describe('ISO 8601 date string, e.g. 2026-03-01T18:30:00.000Z'),
        description: z.string().max(2000).optional(),
        duration: z.number().int().min(1).optional().describe('Duration in minutes'),
        tags: z.array(z.string()).optional(),
      },
    },
    async (input: {
      username?: string; name: string; type: string; date: string;
      description?: string; duration?: number; tags?: string[];
    }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const date = new Date(input.date);
      if (isNaN(date.getTime())) return errResponse('Invalid date format');
      const data: Record<string, unknown> = {
        name: input.name,
        type: input.type,
        date: date,
        ownerUsername: resolved.target,
        assignedTo: resolved.target,
        createdBy: username ?? 'admin',
        completed: false,
        source: 'mcp',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (input.description) data.description = input.description;
      if (input.duration) data.duration = input.duration;
      if (input.tags?.length) data.tags = input.tags;

      const ref = await db.collection('users').doc(resolved.target).collection('workouts').add(data);
      await db.collection('users').doc(resolved.target).update({ workoutCount: FieldValue.increment(1) });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, workoutId: ref.id, username: resolved.target }) }] };
    }
  );

  // ── 6. update_workout ─────────────────────────────────────────────────────
  server.registerTool(
    'update_workout',
    {
      title: 'Update Workout',
      description: 'Updates fields on a workout. Only the fields you provide will be changed.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin)'),
        workoutId: z.string().min(1).max(128),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        date: z.string().optional().describe('ISO 8601 date string'),
        duration: z.number().int().min(1).optional(),
        tags: z.array(z.string()).optional(),
        type: z.enum(['swim', 'bike', 'run', 'walk', 'strength', 'other']).optional(),
      },
    },
    async (input: {
      username?: string; workoutId: string; name?: string; description?: string; date?: string;
      duration?: number; tags?: string[]; type?: string;
    }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const { workoutId, username: _u, ...rest } = input;
      const ref = db.collection('users').doc(resolved.target).collection('workouts').doc(workoutId);
      const doc = await ref.get();
      if (!doc.exists) return errResponse('Workout not found');
      const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (rest.name !== undefined) updates.name = rest.name;
      if (rest.description !== undefined) updates.description = rest.description;
      if (rest.duration !== undefined) updates.duration = rest.duration;
      if (rest.tags !== undefined) updates.tags = rest.tags;
      if (rest.type !== undefined) updates.type = rest.type;
      if (rest.date !== undefined) {
        const d = new Date(rest.date);
        if (isNaN(d.getTime())) return errResponse('Invalid date format');
        updates.date = d;
      }
      await ref.update(updates);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, workoutId }) }] };
    }
  );

  // ── 7. delete_workout ─────────────────────────────────────────────────────
  server.registerTool(
    'delete_workout',
    {
      title: 'Delete Workout',
      description: 'Permanently deletes a workout by ID. This cannot be undone.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin)'),
        workoutId: z.string().min(1).max(128),
      },
    },
    async (input: { username?: string; workoutId: string }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const ref = db.collection('users').doc(resolved.target).collection('workouts').doc(input.workoutId);
      const doc = await ref.get();
      if (!doc.exists) return errResponse('Workout not found');
      await ref.delete();
      await db.collection('users').doc(resolved.target).update({ workoutCount: FieldValue.increment(-1) });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, deleted: input.workoutId }) }] };
    }
  );

  // ── 8. complete_workout ───────────────────────────────────────────────────
  server.registerTool(
    'complete_workout',
    {
      title: 'Complete / Uncomplete Workout',
      description: 'Marks a workout as completed or resets it to incomplete.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin)'),
        workoutId: z.string().min(1).max(128),
        completed: z.boolean(),
        notes: z.string().max(2000).optional(),
      },
    },
    async (input: { username?: string; workoutId: string; completed: boolean; notes?: string }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const ref = db.collection('users').doc(resolved.target).collection('workouts').doc(input.workoutId);
      const doc = await ref.get();
      if (!doc.exists) return errResponse('Workout not found');
      const updates: Record<string, unknown> = {
        completed: input.completed,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (input.completed) {
        updates.completedAt = FieldValue.serverTimestamp();
        updates.completedBy = 'mcp';
        if (input.notes) updates.completionNotes = input.notes;
        const workoutDate = toIsoString((doc.data() as WorkoutDoc).date);
        if (workoutDate) {
          updates.completedLate = new Date() > new Date(workoutDate);
        }
      } else {
        updates.completedAt = null;
        updates.completedBy = null;
        updates.completionNotes = null;
        updates.completedLate = null;
      }
      await ref.update(updates);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, workoutId: input.workoutId, completed: input.completed }) }] };
    }
  );

  // ── 9. get_workout_comments ───────────────────────────────────────────────
  server.registerTool(
    'get_workout_comments',
    {
      title: 'Get Workout Comments',
      description: 'Returns all comments on a workout.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin, coaches can pass athlete username)'),
        workoutId: z.string().min(1).max(128),
      },
    },
    async (input: { username?: string; workoutId: string }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const workoutRef = db.collection('users').doc(resolved.target).collection('workouts').doc(input.workoutId);
      const workoutDoc = await workoutRef.get();
      if (!workoutDoc.exists) return errResponse('Workout not found');
      const snapshot = await workoutRef
        .collection('comments')
        .orderBy('createdAt', 'asc')
        .get();
      const comments = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: toOptionalString(data.userId),
          userName: toOptionalString(data.userName),
          userRole: toOptionalString(data.userRole),
          text: toOptionalString(data.text),
          rating: toOptionalString(data.rating),
          createdAt: toIsoString(data.createdAt),
          parentCommentId: toOptionalString(data.parentCommentId) ?? null,
        };
      });
      return { content: [{ type: 'text', text: JSON.stringify({ workoutId: input.workoutId, count: comments.length, comments }, null, 2) }] };
    }
  );

  // ── 10. add_workout_comment ───────────────────────────────────────────────
  server.registerTool(
    'add_workout_comment',
    {
      title: 'Add Workout Comment',
      description: 'Posts a comment on a workout.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin)'),
        workoutId: z.string().min(1).max(128),
        text: z.string().min(1).max(2000),
        rating: z.enum(['too_easy', 'just_right', 'too_hard']).optional(),
      },
    },
    async (input: { username?: string; workoutId: string; text: string; rating?: string }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const workoutRef = db.collection('users').doc(resolved.target).collection('workouts').doc(input.workoutId);
      const workoutDoc = await workoutRef.get();
      if (!workoutDoc.exists) return errResponse('Workout not found');
      const data: Record<string, unknown> = {
        workoutId: input.workoutId,
        userId: uid,
        userName: username ?? 'admin',
        userRole: role,
        text: input.text,
        createdAt: FieldValue.serverTimestamp(),
      };
      if (input.rating) data.rating = input.rating;
      const ref = await workoutRef.collection('comments').add(data);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, commentId: ref.id }) }] };
    }
  );

  // ── 11. get_personal_records ──────────────────────────────────────────────
  server.registerTool(
    'get_personal_records',
    {
      title: 'Get Personal Records',
      description: 'Returns personal records for a user.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin)'),
      },
    },
    async (input: { username?: string }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const snapshot = await db.collection('personalRecords')
        .where('userId', '==', resolved.target)
        .orderBy('date', 'desc')
        .get();
      const records = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          category: toOptionalString(data.category),
          name: toOptionalString(data.name),
          value: toOptionalNumber(data.value),
          unit: toOptionalString(data.unit),
          date: toIsoString(data.date),
          previousValue: toOptionalNumber(data.previousValue),
          notes: toOptionalString(data.notes),
          workoutId: toOptionalString(data.workoutId),
        };
      });
      return { content: [{ type: 'text', text: JSON.stringify({ count: records.length, records }, null, 2) }] };
    }
  );

  // ── 12. check_data_health ─────────────────────────────────────────────────
  server.registerTool(
    'check_data_health',
    {
      title: 'Check Data Health',
      description: 'Scans workouts for data quality issues: missing fields, workouts with no type-specific data, unusually old pending workouts, etc.',
      inputSchema: {
        username: z.string().min(1).max(100).optional().describe('Target username (required for admin)'),
      },
    },
    async (input: { username?: string }) => {
      const resolved = await resolveTargetUsername(db, authedUser, input.username);
      if ('error' in resolved) return errResponse(resolved.error);
      const workoutsSnap = await db.collection('users').doc(resolved.target).collection('workouts')
        .orderBy('date', 'desc').limit(500).get();

      const issues: { workoutId: string; issue: string; severity: 'warning' | 'error' }[] = [];
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      for (const d of workoutsSnap.docs) {
        const w = d.data() as WorkoutDoc;
        const id = d.id;

        if (!w.name) issues.push({ workoutId: id, issue: 'Missing name', severity: 'error' });
        if (!w.type) issues.push({ workoutId: id, issue: 'Missing type', severity: 'error' });
        if (!w.date) issues.push({ workoutId: id, issue: 'Missing date', severity: 'error' });

        const type = toOptionalString(w.type);
        if (type && !['other', null].includes(type)) {
          if (!w[type]) {
            issues.push({ workoutId: id, issue: `type="${type}" but no ${type} data object present`, severity: 'warning' });
          }
        }

        const dateStr = toIsoString(w.date);
        if (dateStr && !w.completed) {
          const workoutDate = new Date(dateStr);
          if (workoutDate < thirtyDaysAgo) {
            issues.push({ workoutId: id, issue: `Workout from ${dateStr.slice(0, 10)} is still pending (>30 days old)`, severity: 'warning' });
          }
        }
      }

      const errors = issues.filter((i) => i.severity === 'error').length;
      const warnings = issues.filter((i) => i.severity === 'warning').length;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: { scanned: workoutsSnap.size, errors, warnings, totalIssues: issues.length },
            issues,
          }, null, 2),
        }],
      };
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Admin + Coach tools (registered for admin and coach roles)
  // ═══════════════════════════════════════════════════════════════════════════

  if (isAdmin || role === 'coach') {
    const MAX_ATHLETES = 25;

    // ── C1. list_users ─────────────────────────────────────────────────────
    server.registerTool(
      'list_users',
      {
        title: 'List Users',
        description: 'Admin: lists all users. Coach: lists linked athletes. Optionally includes per-user workout stats.',
        inputSchema: {
          includeStats: z.boolean().default(false).describe('Include per-user workout stats (uses more Firestore reads)'),
          limit: z.number().int().min(1).max(100).default(50).optional(),
        },
      },
      async (input: { includeStats?: boolean; limit?: number }) => {
        const maxUsers = input.limit ?? 50;
        let users: LinkedAthlete[];

        if (isAdmin) {
          const snapshot = await db.collection('users').limit(maxUsers).get();
          users = snapshot.docs.map(d => ({
            username: d.id,
            displayName: toOptionalString(d.data().displayName),
            email: toOptionalString(d.data().email),
          }));
        } else {
          users = await getLinkedAthletes(db, username!);
        }

        if (!input.includeStats) {
          return { content: [{ type: 'text', text: JSON.stringify({ count: users.length, users }, null, 2) }] };
        }

        const usersWithStats = await Promise.all(
          users.slice(0, MAX_ATHLETES).map(async (u) => {
            const workoutsSnap = await db.collection('users').doc(u.username)
              .collection('workouts').orderBy('date', 'desc').limit(50).get();
            const total = workoutsSnap.size;
            const completed = workoutsSnap.docs.filter(d => (d.data() as WorkoutDoc).completed === true).length;
            return {
              ...u,
              workoutCount: total,
              completedCount: completed,
              completionRate: total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%',
            };
          })
        );

        return { content: [{ type: 'text', text: JSON.stringify({ count: usersWithStats.length, users: usersWithStats }, null, 2) }] };
      }
    );

    // ── C2. get_athlete_workouts ───────────────────────────────────────────
    server.registerTool(
      'get_athlete_workouts',
      {
        title: 'Get Athlete Workouts',
        description: 'Fetches recent workouts for an athlete. Admin can access any user. Coaches can access linked athletes.',
        inputSchema: {
          athleteUsername: z.string().min(1).max(100),
          limit: z.number().int().min(1).max(MAX_WORKOUT_LIMIT).default(DEFAULT_WORKOUT_LIMIT),
        },
      },
      async (input: { athleteUsername: string; limit?: number }) => {
        if (!isAdmin && !await verifyCoachAthlete(db, username!, input.athleteUsername)) return errResponse('Not authorized to access this athlete');
        const { limit = DEFAULT_WORKOUT_LIMIT } = input;
        const snapshot = await db.collection('users').doc(input.athleteUsername)
          .collection('workouts').orderBy('date', 'desc').limit(limit).get();
        const workouts = snapshot.docs.map(d => toSafeWorkout(d.id, d.data() as WorkoutDoc));
        return { content: [{ type: 'text', text: JSON.stringify({ athleteUsername: input.athleteUsername, count: workouts.length, workouts }, null, 2) }] };
      }
    );

    // ── C3. get_athlete_workout_detail ─────────────────────────────────────
    server.registerTool(
      'get_athlete_workout_detail',
      {
        title: 'Get Athlete Workout Detail',
        description: 'Returns full details of a specific workout belonging to an athlete.',
        inputSchema: {
          athleteUsername: z.string().min(1).max(100),
          workoutId: z.string().min(1).max(128),
        },
      },
      async (input: { athleteUsername: string; workoutId: string }) => {
        if (!isAdmin && !await verifyCoachAthlete(db, username!, input.athleteUsername)) return errResponse('Not authorized to access this athlete');
        const ref = db.collection('users').doc(input.athleteUsername).collection('workouts').doc(input.workoutId);
        const doc = await ref.get();
        if (!doc.exists) return errResponse('Workout not found');
        return { content: [{ type: 'text', text: JSON.stringify(toSafeWorkout(doc.id, doc.data() as WorkoutDoc), null, 2) }] };
      }
    );

    // ── C4. assign_workout ────────────────────────────────────────────────
    server.registerTool(
      'assign_workout',
      {
        title: 'Assign Workout to Athlete',
        description: 'Creates a new workout assigned to an athlete.',
        inputSchema: {
          athleteUsername: z.string().min(1).max(100),
          name: z.string().min(1).max(200),
          type: z.enum(['swim', 'bike', 'run', 'walk', 'strength', 'other']),
          date: z.string().describe('ISO 8601 date string'),
          description: z.string().max(2000).optional(),
          duration: z.number().int().min(1).optional().describe('Duration in minutes'),
          tags: z.array(z.string()).optional(),
        },
      },
      async (input: {
        athleteUsername: string; name: string; type: string; date: string;
        description?: string; duration?: number; tags?: string[];
      }) => {
        if (!isAdmin && !await verifyCoachAthlete(db, username!, input.athleteUsername)) return errResponse('Not authorized to access this athlete');
        const date = new Date(input.date);
        if (isNaN(date.getTime())) return errResponse('Invalid date format');
        const data: Record<string, unknown> = {
          name: input.name,
          type: input.type,
          date,
          ownerUsername: input.athleteUsername,
          assignedTo: input.athleteUsername,
          createdBy: username ?? 'admin',
          completed: false,
          source: 'mcp',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (input.description) data.description = input.description;
        if (input.duration) data.duration = input.duration;
        if (input.tags?.length) data.tags = input.tags;

        const ref = await db.collection('users').doc(input.athleteUsername).collection('workouts').add(data);
        await db.collection('users').doc(input.athleteUsername).update({ workoutCount: FieldValue.increment(1) });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, workoutId: ref.id, assignedTo: input.athleteUsername }) }] };
      }
    );

    // ── C5. get_coach_dashboard_stats ──────────────────────────────────────
    server.registerTool(
      'get_coach_dashboard_stats',
      {
        title: 'Get Dashboard Stats',
        description: 'Admin: aggregate stats across all users. Coach: aggregate stats across linked athletes.',
        inputSchema: {},
      },
      async () => {
        let athletes: LinkedAthlete[];
        if (isAdmin) {
          const snapshot = await db.collection('users').limit(MAX_ATHLETES).get();
          athletes = snapshot.docs.map(d => ({
            username: d.id,
            displayName: toOptionalString(d.data().displayName),
            email: toOptionalString(d.data().email),
          }));
        } else {
          athletes = await getLinkedAthletes(db, username!);
        }
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const workoutsByType: Record<string, { total: number; completed: number }> = {};
        let totalWorkouts = 0;
        let totalCompleted = 0;

        const studentsWithStats = await Promise.all(
          athletes.slice(0, MAX_ATHLETES).map(async (athlete) => {
            const snap = await db.collection('users').doc(athlete.username)
              .collection('workouts').orderBy('date', 'desc').limit(50).get();
            let studentCompleted = 0;
            let isActive = false;

            for (const d of snap.docs) {
              const w = d.data() as WorkoutDoc;
              const type = toOptionalString(w.type) ?? 'unknown';
              if (!workoutsByType[type]) workoutsByType[type] = { total: 0, completed: 0 };
              workoutsByType[type].total++;
              totalWorkouts++;

              if (w.completed === true) {
                workoutsByType[type].completed++;
                totalCompleted++;
                studentCompleted++;
                const completedDate = toIsoString(w.completedAt) || toIsoString(w.date);
                if (completedDate && new Date(completedDate) >= sevenDaysAgo) {
                  isActive = true;
                }
              }
            }

            return {
              username: athlete.username,
              displayName: athlete.displayName,
              assignedWorkouts: snap.size,
              completedWorkouts: studentCompleted,
              completionRate: snap.size > 0 ? `${Math.round((studentCompleted / snap.size) * 100)}%` : '0%',
              isActive,
            };
          })
        );

        const activeStudents = studentsWithStats.filter(s => s.isActive).length;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              totalStudents: athletes.length,
              activeStudents,
              totalWorkouts,
              completedWorkouts: totalCompleted,
              pendingWorkouts: totalWorkouts - totalCompleted,
              overallCompletionRate: totalWorkouts > 0 ? `${Math.round((totalCompleted / totalWorkouts) * 100)}%` : '0%',
              workoutsByType,
              studentsWithStats,
            }, null, 2),
          }],
        };
      }
    );
  }

  return server;
}

// ─── Request handler ──────────────────────────────────────────────────────────

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  let user: AuthenticatedUser;
  try {
    user = await authenticateRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    const server = createMcpServer(user);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}
