import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { RawRow } from './types';

const MAX_ROWS = 500;

export interface ParseResult {
  headers: string[];
  rows: RawRow[];
  sheetName?: string;
  totalRowsInFile: number;
  truncated: boolean;
}

export async function parseFile(buffer: Buffer, filename: string): Promise<ParseResult> {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'csv' || ext === 'tsv') {
    return parseCSV(buffer, ext === 'tsv' ? '\t' : undefined);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseXLSX(buffer);
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

function parseXLSX(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });

  // Pick best sheet
  const preferredNames = ['workouts', 'log', 'history', 'training', 'activities'];
  let sheetName = workbook.SheetNames.find(
    (n) => preferredNames.includes(n.toLowerCase())
  ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error('No data found in spreadsheet');

  // Get raw 2D array
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  // Find header row (first row with 3+ non-empty text cells)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const textCells = (rawData[i] || []).filter(
      (c: any) => typeof c === 'string' && c.trim().length > 0
    );
    if (textCells.length >= 3) {
      headerIdx = i;
      break;
    }
  }

  const headers = (rawData[headerIdx] || []).map((h: any) => String(h || '').trim()).filter(Boolean);
  if (headers.length === 0) throw new Error('Could not find column headers');

  const dataRows = rawData.slice(headerIdx + 1);
  const totalRowsInFile = dataRows.length;

  const rows: RawRow[] = [];
  for (let i = 0; i < Math.min(dataRows.length, MAX_ROWS); i++) {
    const row = dataRows[i];
    if (!row || row.every((c: any) => !c || String(c).trim() === '')) continue; // skip empty

    const obj: RawRow = {};
    headers.forEach((h, j) => {
      const val = row[j];
      obj[h] = val !== undefined && val !== '' ? String(val).trim() : null;
    });
    rows.push(obj);
  }

  return {
    headers,
    rows,
    sheetName,
    totalRowsInFile,
    truncated: totalRowsInFile > MAX_ROWS,
  };
}

function parseCSV(buffer: Buffer, delimiter?: string): ParseResult {
  // Strip BOM
  let text = buffer.toString('utf-8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  // Auto-detect delimiter if not given
  if (!delimiter) {
    const firstLines = text.split('\n').slice(0, 5).join('\n');
    const commas = (firstLines.match(/,/g) || []).length;
    const semicolons = (firstLines.match(/;/g) || []).length;
    const tabs = (firstLines.match(/\t/g) || []).length;
    if (tabs > commas && tabs > semicolons) delimiter = '\t';
    else if (semicolons > commas) delimiter = ';';
    else delimiter = ',';
  }

  const result = Papa.parse(text, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
    delimiter,
    transformHeader: (h: string) => h.trim(),
  });

  if (!result.data || result.data.length === 0) throw new Error('No data found in CSV');

  const headers = result.meta.fields?.filter(Boolean) || [];
  if (headers.length === 0) throw new Error('Could not find column headers');

  const allRows = result.data as Record<string, any>[];
  const totalRowsInFile = allRows.length;

  // Sanitize: strip formula injection prefixes
  const rows: RawRow[] = [];
  for (let i = 0; i < Math.min(allRows.length, MAX_ROWS); i++) {
    const raw = allRows[i];
    const obj: RawRow = {};
    let hasData = false;
    for (const h of headers) {
      let val = raw[h];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        val = String(val).trim();
        // Strip formula injection
        if (/^[=+\-@]/.test(val)) val = val.replace(/^[=+\-@]+/, '');
        obj[h] = val;
        hasData = true;
      } else {
        obj[h] = null;
      }
    }
    if (hasData) rows.push(obj);
  }

  return {
    headers,
    rows,
    totalRowsInFile,
    truncated: totalRowsInFile > MAX_ROWS,
  };
}
