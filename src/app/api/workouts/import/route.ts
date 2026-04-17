export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import Groq from 'groq-sdk';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { buildCreateSummaryFields } from '@/lib/training/summary';

const MAX_ROWS = 500;
const MAX_WORKOUTS = 200;

type WorkoutType = 'swim' | 'run' | 'walk' | 'bike' | 'strength' | 'other';

interface ParsedWorkout {
  name: string;
  type: WorkoutType;
  date: string; // ISO string
  duration?: number; // minutes
  distance?: number; // km
  distanceUnit?: string;
  description?: string;
  calories?: number;
  avgHeartRate?: number;
  elevationGain?: number;
  notes?: string;
  rowIndex?: number; // Maps back to source data row
}

// ── Date detection & parsing ──
// We parse dates ourselves instead of relying on AI (which hallucinates dates)

const DATE_PATTERNS = [
  /^\d{4}-\d{1,2}-\d{1,2}/, // ISO: 2025-01-15
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // Slash: 1/15/2025, 15/01/2025
  /^\d{1,2}-\d{1,2}-\d{2,4}$/, // Dash: 1-15-2025, 15-01-2025
  /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/, // Text: Jan 15, 2025
  /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/, // 15 Jan 2025
  /^[A-Za-z]+,?\s+[A-Za-z]{3,9}\s+\d{1,2}/, // Monday, January 15
  /^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/, // 15-Jan-2025
  /^\d{1,2}\.\d{1,2}\.\d{2,4}$/, // 15.01.2025
];

function looksLikeDate(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 4) return false;
  return DATE_PATTERNS.some((p) => p.test(trimmed));
}

/** Detect if numeric dates in a column use DD/MM or MM/DD ordering */
function detectSlashDateFormat(values: string[]): 'dd/mm' | 'mm/dd' {
  let hasFirstGt12 = false;
  let hasSecondGt12 = false;

  for (const val of values) {
    const match = val
      .trim()
      .match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (match) {
      const first = parseInt(match[1]);
      const second = parseInt(match[2]);
      if (first > 12) hasFirstGt12 = true;
      if (second > 12) hasSecondGt12 = true;
    }
  }

  // If first number exceeds 12 somewhere, it must be the day → DD/MM
  if (hasFirstGt12 && !hasSecondGt12) return 'dd/mm';
  if (hasSecondGt12 && !hasFirstGt12) return 'mm/dd';

  // All ambiguous — default to DD/MM (more common globally)
  return 'dd/mm';
}

/** Parse a date string with a known format hint for numeric dates */
function tryParseDateWithFormat(
  value: string,
  format: 'dd/mm' | 'mm/dd'
): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // ISO format first: 2025-01-15
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (
      !isNaN(d.getTime()) &&
      d.getFullYear() >= 2000 &&
      d.getFullYear() <= 2030
    ) {
      return d;
    }
  }

  // Numeric slash/dash/dot separated: 02/02/26, 15-01-2025, 1.5.2025
  const match = trimmed.match(
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/
  );
  if (match) {
    const [, a, b, yearStr] = match;
    let year = parseInt(yearStr);
    if (year < 100) year += 2000;

    let day: number, month: number;
    if (format === 'dd/mm') {
      day = parseInt(a);
      month = parseInt(b);
    } else {
      month = parseInt(a);
      day = parseInt(b);
    }

    if (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      year >= 2000 &&
      year <= 2030
    ) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Text format: "Jan 15, 2025", "15 Jan 2025", "Monday, January 15"
  const d = new Date(trimmed);
  if (
    !isNaN(d.getTime()) &&
    d.getFullYear() >= 2000 &&
    d.getFullYear() <= 2030
  ) {
    return d;
  }

  return null;
}

interface DateDetectionResult {
  columnIndex: number;
  columnName: string;
  dates: (Date | null)[]; // one per data row
  coverage: number; // fraction of rows with a valid date
}

function detectDateColumn(
  header: string[],
  dataRows: string[][]
): DateDetectionResult | null {
  const candidates: DateDetectionResult[] = [];

  for (let col = 0; col < header.length; col++) {
    const colName = String(header[col] || '').toLowerCase();
    // Collect all non-empty values for format detection
    const values = dataRows
      .map((row) => String(row[col] ?? '').trim())
      .filter((v) => v);

    // Detect numeric date format for this column
    const format = detectSlashDateFormat(values);

    let dateCount = 0;
    const dates: (Date | null)[] = [];

    for (const row of dataRows) {
      const cell = String(row[col] ?? '').trim();
      if (!cell) {
        dates.push(null);
        continue;
      }

      const parsed = tryParseDateWithFormat(cell, format);
      if (parsed) {
        dateCount++;
        dates.push(parsed);
      } else if (looksLikeDate(cell)) {
        dateCount += 0.5;
        dates.push(null);
      } else {
        dates.push(null);
      }
    }

    const coverage = dateCount / dataRows.length;
    const nameBoost = /date|day|when|time|datum/i.test(colName) ? 0.3 : 0;

    if (coverage + nameBoost >= 0.3) {
      candidates.push({
        columnIndex: col,
        columnName: header[col] || `Column ${col}`,
        dates,
        coverage,
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aBonus = /date|day|when|time|datum/i.test(a.columnName) ? 0.3 : 0;
    const bBonus = /date|day|when|time|datum/i.test(b.columnName) ? 0.3 : 0;
    return b.coverage + bBonus - (a.coverage + aBonus);
  });

  return candidates[0];
}

// Parse uploaded file into raw rows
function parseFile(buffer: Buffer, filename: string): string[][] {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'csv' || ext === 'tsv') {
    const text = buffer.toString('utf-8');
    const result = Papa.parse<string[]>(text, {
      skipEmptyLines: true,
      header: false,
    });
    return result.data.slice(0, MAX_ROWS + 1);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    return rows.slice(0, MAX_ROWS + 1);
  }

  throw new Error('Unsupported file format. Please upload a CSV or XLSX file.');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const username = formData.get('username') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Verify user exists
    const userDoc = await adminDb.collection('users').doc(username).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseFile(buffer, file.name);

    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'File appears to be empty or has no data rows' },
        { status: 400 }
      );
    }

    const header = rows[0];
    const dataRows = rows
      .slice(1)
      .filter((row) => row.some((cell) => cell?.toString().trim()));

    if (dataRows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows found in file' },
        { status: 400 }
      );
    }

    console.log(`📁 Parsed ${dataRows.length} rows from ${file.name}`);
    console.log(`📋 Columns: ${header.join(', ')}`);

    // ── Programmatic date detection ──
    // Detect and parse dates ourselves — AI hallucinates dates
    const dateDetection = detectDateColumn(header, dataRows);
    const preParsedDates: Map<number, string> = new Map(); // row index → ISO date

    if (dateDetection) {
      console.log(
        `📅 Detected date column: "${dateDetection.columnName}" (col ${dateDetection.columnIndex}) — ${Math.round(dateDetection.coverage * 100)}% coverage`
      );

      // Replace raw date values with clean ISO strings
      for (let i = 0; i < dataRows.length; i++) {
        const parsedDate = dateDetection.dates[i];
        if (parsedDate) {
          const isoStr = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD
          dataRows[i] = [...dataRows[i]]; // clone row
          dataRows[i][dateDetection.columnIndex] = isoStr;
          preParsedDates.set(i, isoStr);
        }
      }

      console.log(
        `📅 Pre-parsed ${preParsedDates.size} dates (${dataRows.length - preParsedDates.size} rows without dates)`
      );
    } else {
      console.log(
        '⚠️ No date column detected — AI will attempt date extraction'
      );
    }

    // Send to Groq for analysis
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'AI analysis not available (missing API key)' },
        { status: 500 }
      );
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

    // Add row indices to data for cross-referencing AI output back to source rows
    const indexedHeader = ['ROW#', ...header];
    const indexedDataRows = dataRows.map((row, i) => [String(i + 1), ...row]);

    // Build data strings for AI
    const fullDataStr = [indexedHeader, ...indexedDataRows]
      .map((row) =>
        row
          .map((cell) => String(cell ?? '').trim())
          .join(' | ')
      )
      .join('\n');

    // For large files, send sample + instruction to process all
    const sampleRows =
      indexedDataRows.length <= 20
        ? indexedDataRows
        : [...indexedDataRows.slice(0, 15), ...indexedDataRows.slice(-5)];

    const sampleData = [indexedHeader, ...sampleRows]
      .map((row) =>
        row
          .map((cell) => String(cell ?? '').trim())
          .join(' | ')
      )
      .join('\n');

    const useFullData = dataRows.length <= 100;

    // Date guidance depends on whether we pre-parsed dates
    const dateGuidance = dateDetection
      ? `DATE HANDLING: The "${dateDetection.columnName}" column already contains dates in ISO format (YYYY-MM-DD). Use these dates EXACTLY as-is — do NOT modify, reformat, or reinterpret them. Just copy the date value from the data row into the output "date" field. Include the ROW# as "rowIndex" in each output object so we can cross-reference.`
      : `CRITICAL DATE RULES:
- Extract dates from the ACTUAL cell values. NEVER fabricate dates.
- If a row has no date, SKIP it entirely.
- Include the ROW# as "rowIndex" in each output object.`;

    const extractionRules = `For each data row, extract:
- rowIndex: the ROW# from the first column (REQUIRED — we use this to validate)
- name: workout name/title (use activity type if no name)
- type: MUST be one of: "run", "walk", "bike", "swim", "strength", "other"
  Mapping: Running/Jogging→run, Walk/Hike→walk, Cycling/Biking/Spinning→bike, Swimming/Pool→swim, Weight Training/Gym/CrossFit/Yoga/HIIT→strength, anything else→other
- date: ISO 8601 date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)${dateDetection ? ' — copy from data directly' : ''}
- duration: minutes (convert from hours/seconds if needed)
- distance: km (convert from miles/meters if needed)
- calories, avgHeartRate, elevationGain: numbers (optional)
- description: notes/comments (optional, keep brief)

OUTPUT: Return ONLY a JSON object: {"workouts": [...], "summary": "..."}
- Each workout must have rowIndex, name, type, and date
- Omit missing/empty fields
- SKIP header rows, empty rows, and summary/total rows
- SKIP rows with status like "Skipped" or "Not done" — only include completed workouts`;

    const dataBlock = useFullData
      ? `FULL DATA (${dataRows.length} rows):\n${fullDataStr}`
      : `DATA SAMPLE (${sampleRows.length} of ${dataRows.length} rows):\n${sampleData}\n\nProcess ALL ${dataRows.length} rows, not just this sample.`;

    const userPrompt = `Analyze this workout data and extract structured workouts.

COLUMNS: ${indexedHeader.map((h, i) => `[${i}] "${h}"`).join(', ')}

${dataBlock}

${dateGuidance}

${extractionRules}`;

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are an expert fitness data analyst. Parse workout CSV/spreadsheet data into structured JSON. Return valid JSON only. Include rowIndex from the ROW# column in every workout object.',
      },
      {
        role: 'user' as const,
        content: userPrompt,
      },
    ];

    // Try primary model, fall back to smaller models on rate limit.
    // Includes retry with delay to handle transient 429s.
    const MODELS = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma2-9b-it',
    ];

    let response = '{}';
    let modelUsed = '';

    for (const model of MODELS) {
      // Try each model up to 2 times with a delay on 429
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`🤖 Trying model: ${model} (attempt ${attempt + 1})`);
          const completion = await groq.chat.completions.create({
            model,
            messages,
            temperature: 0,
            max_tokens: 8000,
            response_format: { type: 'json_object' },
          });
          response = completion.choices[0]?.message?.content || '{}';
          modelUsed = model;
          break;
        } catch (modelError: any) {
          const status = modelError?.status || modelError?.statusCode;
          if (status === 429) {
            if (attempt === 0) {
              console.warn(`⚠️ Rate limited on ${model}, retrying after 3s...`);
              await new Promise(r => setTimeout(r, 3000));
              continue;
            }
            console.warn(`⚠️ Rate limited on ${model} again, trying next model...`);
            break; // move to next model
          }
          throw modelError;
        }
      }
      if (modelUsed) break;
    }

    if (!modelUsed) {
      return NextResponse.json(
        {
          error:
            'AI service is temporarily rate limited. Please try again in a few minutes.',
        },
        { status: 429 }
      );
    }

    console.log(`✅ Got response from ${modelUsed}`);
    let parsed: { workouts?: ParsedWorkout[]; summary?: string };

    try {
      parsed = JSON.parse(response);
    } catch {
      console.error(
        'Failed to parse Groq response:',
        response.substring(0, 500)
      );
      return NextResponse.json(
        {
          error:
            'AI could not parse the file format. Please ensure it has clear column headers.',
        },
        { status: 422 }
      );
    }

    const workouts = (parsed.workouts || []).slice(0, MAX_WORKOUTS);
    // Ensure summary is always a string (AI sometimes returns an object)
    const rawSummary = parsed.summary;
    const summary = typeof rawSummary === 'string'
      ? rawSummary
      : rawSummary && typeof rawSummary === 'object'
        ? Object.entries(rawSummary).map(([k, v]) => `${k}: ${v}`).join(', ')
        : `Parsed ${workouts.length} workouts`;

    if (workouts.length === 0) {
      return NextResponse.json(
        {
          error:
            'No valid workouts could be extracted from the file. Ensure the file has date, type, and workout data.',
        },
        { status: 422 }
      );
    }

    // ── Override AI dates with pre-parsed dates ──
    // AI often hallucinates dates, so we use our own programmatic parsing
    if (dateDetection && preParsedDates.size > 0) {
      let overridden = 0;
      let noRowIndex = 0;

      for (const w of workouts) {
        if (w.rowIndex && w.rowIndex >= 1) {
          const rowIdx = w.rowIndex - 1; // ROW# is 1-based, Map is 0-based
          const correctDate = preParsedDates.get(rowIdx);
          if (correctDate) {
            w.date = correctDate;
            overridden++;
          }
        } else {
          noRowIndex++;
        }
      }

      console.log(
        `📅 Overrode ${overridden}/${workouts.length} workout dates with pre-parsed values` +
          (noRowIndex > 0
            ? ` (${noRowIndex} missing rowIndex — using AI dates)`
            : '')
      );
    }

    // Validate and create workouts in Firestore
    const validTypes: WorkoutType[] = [
      'swim',
      'run',
      'bike',
      'strength',
      'other',
    ];
    let created = 0;
    let skipped = 0;
    const batch = adminDb.batch();
    const workoutsRef = adminDb
      .collection('users')
      .doc(username)
      .collection('workouts');

    for (const w of workouts) {
      // Validate required fields
      if (!w.date || !w.type || !validTypes.includes(w.type)) {
        skipped++;
        continue;
      }

      // Parse date
      let workoutDate: Date;
      try {
        workoutDate = new Date(w.date);
        if (isNaN(workoutDate.getTime())) {
          skipped++;
          continue;
        }
      } catch {
        skipped++;
        continue;
      }

      const workoutName =
        w.name ||
        `${w.type.charAt(0).toUpperCase() + w.type.slice(1)} Workout`;

      const docData: Record<string, unknown> = {
        name: workoutName,
        type: w.type,
        date: admin.firestore.Timestamp.fromDate(workoutDate),
        ownerUsername: username,
        createdBy: username,
        assignedTo: username,
        completed: true,
        completedAt: admin.firestore.Timestamp.fromDate(workoutDate),
        completedBy: 'manual',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'import',
      };

      if (w.duration && w.duration > 0)
        docData.duration = Math.round(w.duration);
      if (w.description) docData.description = w.description;
      if (w.notes) docData.description = w.notes;

      // Build actualStats for distance/duration/hr/calories
      const actualStats: Record<string, number> = {};
      if (w.distance && w.distance > 0)
        actualStats.distance = w.distance * 1000; // store in meters
      if (w.duration && w.duration > 0)
        actualStats.duration = w.duration * 60; // store in seconds
      if (w.calories && w.calories > 0) actualStats.calories = w.calories;
      if (w.avgHeartRate && w.avgHeartRate > 0)
        actualStats.avgHeartRate = w.avgHeartRate;
      if (w.elevationGain && w.elevationGain > 0)
        actualStats.elevationGain = w.elevationGain;
      if (Object.keys(actualStats).length > 0) docData.actualStats = actualStats;

      // Add type-specific sub-objects
      const distKm = w.distance || 0;
      const timeMin = w.duration || 0;

      if (w.type === 'run' && distKm > 0) {
        docData.run = {
          distance: Math.round(distKm * 100) / 100,
          distanceUnit: 'km',
          time: Math.round(timeMin),
          ...(w.elevationGain
            ? { elevationGain: Math.round(w.elevationGain) }
            : {}),
          ...(w.avgHeartRate
            ? { avgHeartRate: Math.round(w.avgHeartRate) }
            : {}),
          ...(distKm > 0 && timeMin > 0
            ? {
                pace: `${Math.floor(timeMin / distKm)}:${String(Math.round(((timeMin / distKm) % 1) * 60)).padStart(2, '0')}/km`,
              }
            : {}),
        };
      } else if (w.type === 'bike' && distKm > 0) {
        docData.bike = {
          distance: Math.round(distKm * 100) / 100,
          distanceUnit: 'km',
          time: Math.round(timeMin),
          ...(w.elevationGain
            ? { elevationGain: Math.round(w.elevationGain) }
            : {}),
        };
      } else if (w.type === 'swim') {
        docData.swim = {
          distance: Math.round(distKm * 1000), // convert km back to meters
          distanceUnit: 'meters',
          time: Math.round(timeMin),
        };
      } else if (w.type === 'strength') {
        docData.strength = {
          totalTime: Math.round(timeMin),
        };
      } else if (w.type === 'other') {
        docData.other = {
          duration: Math.round(timeMin),
          description: w.description || w.notes || '',
        };
      }

      const docRef = workoutsRef.doc();
      batch.set(docRef, { ...docData, ...buildCreateSummaryFields(docData) });
      created++;

      // Firestore batches max at 500 writes
      if (created % 490 === 0) {
        await batch.commit();
      }
    }

    // Commit remaining
    if (created % 490 !== 0 || created === 0) {
      await batch.commit();
    }

    console.log(
      `✅ Imported ${created} workouts for ${username} (${skipped} skipped)`
    );

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: workouts.length,
      summary,
    });
  } catch (error: any) {
    console.error('Workout import error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import workouts' },
      { status: 500 }
    );
  }
}
