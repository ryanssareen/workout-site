export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import * as z from 'zod/v4';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';

const DEFAULT_WORKOUT_LIMIT = 20;
const MAX_WORKOUT_LIMIT = 50;

type WorkoutDoc = Record<string, unknown>;

interface SafeWorkout {
  id: string;
  name: string | null;
  type: string | null;
  date: string | null;
  completed: boolean;
  duration: number | null;
}

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
    if ('toDate' in value && typeof value.toDate === 'function') {
      const parsed = value.toDate();
      if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
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
  };
}

function isAuthorizedApiKey(candidate: string | null, expected: string): boolean {
  if (!candidate) {
    return false;
  }

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'workout-site-mcp',
    version: '1.0.0',
  });

  server.registerTool(
    'get_user_workouts',
    {
      title: 'Get User Workouts',
      description: 'Fetches recent workouts assigned to a single user ID.',
      inputSchema: {
        userId: z
          .string()
          .min(1)
          .max(128)
          .regex(/^[A-Za-z0-9_-]+$/, 'userId contains invalid characters'),
        limit: z.number().int().min(1).max(MAX_WORKOUT_LIMIT).default(DEFAULT_WORKOUT_LIMIT),
      },
    },
    async (input: { userId: string; limit?: number }) => {
      const { userId, limit = DEFAULT_WORKOUT_LIMIT } = input;

      // Safe query: fixed collection, equality filter, explicit ordering, and bounded limit.
      const snapshot = await getFirebaseAdminDb()
        .collection('workouts')
        .where('assignedTo', '==', userId)
        .orderBy('date', 'desc')
        .limit(limit)
        .get();

      const workouts = snapshot.docs.map((doc) =>
        toSafeWorkout(doc.id, doc.data() as WorkoutDoc)
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                userId,
                count: workouts.length,
                workouts,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Add additional `server.registerTool(...)` definitions here as needed.
  // Keep each new tool scoped to least-privilege reads/writes and strict input validation.
  return server;
}

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  // This endpoint is intentionally protected by MCP_SECRET + x-api-key.
  const secret = process.env.MCP_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Server is not configured: MCP_SECRET is missing.' },
      { status: 500 }
    );
  }

  const apiKey = request.headers.get('x-api-key');
  if (!isAuthorizedApiKey(apiKey, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
