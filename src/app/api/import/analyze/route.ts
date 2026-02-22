import { NextRequest, NextResponse } from 'next/server';
import { parseFile } from '@/lib/import/parser';
import { mapColumns } from '@/lib/import/mapper';
import { transformRows } from '@/lib/import/transformer';
import { validateWorkouts } from '@/lib/import/validator';
import { AnalysisResult, ValidatedWorkout } from '@/lib/import/types';
import { randomUUID } from 'crypto';

// In-memory session cache (short-lived, for analyze → confirm flow)
// In production you'd use Redis or Firestore temp collection
const sessionCache = new Map<string, { workouts: ValidatedWorkout[]; userId: string; expiresAt: number }>();

// Clean expired sessions
function cleanSessions() {
  const now = Date.now();
  for (const [id, session] of sessionCache) {
    if (session.expiresAt < now) sessionCache.delete(id);
  }
}

export { sessionCache };

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  'text/csv',
  'text/tab-separated-values',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // some browsers send this for xlsx
];

export async function POST(request: NextRequest) {
  try {
    cleanSessions();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    // Validate file
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['csv', 'tsv', 'xlsx', 'xls'].includes(ext || '')) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a CSV or XLSX file.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFile(buffer, file.name);

    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found in file. Check that your spreadsheet has data below the headers.' }, { status: 400 });
    }

    // AI column mapping (single Groq call)
    const sampleRows = parsed.rows.slice(0, 5);
    const mapping = await mapColumns(parsed.headers, sampleRows);

    // Transform all rows using the mapping
    const transformed = transformRows(parsed.rows, mapping);

    if (transformed.length === 0) {
      return NextResponse.json({
        error: 'Could not parse any workouts from this file. Make sure it has at least a date column.',
        mapping,
      }, { status: 400 });
    }

    // Validate
    const validated = validateWorkouts(transformed);

    // Build summary
    const validWorkouts = validated.filter(w => w.status !== 'error');
    const byType: Record<string, number> = {};
    validWorkouts.forEach(w => {
      byType[w.type] = (byType[w.type] || 0) + 1;
    });

    const dates = validWorkouts.map(w => w.date.getTime()).filter(Boolean);
    const dateRange = dates.length > 0
      ? { earliest: new Date(Math.min(...dates)).toISOString(), latest: new Date(Math.max(...dates)).toISOString() }
      : null;

    // Store in session cache (1 hour TTL)
    const sessionId = randomUUID();
    sessionCache.set(sessionId, {
      workouts: validated,
      userId,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    const result: AnalysisResult = {
      sessionId,
      totalRows: parsed.totalRowsInFile,
      mapping,
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
    console.error('Import analysis failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze file' },
      { status: 500 }
    );
  }
}
