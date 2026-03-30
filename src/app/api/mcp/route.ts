export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import * as z from 'zod/v4';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
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

// ─── Workout lookup helper ────────────────────────────────────────────────────

/**
 * Find a workout document by its ID across all user subcollections.
 * If ownerUsername is provided, uses direct path lookup (fast).
 * Otherwise falls back to collectionGroup scan (admin MCP tool, acceptable perf).
 */
async function getWorkoutDocById(
  db: FirebaseFirestore.Firestore,
  workoutId: string,
  ownerUsername?: string,
) {
  // Fast path: direct lookup if owner is known
  if (ownerUsername) {
    const ref = db.collection('users').doc(ownerUsername).collection('workouts').doc(workoutId);
    const doc = await ref.get();
    if (doc.exists) return { doc, ref };
    return null;
  }

  // Slow path: scan collectionGroup (admin MCP tool, acceptable)
  const snap = await db.collectionGroup('workouts').get();
  for (const doc of snap.docs) {
    if (doc.id === workoutId) {
      return { doc, ref: doc.ref };
    }
  }
  return null;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isAuthorizedApiKey(candidate: string | null, expected: string): boolean {
  if (!candidate) return false;
  const nc = candidate.trim();
  const ne = expected.trim();
  if (!nc || !ne) return false;
  const cb = Buffer.from(nc);
  const eb = Buffer.from(ne);
  if (cb.length !== eb.length) return false;
  return timingSafeEqual(cb, eb);
}

function getApiKeyFromRequest(request: NextRequest): string | null {
  const directKey = request.headers.get('x-api-key');
  if (directKey) return directKey;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, ...tokenParts] = authHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || tokenParts.length === 0) return null;
  return tokenParts.join(' ') || null;
}

// ─── MCP server ───────────────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'workout-site-mcp', version: '2.0.0' });
  const db = getFirebaseAdminDb();

  // ── 1. get_user_workouts ──────────────────────────────────────────────────
  server.registerTool(
    'get_user_workouts',
    {
      title: 'Get User Workouts',
      description: 'Fetches recent workouts. Pass username to filter by user, or omit for all users.',
      inputSchema: {
        username: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
        limit: z.number().int().min(1).max(MAX_WORKOUT_LIMIT).default(DEFAULT_WORKOUT_LIMIT),
      },
    },
    async (input: { username?: string; limit?: number }) => {
      const { username, limit = DEFAULT_WORKOUT_LIMIT } = input;
      let snapshot;
      if (username) {
        // Query from user's workout subcollection
        snapshot = await db.collection('users').doc(username).collection('workouts')
          .orderBy('date', 'desc').limit(limit).get();
      } else {
        // Query across all users via collectionGroup
        snapshot = await db.collectionGroup('workouts')
          .orderBy('date', 'desc').limit(limit).get();
      }
      const workouts = snapshot.docs.map((d) => toSafeWorkout(d.id, d.data() as WorkoutDoc));
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ scope: username ? 'single_user' : 'all_users', username: username ?? null, count: workouts.length, workouts }, null, 2),
        }],
      };
    }
  );

  // ── 2. get_workout_detail ─────────────────────────────────────────────────
  server.registerTool(
    'get_workout_detail',
    {
      title: 'Get Workout Detail',
      description: 'Returns full details of a single workout by ID, including all sport-specific fields. Provide ownerUsername for faster lookup.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
        ownerUsername: z.string().min(1).max(128).optional(),
      },
    },
    async (input: { workoutId: string; ownerUsername?: string }) => {
      const result = await getWorkoutDocById(db, input.workoutId, input.ownerUsername);
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
      }
      const workout = toSafeWorkout(result.doc.id, result.doc.data() as WorkoutDoc);
      return { content: [{ type: 'text', text: JSON.stringify(workout, null, 2) }] };
    }
  );

  // ── 3. get_users ──────────────────────────────────────────────────────────
  server.registerTool(
    'get_users',
    {
      title: 'Get Users',
      description: 'Lists all users. Optionally filter by role (coach / athlete / student). Does NOT return tokens or sensitive credentials.',
      inputSchema: {
        role: z.enum(['coach', 'athlete', 'student']).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      },
    },
    async (input: { role?: 'coach' | 'athlete' | 'student'; limit?: number }) => {
      const { role, limit = 50 } = input;
      const col = db.collection('users');
      const snapshot = role
        ? await col.where('role', '==', role).limit(limit).get()
        : await col.limit(limit).get();
      const users = snapshot.docs.map((d) => toSafeUser(d.id, d.data() as UserDoc));
      return {
        content: [{ type: 'text', text: JSON.stringify({ count: users.length, users }, null, 2) }],
      };
    }
  );

  // ── 4. get_site_stats ─────────────────────────────────────────────────────
  server.registerTool(
    'get_site_stats',
    {
      title: 'Get Site Stats',
      description: 'Returns aggregate statistics: total users by role, total workouts, completion rate, and breakdown by sport type.',
      inputSchema: {},
    },
    async () => {
      const [usersSnap, workoutsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collectionGroup('workouts').get(),
      ]);

      const roleCount: Record<string, number> = {};
      for (const d of usersSnap.docs) {
        const role = toOptionalString((d.data() as UserDoc).role) ?? 'unknown';
        roleCount[role] = (roleCount[role] ?? 0) + 1;
      }

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
            users: { total: usersSnap.size, byRole: roleCount },
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
      description: 'Creates a new workout and assigns it to a user. Returns the new workout ID.',
      inputSchema: {
        name: z.string().min(1).max(200),
        type: z.enum(['swim', 'bike', 'run', 'walk', 'strength', 'other']),
        date: z.string().describe('ISO 8601 date string, e.g. 2026-03-01T18:30:00.000Z'),
        assignedTo: z.string().min(1).max(128).describe('Username of the athlete to assign to'),
        createdBy: z.string().min(1).max(128).describe('Username of the coach/creator'),
        description: z.string().max(2000).optional(),
        duration: z.number().int().min(1).optional().describe('Duration in minutes'),
        tags: z.array(z.string()).optional(),
      },
    },
    async (input: {
      name: string; type: string; date: string; assignedTo: string;
      createdBy: string; description?: string; duration?: number; tags?: string[];
    }) => {
      const date = new Date(input.date);
      if (isNaN(date.getTime())) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid date format' }) }] };
      }
      const ownerUsername = input.assignedTo;
      const data: Record<string, unknown> = {
        name: input.name,
        type: input.type,
        date: date,
        ownerUsername,
        assignedTo: input.assignedTo,
        createdBy: input.createdBy,
        completed: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (input.description) data.description = input.description;
      if (input.duration) data.duration = input.duration;
      if (input.tags?.length) data.tags = input.tags;

      const ref = await db.collection('users').doc(ownerUsername).collection('workouts').add(data);
      await db.collection('users').doc(ownerUsername).update({ workoutCount: FieldValue.increment(1) });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, workoutId: ref.id }) }] };
    }
  );

  // ── 6. update_workout ─────────────────────────────────────────────────────
  server.registerTool(
    'update_workout',
    {
      title: 'Update Workout',
      description: 'Updates fields on an existing workout. Only the fields you provide will be changed. Provide ownerUsername for faster lookup.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
        ownerUsername: z.string().min(1).max(128).optional(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        date: z.string().optional().describe('ISO 8601 date string'),
        duration: z.number().int().min(1).optional(),
        tags: z.array(z.string()).optional(),
        type: z.enum(['swim', 'bike', 'run', 'walk', 'strength', 'other']).optional(),
      },
    },
    async (input: {
      workoutId: string; ownerUsername?: string; name?: string; description?: string; date?: string;
      duration?: number; tags?: string[]; type?: string;
    }) => {
      const { workoutId, ownerUsername, ...rest } = input;
      const result = await getWorkoutDocById(db, workoutId, ownerUsername);
      if (!result) {
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
      await result.ref.update(updates);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, workoutId }) }] };
    }
  );

  // ── 7. delete_workout ─────────────────────────────────────────────────────
  server.registerTool(
    'delete_workout',
    {
      title: 'Delete Workout',
      description: 'Permanently deletes a workout by ID. This cannot be undone. Provide ownerUsername for faster lookup.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
        ownerUsername: z.string().min(1).max(128).optional(),
      },
    },
    async (input: { workoutId: string; ownerUsername?: string }) => {
      const result = await getWorkoutDocById(db, input.workoutId, input.ownerUsername);
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
      }
      const ownerUsername = result.ref.parent.parent?.id;
      await result.ref.delete();
      if (ownerUsername) {
        await db.collection('users').doc(ownerUsername).update({ workoutCount: FieldValue.increment(-1) });
      }
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, deleted: input.workoutId }) }] };
    }
  );

  // ── 8. complete_workout ───────────────────────────────────────────────────
  server.registerTool(
    'complete_workout',
    {
      title: 'Complete / Uncomplete Workout',
      description: 'Marks a workout as completed or resets it to incomplete. Provide ownerUsername for faster lookup.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
        ownerUsername: z.string().min(1).max(128).optional(),
        completed: z.boolean(),
        notes: z.string().max(2000).optional(),
      },
    },
    async (input: { workoutId: string; ownerUsername?: string; completed: boolean; notes?: string }) => {
      const result = await getWorkoutDocById(db, input.workoutId, input.ownerUsername);
      if (!result) {
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
        const workoutDate = toIsoString((result.doc.data() as WorkoutDoc).date);
        if (workoutDate) {
          updates.completedLate = new Date() > new Date(workoutDate);
        }
      } else {
        updates.completedAt = null;
        updates.completedBy = null;
        updates.completionNotes = null;
        updates.completedLate = null;
      }
      await result.ref.update(updates);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, workoutId: input.workoutId, completed: input.completed }) }] };
    }
  );

  // ── 9. get_workout_comments ───────────────────────────────────────────────
  server.registerTool(
    'get_workout_comments',
    {
      title: 'Get Workout Comments',
      description: 'Returns all comments on a workout, ordered by creation time. Provide ownerUsername for faster lookup.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
        ownerUsername: z.string().min(1).max(128).optional(),
      },
    },
    async (input: { workoutId: string; ownerUsername?: string }) => {
      const result = await getWorkoutDocById(db, input.workoutId, input.ownerUsername);
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
      }
      const snapshot = await result.ref
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
      description: 'Posts a comment on a workout. Use this for AI coaching feedback. Provide ownerUsername for faster lookup.',
      inputSchema: {
        workoutId: z.string().min(1).max(128),
        ownerUsername: z.string().min(1).max(128).optional(),
        userId: z.string().min(1).max(128),
        userName: z.string().min(1).max(100),
        userRole: z.enum(['coach', 'athlete', 'student']),
        text: z.string().min(1).max(2000),
        rating: z.enum(['too_easy', 'just_right', 'too_hard']).optional(),
      },
    },
    async (input: {
      workoutId: string; ownerUsername?: string; userId: string; userName: string;
      userRole: string; text: string; rating?: string;
    }) => {
      const result = await getWorkoutDocById(db, input.workoutId, input.ownerUsername);
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Workout not found' }) }] };
      }
      const data: Record<string, unknown> = {
        workoutId: input.workoutId,
        userId: input.userId,
        userName: input.userName,
        userRole: input.userRole,
        text: input.text,
        createdAt: FieldValue.serverTimestamp(),
      };
      if (input.rating) data.rating = input.rating;
      const ref = await result.ref
        .collection('comments')
        .add(data);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, commentId: ref.id }) }] };
    }
  );

  // ── 11. get_personal_records ──────────────────────────────────────────────
  server.registerTool(
    'get_personal_records',
    {
      title: 'Get Personal Records',
      description: 'Returns all personal records for a user, or all records across everyone if userId is omitted.',
      inputSchema: {
        userId: z.string().min(1).max(128).optional(),
      },
    },
    async (input: { userId?: string }) => {
      const col = db.collection('personalRecords');
      const snapshot = input.userId
        ? await col.where('userId', '==', input.userId).orderBy('date', 'desc').get()
        : await col.orderBy('date', 'desc').limit(100).get();
      const records = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: toOptionalString(data.userId),
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
      description: 'Scans all workouts for data quality issues: missing fields, orphaned assignments, workouts with no type-specific data, unusually old pending workouts, etc.',
      inputSchema: {},
    },
    async () => {
      const [workoutsSnap, usersSnap] = await Promise.all([
        db.collectionGroup('workouts').orderBy('date', 'desc').limit(500).get(),
        db.collection('users').get(),
      ]);

      const usernames = new Set(usersSnap.docs.map((d) => d.id));
      const issues: { workoutId: string; issue: string; severity: 'warning' | 'error' }[] = [];
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      for (const d of workoutsSnap.docs) {
        const w = d.data() as WorkoutDoc;
        const id = d.id;

        if (!w.name) issues.push({ workoutId: id, issue: 'Missing name', severity: 'error' });
        if (!w.type) issues.push({ workoutId: id, issue: 'Missing type', severity: 'error' });
        if (!w.assignedTo) issues.push({ workoutId: id, issue: 'Missing assignedTo', severity: 'error' });
        if (!w.createdBy) issues.push({ workoutId: id, issue: 'Missing createdBy', severity: 'warning' });
        if (!w.date) issues.push({ workoutId: id, issue: 'Missing date', severity: 'error' });

        // Orphaned assignment
        if (typeof w.assignedTo === 'string' && w.assignedTo && !usernames.has(w.assignedTo)) {
          issues.push({ workoutId: id, issue: `assignedTo user "${w.assignedTo}" does not exist`, severity: 'warning' });
        }

        // No type-specific data
        const type = toOptionalString(w.type);
        if (type && !['other', null].includes(type)) {
          if (!w[type]) {
            issues.push({ workoutId: id, issue: `type="${type}" but no ${type} data object present`, severity: 'warning' });
          }
        }

        // Old pending workouts
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

  return server;
}

// ─── Request handler ──────────────────────────────────────────────────────────

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  // If MCP_SECRET is set, require a valid Bearer token or x-api-key header.
  // If MCP_SECRET is not set, allow unauthenticated access.
  const secret = process.env.MCP_SECRET;
  if (secret) {
    const apiKey = getApiKeyFromRequest(request);
    if (!isAuthorizedApiKey(apiKey, secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const server = createMcpServer();
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
