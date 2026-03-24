export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin';
import { verifyApiRequest, isVerifiedUser } from '@/lib/api-auth';

type UserRole = 'coach' | 'athlete' | 'student';
type WorkoutType = 'swim' | 'run' | 'walk' | 'bike' | 'strength' | 'other';

interface CreateWorkoutBody extends Record<string, unknown> {
  name?: unknown;
  type?: unknown;
  date?: unknown;
  createdBy?: unknown;
  assignedTo?: unknown;
  description?: unknown;
  duration?: unknown;
  tags?: unknown;
  source?: unknown;
  swim?: unknown;
  bike?: unknown;
  run?: unknown;
  strength?: unknown;
  other?: unknown;
}

const WORKOUT_TYPES = new Set<WorkoutType>(['swim', 'run', 'walk', 'bike', 'strength', 'other']);

function isWorkoutType(value: unknown): value is WorkoutType {
  return typeof value === 'string' && WORKOUT_TYPES.has(value as WorkoutType);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRole(role: string | null): UserRole | null {
  if (role === 'coach' || role === 'athlete' || role === 'student') {
    return role;
  }
  return null;
}

function toTimestamp(dateInput: unknown): admin.firestore.Timestamp | null {
  if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
    return admin.firestore.Timestamp.fromDate(dateInput);
  }

  if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    const parsedDate = new Date(dateInput);
    if (!Number.isNaN(parsedDate.getTime())) {
      return admin.firestore.Timestamp.fromDate(parsedDate);
    }
  }

  return null;
}

function toEpochMs(dateValue: unknown): number {
  if (!dateValue || typeof dateValue !== 'object') {
    return 0;
  }

  if ('toDate' in dateValue && typeof dateValue.toDate === 'function') {
    const maybeDate = dateValue.toDate();
    if (maybeDate instanceof Date) {
      return maybeDate.getTime();
    }
  }

  if ('seconds' in dateValue && typeof dateValue.seconds === 'number') {
    return dateValue.seconds * 1000;
  }

  return 0;
}

async function getCoachStudentUsernames(coachUsername: string): Promise<string[]> {
  const studentsSnapshot = await adminDb
    .collection('users')
    .where('coachUsername', '==', coachUsername)
    .get();

  return studentsSnapshot.docs.map((doc) => doc.id); // doc.id is username
}

function normalizeTagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  ).slice(0, 5);
}

/**
 * GET /api/workouts
 * Fetch workouts for the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the caller's identity
    const caller = await verifyApiRequest(request);
    if (!isVerifiedUser(caller)) return caller;

    const { searchParams } = new URL(request.url);
    // Use caller's username and role from verified token, not from query params
    const userId = searchParams.get('userId') || caller.username;
    const role = parseRole(searchParams.get('role')) || caller.role;

    // Non-coaches can only fetch their own workouts
    if (caller.role !== 'coach' && userId !== caller.username) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workoutsById = new Map<string, Record<string, unknown>>();

    if (role === 'coach') {
      const [coachCreatedSnapshot, studentUsernames] = await Promise.all([
        adminDb.collectionGroup('workouts').where('createdBy', '==', userId).get(),
        getCoachStudentUsernames(userId),
      ]);

      coachCreatedSnapshot.docs.forEach((doc) => {
        workoutsById.set(doc.id, { id: doc.id, ...doc.data() });
      });

      if (studentUsernames.length > 0) {
        for (let i = 0; i < studentUsernames.length; i += 10) {
          const batch = studentUsernames.slice(i, i + 10);
          const studentSnapshot = await adminDb
            .collectionGroup('workouts')
            .where('assignedTo', 'in', batch)
            .get();

          studentSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.source === 'strava') {
              workoutsById.set(doc.id, { id: doc.id, ...data });
            }
          });
        }
      }

      // Also query the coach's own subcollection for self-assigned workouts
      const coachOwnSnapshot = await adminDb
        .collection('users').doc(userId).collection('workouts')
        .get();

      coachOwnSnapshot.docs.forEach((doc) => {
        workoutsById.set(doc.id, { id: doc.id, ...doc.data() });
      });
    } else if (role === 'athlete' || role === 'student') {
      const athleteSnapshot = await adminDb
        .collection('users').doc(userId).collection('workouts')
        .get();

      athleteSnapshot.docs.forEach((doc) => {
        workoutsById.set(doc.id, { id: doc.id, ...doc.data() });
      });
    } else {
      const [createdSnapshot, assignedSnapshot] = await Promise.all([
        adminDb.collectionGroup('workouts').where('createdBy', '==', userId).get(),
        adminDb.collectionGroup('workouts').where('assignedTo', '==', userId).get(),
      ]);

      createdSnapshot.docs.forEach((doc) => {
        workoutsById.set(doc.id, { id: doc.id, ...doc.data() });
      });

      assignedSnapshot.docs.forEach((doc) => {
        workoutsById.set(doc.id, { id: doc.id, ...doc.data() });
      });
    }

    const workouts = Array.from(workoutsById.values()).sort(
      (a, b) => toEpochMs(b.date) - toEpochMs(a.date)
    );

    return NextResponse.json({
      workouts,
      total: workouts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch workouts';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workouts
 * Create new workout
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the caller's identity
    const caller = await verifyApiRequest(request);
    if (!isVerifiedUser(caller)) return caller;

    const body = (await request.json()) as CreateWorkoutBody;

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    // Use the verified caller's username as createdBy (don't trust client)
    const createdBy = caller.username;

    if (!name || !isWorkoutType(body.type)) {
      return NextResponse.json(
        { error: 'name and type are required' },
        { status: 400 }
      );
    }

    const assignedTo =
      typeof body.assignedTo === 'string' && body.assignedTo.trim()
        ? body.assignedTo.trim()
        : createdBy;

    // If assigning to another user, verify coach-athlete relationship
    if (assignedTo !== createdBy) {
      if (caller.role !== 'coach') {
        return NextResponse.json(
          { error: 'Only coaches can assign workouts to other users' },
          { status: 403 }
        );
      }
      // Verify the athlete is linked to this coach
      const athleteDoc = await adminDb.collection('users').doc(assignedTo).get();
      if (!athleteDoc.exists || athleteDoc.data()?.coachUsername !== createdBy) {
        return NextResponse.json(
          { error: 'Athlete is not linked to this coach' },
          { status: 403 }
        );
      }
    }

    const workoutData: Record<string, unknown> = {
      name,
      type: body.type,
      date: toTimestamp(body.date) ?? admin.firestore.Timestamp.fromDate(new Date()),
      createdBy,
      assignedTo,
      ownerUsername: assignedTo,
      completed: false,
      source: typeof body.source === 'string' ? body.source : 'manual',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (typeof body.description === 'string') {
      workoutData.description = body.description;
    }

    if (typeof body.duration === 'number' && Number.isFinite(body.duration)) {
      workoutData.duration = body.duration;
    }

    const tags = normalizeTagList(body.tags);
    if (tags.length > 0) {
      workoutData.tags = tags;
    }

    (['swim', 'bike', 'run', 'walk', 'strength', 'other'] as const).forEach((key) => {
      const value = body[key];
      if (isPlainObject(value)) {
        workoutData[key] = value;
      }
    });

    const createdRef = await adminDb.collection('users').doc(assignedTo).collection('workouts').add(workoutData);
    const createdDoc = await createdRef.get();

    return NextResponse.json({
      id: createdRef.id,
      ...createdDoc.data(),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create workout';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
