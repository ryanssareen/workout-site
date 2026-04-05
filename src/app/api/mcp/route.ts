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

type UserRole = 'coach' | 'athlete' | 'student';

interface AuthenticatedUser {
  uid: string;
  username: string;
  role: UserRole;
}

function isValidApiKey(candidate: string, expected: string): boolean {
  const cb = Buffer.from(candidate.trim());
  const eb = Buffer.from(expected.trim());
  if (cb.length !== eb.length) return false;
  return timingSafeEqual(cb, eb);
}

async function authenticateRequest(request: NextRequest): Promise<AuthenticatedUser> {
  // Method 1: API key via x-api-key header (for Claude Desktop / AI agents)
  const apiKey = request.headers.get('x-api-key');
  const mcpSecret = process.env.MCP_SECRET;
  const mcpUser = process.env.MCP_DEFAULT_USERNAME;
  if (apiKey && mcpSecret && mcpUser && isValidApiKey(apiKey, mcpSecret)) {
    const db = getFirebaseAdminDb();
    const userDoc = await db.collection('users').doc(mcpUser).get();
    const role = (userDoc.data()?.role as UserRole) || 'athlete';
    return { uid: 'mcp-api-key', username: mcpUser, role };
  }

  // Method 2: Firebase ID token via Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (!authHeader) throw new Error('Missing authorization');

  const [scheme, ...tokenParts] = authHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || tokenParts.length === 0) {
    throw new Error('Invalid authorization header');
  }

  const idToken = tokenParts.join(' ');
  if (!idToken) throw new Error('Empty bearer token');

  const adminAuth = getFirebaseAdminAuth();
  const decoded = await adminAuth.verifyIdToken(idToken);
  const username = await adminResolveUsername(decoded.uid);

  const db = getFirebaseAdminDb();
  const userDoc = await db.collection('users').doc(username).get();
  const role = (userDoc.data()?.role as UserRole) || 'athlete';

  return { uid: decoded.uid, username, role };
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

// ─── MCP server ───────────────────────────────────────────────────────────────

function createMcpServer(authedUser: AuthenticatedUser): McpServer {
  const server = new McpServer({ name: 'workout-site-mcp', version: '3.0.0' });
  const db = getFirebaseAdminDb();
  const { username, uid, role } = authedUser;

  // ── 1. get_user_workouts ──────────────────────────────────────────────────
  server.registerTool(
    'get_user_workouts',
    {
      title: 'Get My Workouts',
      description: 'Fetches your recent workouts.',
      inputSchema: {
        limit: z.number().int().min(1).max(MAX_WORKOUT_LIMIT).default(DEFAULT_WORKOUT_LIMIT),
      },
    },
    async (input: { limit?: number }) => {
      const { limit = DEFAULT_WORKOUT_LIMIT } = input;
      const snapshot = await db.collection('users').doc(username).collection('workouts')
        .orderBy('date', 'desc').limit(limit).get();
      const workouts = snapshot.docs.map((d) => toSafeWorkout(d.id, d.data() as WorkoutDoc));
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ username, count: workouts.length, workouts }, null, 2),
        }],
      };
    }
  );

  // ── 2. get_workout_detail ─────────────────────────────────────────────────
  server.registerTool(
    'get_workout_detail',
    {
      title: 'Get Workout Detail',
      description: 'Returns full details of one of your workouts by ID, including all sport-specific fields.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
      },
    },
    async (input: { workoutId: string }) => {
      const ref = db.collection('users').doc(username).collection('workouts').doc(input.workoutId);
      const doc = await ref.get();
      if (!doc.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
      }
      const workout = toSafeWorkout(doc.id, doc.data() as WorkoutDoc);
      return { content: [{ type: 'text', text: JSON.stringify(workout, null, 2) }] };
    }
  );

  // ── 3. get_my_profile ──────────────────────────────────────────────────────
  server.registerTool(
    'get_my_profile',
    {
      title: 'Get My Profile',
      description: 'Returns your user profile.',
      inputSchema: {},
    },
    async () => {
      const doc = await db.collection('users').doc(username).get();
      if (!doc.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Profile not found' }) }] };
      }
      const profile = toSafeUser(doc.id, doc.data() as UserDoc);
      return {
        content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }],
      };
    }
  );

  // ── 4. get_my_stats ───────────────────────────────────────────────────────
  server.registerTool(
    'get_my_stats',
    {
      title: 'Get My Stats',
      description: 'Returns your workout statistics: total workouts, completion rate, and breakdown by sport type.',
      inputSchema: {},
    },
    async () => {
      const workoutsSnap = await db.collection('users').doc(username).collection('workouts').get();

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
            username,
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
      description: 'Creates a new workout for you (or assigns to a linked athlete if you are a coach). Returns the new workout ID.',
      inputSchema: {
        name: z.string().min(1).max(200),
        type: z.enum(['swim', 'bike', 'run', 'walk', 'strength', 'other']),
        date: z.string().describe('ISO 8601 date string, e.g. 2026-03-01T18:30:00.000Z'),
        description: z.string().max(2000).optional(),
        duration: z.number().int().min(1).optional().describe('Duration in minutes'),
        tags: z.array(z.string()).optional(),
        assignedTo: z.string().min(1).max(100).optional().describe('Coaches only: username of athlete to assign to'),
      },
    },
    async (input: {
      name: string; type: string; date: string;
      description?: string; duration?: number; tags?: string[]; assignedTo?: string;
    }) => {
      const targetUser = input.assignedTo || username;
      if (input.assignedTo) {
        if (role !== 'coach') {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Only coaches can assign workouts to athletes' }) }] };
        }
        if (!await verifyCoachAthlete(db, username, input.assignedTo)) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Not authorized to access this athlete' }) }] };
        }
      }
      const date = new Date(input.date);
      if (isNaN(date.getTime())) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid date format' }) }] };
      }
      const data: Record<string, unknown> = {
        name: input.name,
        type: input.type,
        date: date,
        ownerUsername: targetUser,
        assignedTo: targetUser,
        createdBy: username,
        completed: false,
        source: 'mcp',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (input.description) data.description = input.description;
      if (input.duration) data.duration = input.duration;
      if (input.tags?.length) data.tags = input.tags;

      const ref = await db.collection('users').doc(targetUser).collection('workouts').add(data);
      await db.collection('users').doc(targetUser).update({ workoutCount: FieldValue.increment(1) });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, workoutId: ref.id, assignedTo: targetUser }) }] };
    }
  );

  // ── 6. update_workout ─────────────────────────────────────────────────────
  server.registerTool(
    'update_workout',
    {
      title: 'Update Workout',
      description: 'Updates fields on one of your workouts. Only the fields you provide will be changed.',
      inputSchema: {
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
      workoutId: string; name?: string; description?: string; date?: string;
      duration?: number; tags?: string[]; type?: string;
    }) => {
      const { workoutId, ...rest } = input;
      const ref = db.collection('users').doc(username).collection('workouts').doc(workoutId);
      const doc = await ref.get();
      if (!doc.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
      }
      const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (rest.name !== undefined) updates.name = rest.name;
      if (rest.description !== undefined) updates.description = rest.description;
      if (rest.duration !== undefined) updates.duration = rest.duration;
      if (rest.tags !== undefined) updates.tags = rest.tags;
      if (rest.type !== undefined) updates.type = rest.type;
      if (rest.date !== undefined) {
        const d = new Date(rest.date);
        if (isNaN(d.getTime())) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid date format' }) }] };
        }
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
      description: 'Permanently deletes one of your workouts by ID. This cannot be undone.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
      },
    },
    async (input: { workoutId: string }) => {
      const ref = db.collection('users').doc(username).collection('workouts').doc(input.workoutId);
      const doc = await ref.get();
      if (!doc.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
      }
      await ref.delete();
      await db.collection('users').doc(username).update({ workoutCount: FieldValue.increment(-1) });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, deleted: input.workoutId }) }] };
    }
  );

  // ── 8. complete_workout ───────────────────────────────────────────────────
  server.registerTool(
    'complete_workout',
    {
      title: 'Complete / Uncomplete Workout',
      description: 'Marks one of your workouts as completed or resets it to incomplete.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
        completed: z.boolean(),
        notes: z.string().max(2000).optional(),
      },
    },
    async (input: { workoutId: string; completed: boolean; notes?: string }) => {
      const ref = db.collection('users').doc(username).collection('workouts').doc(input.workoutId);
      const doc = await ref.get();
      if (!doc.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
      }
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
      description: 'Returns all comments on a workout. Coaches can pass athleteUsername to view an athlete\'s workout comments.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
        athleteUsername: z.string().min(1).max(100).optional().describe('Coaches only: username of athlete who owns the workout'),
      },
    },
    async (input: { workoutId: string; athleteUsername?: string }) => {
      let ownerUsername = username;
      if (input.athleteUsername) {
        if (role !== 'coach') {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Only coaches can view athlete workout comments' }) }] };
        }
        if (!await verifyCoachAthlete(db, username, input.athleteUsername)) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Not authorized to access this athlete' }) }] };
        }
        ownerUsername = input.athleteUsername;
      }
      const workoutRef = db.collection('users').doc(ownerUsername).collection('workouts').doc(input.workoutId);
      const workoutDoc = await workoutRef.get();
      if (!workoutDoc.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
      }
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
      description: 'Posts a comment on a workout. Coaches can pass athleteUsername to comment on an athlete\'s workout.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
        text: z.string().min(1).max(2000),
        rating: z.enum(['too_easy', 'just_right', 'too_hard']).optional(),
        athleteUsername: z.string().min(1).max(100).optional().describe('Coaches only: username of athlete who owns the workout'),
      },
    },
    async (input: { workoutId: string; text: string; rating?: string; athleteUsername?: string }) => {
      let ownerUsername = username;
      if (input.athleteUsername) {
        if (role !== 'coach') {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Only coaches can comment on athlete workouts' }) }] };
        }
        if (!await verifyCoachAthlete(db, username, input.athleteUsername)) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Not authorized to access this athlete' }) }] };
        }
        ownerUsername = input.athleteUsername;
      }
      const workoutRef = db.collection('users').doc(ownerUsername).collection('workouts').doc(input.workoutId);
      const workoutDoc = await workoutRef.get();
      if (!workoutDoc.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
      }
      const data: Record<string, unknown> = {
        workoutId: input.workoutId,
        userId: uid,
        userName: username,
        userRole: role === 'coach' ? 'coach' : 'athlete',
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
      title: 'Get My Personal Records',
      description: 'Returns all your personal records.',
      inputSchema: {},
    },
    async () => {
      const snapshot = await db.collection('personalRecords')
        .where('userId', '==', username)
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
      title: 'Check My Data Health',
      description: 'Scans your workouts for data quality issues: missing fields, workouts with no type-specific data, unusually old pending workouts, etc.',
      inputSchema: {},
    },
    async () => {
      const workoutsSnap = await db.collection('users').doc(username).collection('workouts')
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
  // Coach-only tools (only registered when authenticated user has role=coach)
  // ═══════════════════════════════════════════════════════════════════════════

  if (role === 'coach') {
    const COACH_UNAUTHORIZED = { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Not authorized to access this athlete' }) }] };
    const MAX_ATHLETES = 25;

    // ── C1. get_my_athletes ───────────────────────────────────────────────
    server.registerTool(
      'get_my_athletes',
      {
        title: 'Get My Athletes',
        description: 'Lists all athletes linked to you as their coach.',
        inputSchema: {
          includeStats: z.boolean().default(false).describe('Include per-athlete workout stats (uses more Firestore reads)'),
        },
      },
      async (input: { includeStats?: boolean }) => {
        const athletes = await getLinkedAthletes(db, username);
        if (!input.includeStats) {
          return { content: [{ type: 'text', text: JSON.stringify({ count: athletes.length, athletes }, null, 2) }] };
        }

        const athletesWithStats = await Promise.all(
          athletes.slice(0, MAX_ATHLETES).map(async (athlete) => {
            const workoutsSnap = await db.collection('users').doc(athlete.username)
              .collection('workouts').orderBy('date', 'desc').limit(50).get();
            const total = workoutsSnap.size;
            const completed = workoutsSnap.docs.filter(d => (d.data() as WorkoutDoc).completed === true).length;
            return {
              ...athlete,
              workoutCount: total,
              completedCount: completed,
              completionRate: total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%',
            };
          })
        );

        return { content: [{ type: 'text', text: JSON.stringify({ count: athletesWithStats.length, athletes: athletesWithStats }, null, 2) }] };
      }
    );

    // ── C2. get_athlete_workouts ───────────────────────────────────────────
    server.registerTool(
      'get_athlete_workouts',
      {
        title: 'Get Athlete Workouts',
        description: 'Fetches recent workouts for one of your linked athletes.',
        inputSchema: {
          athleteUsername: z.string().min(1).max(100),
          limit: z.number().int().min(1).max(MAX_WORKOUT_LIMIT).default(DEFAULT_WORKOUT_LIMIT),
        },
      },
      async (input: { athleteUsername: string; limit?: number }) => {
        if (!await verifyCoachAthlete(db, username, input.athleteUsername)) return COACH_UNAUTHORIZED;
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
        description: 'Returns full details of a specific workout belonging to one of your linked athletes.',
        inputSchema: {
          athleteUsername: z.string().min(1).max(100),
          workoutId: z.string().min(1).max(128),
        },
      },
      async (input: { athleteUsername: string; workoutId: string }) => {
        if (!await verifyCoachAthlete(db, username, input.athleteUsername)) return COACH_UNAUTHORIZED;
        const ref = db.collection('users').doc(input.athleteUsername).collection('workouts').doc(input.workoutId);
        const doc = await ref.get();
        if (!doc.exists) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify(toSafeWorkout(doc.id, doc.data() as WorkoutDoc), null, 2) }] };
      }
    );

    // ── C4. assign_workout ────────────────────────────────────────────────
    server.registerTool(
      'assign_workout',
      {
        title: 'Assign Workout to Athlete',
        description: 'Creates a new workout assigned to one of your linked athletes.',
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
        if (!await verifyCoachAthlete(db, username, input.athleteUsername)) return COACH_UNAUTHORIZED;
        const date = new Date(input.date);
        if (isNaN(date.getTime())) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid date format' }) }] };
        }
        const data: Record<string, unknown> = {
          name: input.name,
          type: input.type,
          date,
          ownerUsername: input.athleteUsername,
          assignedTo: input.athleteUsername,
          createdBy: username,
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
        title: 'Get Coach Dashboard Stats',
        description: 'Returns aggregate statistics across all your linked athletes: completion rates, active athletes, workout breakdown by type and per-athlete stats.',
        inputSchema: {},
      },
      async () => {
        const athletes = await getLinkedAthletes(db, username);
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
