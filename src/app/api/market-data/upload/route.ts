/* ============================================
   TradingBook — Market Data Upload API Route
   ============================================
   POST /api/market-data/upload

   Receives a FormData upload with:
     - file:     The CSV file
     - symbol:   e.g. "XAUUSD"
     - filename: e.g. "2026_06.csv"

   Validates the CSV, creates the directory if
   needed, and saves the file to disk.
   ============================================ */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { parseHistDataCSVStream } from '@/lib/csv-parser';

// ---------- Constants ----------

/** Maximum upload size: 500 MB (HistData M1 yearly files can be ~100 MB+). */
const MAX_FILE_SIZE = 500 * 1024 * 1024;

/** Allowed filename pattern: YYYY.csv or YYYY_MM.csv */
const FILENAME_PATTERN = /^\d{4}(_\d{2})?\.csv$/;

/**
 * Resolve the data directory for a given symbol.
 */
function getDataDir(symbol: string): string {
  return path.join(process.cwd(), 'data', 'histdata', symbol.toLowerCase());
}

// ---------- Validation ----------

/**
 * Validate CSV content by parsing the first N lines.
 * Returns the count of successfully parsed candles from the sample.
 */
function validateCSVContent(
  text: string,
  sampleSize: number = 10
): { valid: boolean; parsedCount: number; totalSampleLines: number; error?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { valid: false, parsedCount: 0, totalSampleLines: 0, error: 'File is empty.' };
  }

  const sampleLines = lines.slice(0, sampleSize);
  const candles = parseHistDataCSVStream(sampleLines);

  if (candles.length === 0) {
    return {
      valid: false,
      parsedCount: 0,
      totalSampleLines: sampleLines.length,
      error: `Could not parse any candle data from the first ${sampleLines.length} lines. Check the CSV format.`,
    };
  }

  // Consider valid if at least 50% of sample lines parsed successfully
  const parseRatio = candles.length / sampleLines.length;
  if (parseRatio < 0.5) {
    return {
      valid: false,
      parsedCount: candles.length,
      totalSampleLines: sampleLines.length,
      error: `Only ${candles.length}/${sampleLines.length} sample lines could be parsed. The file may have an unsupported format.`,
    };
  }

  return { valid: true, parsedCount: candles.length, totalSampleLines: sampleLines.length };
}

// ---------- Route Handler ----------

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Expected multipart/form-data request.' },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    // --- Extract fields ---
    const file = formData.get('file');
    const symbol = formData.get('symbol') as string | null;
    const filename = formData.get('filename') as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: file' },
        { status: 400 }
      );
    }

    if (!symbol || symbol.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: symbol' },
        { status: 400 }
      );
    }

    if (!filename || filename.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: filename' },
        { status: 400 }
      );
    }

    // --- Sanitize inputs ---
    const sanitizedSymbol = symbol.trim().replace(/[^a-zA-Z0-9]/g, '');
    const sanitizedFilename = filename.trim();

    if (!FILENAME_PATTERN.test(sanitizedFilename)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid filename "${sanitizedFilename}". Expected format: YYYY.csv or YYYY_MM.csv (e.g., "2023.csv" or "2026_06.csv").`,
        },
        { status: 400 }
      );
    }

    // --- Check file size ---
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        },
        { status: 400 }
      );
    }

    // --- Read file content ---
    const text = await file.text();

    // --- Validate CSV content ---
    const validation = validateCSVContent(text);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // --- Ensure data directory exists ---
    const dataDir = getDataDir(sanitizedSymbol);
    fs.mkdirSync(dataDir, { recursive: true });

    // --- Write file ---
    const filePath = path.join(dataDir, sanitizedFilename);
    fs.writeFileSync(filePath, text, 'utf-8');

    // --- Count total lines for metadata ---
    const totalLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;

    return NextResponse.json({
      success: true,
      data: {
        symbol: sanitizedSymbol.toUpperCase(),
        filename: sanitizedFilename,
        path: `data/histdata/${sanitizedSymbol.toLowerCase()}/${sanitizedFilename}`,
        sizeBytes: file.size,
        sizeMB: parseFloat((file.size / 1024 / 1024).toFixed(2)),
        totalLines,
        validation: {
          sampleLinesParsed: validation.parsedCount,
          sampleLinesTotal: validation.totalSampleLines,
        },
      },
    });
  } catch (err) {
    console.error('[market-data/upload] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while uploading file.' },
      { status: 500 }
    );
  }
}
