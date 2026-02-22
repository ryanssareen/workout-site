import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { transformRows } from '@/lib/import/transformer';
import { validateWorkouts } from '@/lib/import/validator';
import { ColumnMapping, ValidatedWorkout, RawRow, SerializedWorkout, AnalysisResult } from '@/lib/import/types';
import * as admin from 'firebase-admin';

function serializeWorkouts(workouts: ValidatedWorkout[]): SerializedWorkout[] {
  return workouts.map(w => ({
    ...w,
    date: w.date instanceof Date ? w.date.toISOString() : String(w.date),
  }));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId, mappingOverrides } = body as {
      sessionId: string;
      userId: string;
      mappingOverrides: Partial<ColumnMapping>;
    };

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'Missing sessionId or userId' }, { status: 400 });
    }

    const db = getAdminDb();
    const sessionDoc = await db.collection('importSessions').doc(sessionId).get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session expired. Please re-upload your file.' }, { status: 404 });
    }

    const session = sessionDoc.data()!;
    if (session.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Parse stored data
    const rawRows: RawRow[] = JSON.parse(session.rawRows);
    const originalMapping: ColumnMapping = session.mapping;
    const headers: string[] = session.headers;

    // Merge overrides into original mapping
    const updatedMapping: ColumnMapping = {
      ...originalMapping,
      ...mappingOverrides,
      // Bump confidence since user confirmed
      confidence: Math.max(originalMapping.confidence, 0.85),
      assumptions: [
        ...originalMapping.assumptions,
        'Column mapping manually reviewed by user',
      ],
    };

    // Re-transform with updated mapping
    const transformed = transformRows(rawRows, updatedMapping);

    if (transformed.length === 0) {
      return NextResponse.json({
        error: 'No workouts could be parsed with this mapping. Try different column selections.',
      }, { status: 400 });
    }

    // Re-validate
    const validated = validateWorkouts(transformed);

    // Build summary
    const validWorkouts = validated.filter(w => w.status !== 'error');
    const byType: Record<string, number> = {};
    validWorkouts.forEach(w => { byType[w.type] = (byType[w.type] || 0) + 1; });
    const dates = validWorkouts.map(w => w.date.getTime()).filter(Boolean);
    const dateRange = dates.length > 0
      ? { earliest: new Date(Math.min(...dates)).toISOString(), latest: new Date(Math.max(...dates)).toISOString() }
      : null;

    // Update session in Firestore
    await db.collection('importSessions').doc(sessionId).update({
      mapping: updatedMapping,
      workouts: JSON.stringify(serializeWorkouts(validated)),
    });

    const result: AnalysisResult = {
      sessionId,
      totalRows: rawRows.length,
      headers,
      mapping: updatedMapping,
      workouts: validated,
      summary: {
        valid: validated.filter(w => w.status === 'valid').length,
        warnings: validated.filter(w => w.status === 'warning').length,
        errors: validated.filter(w => w.status === 'error').length,
        duplicates: validated.filter(w => w.isDuplicate).length,
        byType,
        dateRange,
      },
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Import remap failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to re-analyze with new mapping' },
      { status: 500 }
    );
  }
}
