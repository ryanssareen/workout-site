export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import Groq from 'groq-sdk';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const MAX_ROWS = 500;
const MAX_WORKOUTS = 200;

type WorkoutType = 'swim' | 'run' | 'bike' | 'strength' | 'other';

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
    return result.data.slice(0, MAX_ROWS + 1); // +1 for header
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
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
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
    const dataRows = rows.slice(1).filter(row => row.some(cell => cell?.toString().trim()));

    if (dataRows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows found in file' },
        { status: 400 }
      );
    }

    console.log(`📁 Parsed ${dataRows.length} rows from ${file.name}`);
    console.log(`📋 Columns: ${header.join(', ')}`);

    // Send to Groq for analysis
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'AI analysis not available (missing API key)' },
        { status: 500 }
      );
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });

    // Build data strings for AI
    const fullDataStr = [header, ...dataRows]
      .map(row => row.map(cell => String(cell ?? '').trim()).join(' | '))
      .join('\n');

    // For large files, send sample + instruction to process all
    const sampleRows = dataRows.length <= 20
      ? dataRows
      : [...dataRows.slice(0, 15), ...dataRows.slice(-5)];

    const sampleData = [header, ...sampleRows]
      .map(row => row.map(cell => String(cell ?? '').trim()).join(' | '))
      .join('\n');

    const useFullData = dataRows.length <= 100;

    const dateGuidance = `
CRITICAL DATE RULES — READ CAREFULLY:
- You MUST extract the date from the ACTUAL cell values in the data. Every date must come from text that is literally present in the row.
- NEVER fabricate, guess, or infer dates. If a row has no date value in any cell, SKIP that row entirely — do NOT include it.
- Dates may appear in various formats: "2024-01-15", "Jan 15, 2024", "15/01/2024", "1/15/24", "Monday, January 15", etc.
- Dates might be in a dedicated "Date" column OR embedded in another cell (e.g. "Mon 15 Jan" in a description).
- If dates only have month/day but no year, use the current year (2026) or the most recent past occurrence.
- If dates appear as "DD/MM/YYYY" (common outside US), parse accordingly — look at the values to determine format.
- ABSOLUTELY DO NOT spread workouts evenly across months or assign sequential dates. Use ONLY the dates you find in the data.
- In the summary field, mention which column(s) you found dates in so we can verify.`;

    const extractionRules = `For each row, extract:
- name: workout name/title (use activity type if no name column exists)
- type: MUST be one of: "run", "bike", "swim", "strength", "other"
  Mapping guide: Running/Jogging/Walk→run, Cycling/Biking/Spinning→bike, Swimming/Pool→swim, Weight Training/Gym/CrossFit/Yoga/HIIT→strength, anything else→other
- date: ISO 8601 date string (YYYY-MM-DDTHH:mm:ss). MUST come from actual data in the row — see date rules above.
- duration: in minutes (convert from hours/seconds if needed)
- distance: in km (convert from miles/meters if needed. 1 mile = 1.60934 km, 1 meter = 0.001 km)
- calories: number (optional)
- avgHeartRate: number (optional)
- elevationGain: in meters (optional)
- description: any notes/comments text (optional)

OUTPUT RULES:
1. Return ONLY a JSON object: {"workouts": [...], "summary": "..."}
2. The "workouts" array must contain objects for each data row that has a valid date
3. If a field is missing/empty, omit it from the object
4. SKIP any row where no date can be found in the cell values — do NOT make one up
5. For distances: if the unit column says miles, convert to km. If meters, convert to km.
6. Do NOT include header rows or empty rows as workouts
7. If the file appears to be a Strava/Garmin/Apple Health export, use domain knowledge to map columns
8. In "summary", state which column(s) contained dates and the date range found`;

    const dataBlock = useFullData
      ? `FULL DATA (${dataRows.length} rows):\n${fullDataStr}`
      : `DATA SAMPLE (${sampleRows.length} of ${dataRows.length} rows):\n${sampleData}\n\nProcess ALL ${dataRows.length} rows, not just this sample.`;

    const userPrompt = `Analyze this workout data and extract structured workouts.

COLUMNS: ${header.map((h, i) => `[${i}] "${h}"`).join(', ')}

${dataBlock}

${dateGuidance}

${extractionRules}`;

    const messages = [
      {
        role: 'system' as const,
        content: 'You are an expert fitness data analyst. Parse workout CSV/spreadsheet data into structured JSON. Return valid JSON only. CRITICAL: Every date you output MUST come from actual text in the input data cells. Never fabricate dates.',
      },
      {
        role: 'user' as const,
        content: userPrompt,
      },
    ];

    // Try primary model, fall back to smaller model on rate limit
    const MODELS = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ];

    let response = '{}';
    let modelUsed = '';

    for (const model of MODELS) {
      try {
        console.log(`🤖 Trying model: ${model}`);
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
          console.warn(`⚠️ Rate limited on ${model}, trying next model...`);
          continue;
        }
        // Non-rate-limit error — throw immediately
        throw modelError;
      }
    }

    if (!modelUsed) {
      return NextResponse.json(
        { error: 'AI service is temporarily rate limited. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    console.log(`✅ Got response from ${modelUsed}`);
    let parsed: { workouts?: ParsedWorkout[]; summary?: string };

    try {
      parsed = JSON.parse(response);
    } catch {
      console.error('Failed to parse Groq response:', response.substring(0, 500));
      return NextResponse.json(
        { error: 'AI could not parse the file format. Please ensure it has clear column headers.' },
        { status: 422 }
      );
    }

    const workouts = (parsed.workouts || []).slice(0, MAX_WORKOUTS);
    const summary = parsed.summary || `Parsed ${workouts.length} workouts`;

    if (workouts.length === 0) {
      return NextResponse.json(
        { error: 'No valid workouts could be extracted from the file. Ensure the file has date, type, and workout data.' },
        { status: 422 }
      );
    }

    // Detect hallucinated dates: if all dates are on the same day-of-month
    // or perfectly evenly spaced, the AI likely fabricated them
    if (workouts.length >= 5) {
      const dates = workouts
        .map(w => w.date ? new Date(w.date) : null)
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

      if (dates.length >= 5) {
        // Check if all dates fall on just 1-2 days of the month (e.g., all on the 2nd or 3rd)
        const daysOfMonth = new Set(dates.map(d => d.getDate()));
        if (daysOfMonth.size <= 2 && dates.length > 4) {
          console.warn(`⚠️ Suspicious dates detected: all on day(s) ${[...daysOfMonth].join(',')} of month — likely AI hallucination`);
          return NextResponse.json(
            { error: 'The AI could not reliably extract dates from your file. Please ensure your file has a clear date column with actual dates (e.g., "2025-01-15" or "Jan 15, 2025"). Try re-uploading with dates in a recognizable format.' },
            { status: 422 }
          );
        }

        // Check if all dates are in a single year that's far from current year
        const years = new Set(dates.map(d => d.getFullYear()));
        const currentYear = new Date().getFullYear();
        if (years.size === 1) {
          const year = [...years][0];
          if (Math.abs(year - currentYear) > 3) {
            console.warn(`⚠️ Suspicious dates: all in year ${year}, current year is ${currentYear}`);
          }
        }
      }
    }

    // Validate and create workouts in Firestore
    const validTypes: WorkoutType[] = ['swim', 'run', 'bike', 'strength', 'other'];
    let created = 0;
    let skipped = 0;
    const batch = adminDb.batch();
    const workoutsRef = adminDb.collection('users').doc(username).collection('workouts');

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

      const workoutName = w.name || `${w.type.charAt(0).toUpperCase() + w.type.slice(1)} Workout`;

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

      if (w.duration && w.duration > 0) docData.duration = Math.round(w.duration);
      if (w.description) docData.description = w.description;
      if (w.notes) docData.description = w.notes;

      // Build actualStats for distance/duration/hr/calories matching
      const actualStats: Record<string, number> = {};
      if (w.distance && w.distance > 0) actualStats.distance = w.distance * 1000; // store in meters
      if (w.duration && w.duration > 0) actualStats.duration = w.duration * 60; // store in seconds
      if (w.calories && w.calories > 0) actualStats.calories = w.calories;
      if (w.avgHeartRate && w.avgHeartRate > 0) actualStats.avgHeartRate = w.avgHeartRate;
      if (w.elevationGain && w.elevationGain > 0) actualStats.elevationGain = w.elevationGain;
      if (Object.keys(actualStats).length > 0) docData.actualStats = actualStats;

      // Add type-specific sub-objects
      const distKm = w.distance || 0;
      const timeMin = w.duration || 0;

      if (w.type === 'run' && distKm > 0) {
        docData.run = {
          distance: Math.round(distKm * 100) / 100,
          distanceUnit: 'km',
          time: Math.round(timeMin),
          ...(w.elevationGain ? { elevationGain: Math.round(w.elevationGain) } : {}),
          ...(w.avgHeartRate ? { avgHeartRate: Math.round(w.avgHeartRate) } : {}),
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
          ...(w.elevationGain ? { elevationGain: Math.round(w.elevationGain) } : {}),
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
      batch.set(docRef, docData);
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

    console.log(`✅ Imported ${created} workouts for ${username} (${skipped} skipped)`);

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
