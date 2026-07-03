/* ============================================
   TradingBook — Market Data API Route
   ============================================
   GET /api/market-data
     ?symbol=XAUUSD&start=2023-01-01&end=2023-06-30&timeframe=15m
     → Returns aggregated candle data from local CSV files.

     ?action=info&symbol=XAUUSD
     → Returns metadata: date range, files, candle count.
   ============================================ */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { parseHistDataCSV } from '@/lib/csv-parser';
import { aggregateCandles } from '@/lib/aggregator';
import type { CandleData, Timeframe } from '@/types';

// ---------- Constants ----------

const VALID_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'];

/**
 * Resolve the data directory for a given symbol.
 * Files live at: <project-root>/data/histdata/<symbol>/
 */
function getDataDir(symbol: string): string {
  return path.join(process.cwd(), 'data', 'histdata', symbol.toLowerCase());
}

// ---------- File Discovery ----------

interface FileInfo {
  filename: string;
  /** Start of the period covered (UTC seconds). */
  periodStart: number;
  /** End of the period covered (UTC seconds). */
  periodEnd: number;
}

/**
 * Parse a CSV filename to determine the date range it covers.
 *
 * Supported patterns:
 *  - "2023.csv"     → Full year 2023
 *  - "2026_01.csv"  → January 2026
 *  - "2026_06.csv"  → June 2026
 */
function parseFilePeriod(filename: string, dir: string): FileInfo | null {
  const base = path.basename(filename, '.csv');

  // Monthly: YYYY_MM
  const monthMatch = base.match(/^(\d{4})_(\d{2})$/);
  if (monthMatch) {
    const year = parseInt(monthMatch[1], 10);
    const month = parseInt(monthMatch[2], 10); // 1-indexed

    const periodStart = Date.UTC(year, month - 1, 1) / 1000;
    // End = start of next month
    const periodEnd = Date.UTC(year, month, 1) / 1000 - 1;

    return { filename, periodStart, periodEnd };
  }

  // Yearly: YYYY
  const yearMatch = base.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);

    const periodStart = Date.UTC(year, 0, 1) / 1000;
    const periodEnd = Date.UTC(year + 1, 0, 1) / 1000 - 1;

    return { filename, periodStart, periodEnd };
  }

  // Fallback: Read first and last 5KB of file to parse timestamps
  const filePath = path.join(dir, filename);
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const size = stats.size;
      if (size > 0) {
        const fd = fs.openSync(filePath, 'r');
        
        // Read first 5KB
        const firstBuf = Buffer.alloc(Math.min(5000, size));
        fs.readSync(fd, firstBuf, 0, firstBuf.length, 0);
        const firstText = firstBuf.toString('utf-8');
        const firstCandles = parseHistDataCSV(firstText);

        // Read last 5KB
        const lastOffset = Math.max(0, size - 5000);
        const lastBuf = Buffer.alloc(size - lastOffset);
        fs.readSync(fd, lastBuf, 0, lastBuf.length, lastOffset);
        const lastText = lastBuf.toString('utf-8');
        const lastCandles = parseHistDataCSV(lastText);

        fs.closeSync(fd);

        if (firstCandles.length > 0 && lastCandles.length > 0) {
          return {
            filename,
            periodStart: firstCandles[0].time,
            periodEnd: lastCandles[lastCandles.length - 1].time
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[market-data] Failed to parse fallback period for ${filename}:`, err);
  }

  return null;
}

/**
 * List all CSV files in the symbol data directory, sorted by period start.
 */
const KNOWN_FILES: Record<string, string[]> = {
  xauusd: [
    '2015.csv', '2016.csv', '2017.csv', '2018.csv', '2019.csv',
    '2020.csv', '2021.csv', '2022.csv', '2023.csv', '2024.csv', '2025.csv',
    '2026_01.csv', '2026_02.csv', '2026_03.csv', '2026_06.csv'
  ]
};

function listDataFiles(symbol: string): FileInfo[] {
  const bucketUrl = process.env.MARKET_DATA_BUCKET_URL;

  if (bucketUrl) {
    const known = KNOWN_FILES[symbol.toLowerCase()] || [];
    const files: FileInfo[] = [];
    for (const filename of known) {
      const base = filename.replace('.csv', '');
      const monthMatch = base.match(/^(\d{4})_(\d{2})$/);
      if (monthMatch) {
        const year = parseInt(monthMatch[1], 10);
        const month = parseInt(monthMatch[2], 10);
        const periodStart = Date.UTC(year, month - 1, 1) / 1000;
        const periodEnd = Date.UTC(year, month, 1) / 1000 - 1;
        files.push({ filename, periodStart, periodEnd });
      } else {
        const yearMatch = base.match(/^(\d{4})$/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          const periodStart = Date.UTC(year, 0, 1) / 1000;
          const periodEnd = Date.UTC(year + 1, 0, 1) / 1000 - 1;
          files.push({ filename, periodStart, periodEnd });
        }
      }
    }
    files.sort((a, b) => a.periodStart - b.periodStart);
    return files;
  }

  const dir = getDataDir(symbol);
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir);
  const files: FileInfo[] = [];

  for (const entry of entries) {
    if (!entry.endsWith('.csv')) continue;
    const info = parseFilePeriod(entry, dir);
    if (info) files.push(info);
  }

  files.sort((a, b) => a.periodStart - b.periodStart);
  return files;
}

/**
 * Filter files that overlap with the requested date range.
 */
function filterFilesByRange(
  files: FileInfo[],
  startTimestamp: number,
  endTimestamp: number
): FileInfo[] {
  return files.filter(
    (f) => f.periodEnd >= startTimestamp && f.periodStart <= endTimestamp
  );
}

// ---------- Main Data Loading ----------

/**
 * Load and parse candles from the specified files,
 * filtering to the requested date range.
 */
async function loadCandles(
  symbol: string,
  files: FileInfo[],
  startTimestamp: number,
  endTimestamp: number,
  tzOffset: number = 0
): Promise<CandleData[]> {
  const bucketUrl = process.env.MARKET_DATA_BUCKET_URL;
  const allCandles: CandleData[] = [];

  for (const file of files) {
    try {
      let text = '';
      if (bucketUrl) {
        const fileUrl = `${bucketUrl}/${symbol.toLowerCase()}/${file.filename}`;
        console.log(`[market-data] Fetching remote file: ${fileUrl}`);
        const res = await fetch(fileUrl);
        if (!res.ok) {
          throw new Error(`HTTP status ${res.status}`);
        }
        text = await res.text();
      } else {
        const dir = getDataDir(symbol);
        const filePath = path.join(dir, file.filename);
        text = fs.readFileSync(filePath, 'utf-8');
      }

      const candles = parseHistDataCSV(text, tzOffset);

      // Filter to requested range
      for (const candle of candles) {
        if (candle.time >= startTimestamp && candle.time <= endTimestamp) {
          allCandles.push(candle);
        }
      }
    } catch (err) {
      console.warn(`[market-data] Failed to read ${file.filename}:`, err);
    }
  }

  // Sort across all files
  allCandles.sort((a, b) => a.time - b.time);
  return allCandles;
}

// ---------- Handlers ----------

/**
 * Handle `?action=info` — return metadata about available data for a symbol.
 */
function handleInfoRequest(symbol: string): NextResponse {
  const files = listDataFiles(symbol);

  if (files.length === 0) {
    return NextResponse.json(
      {
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          available: false,
          files: [],
          dateRange: null,
          estimatedCandles: 0,
        },
      },
      { status: 200 }
    );
  }

  const earliest = new Date(files[0].periodStart * 1000).toISOString().split('T')[0];
  const latest = new Date(files[files.length - 1].periodEnd * 1000).toISOString().split('T')[0];

  // Estimate candle count: ~1440 M1 candles/day × ~260 trading days/year per yearly file
  // This is a rough estimate; actual count depends on market hours.
  let estimatedCandles = 0;
  for (const file of files) {
    const daysInPeriod = (file.periodEnd - file.periodStart) / 86400;
    // ~1440 candles per trading day, ~5/7 of days are trading days
    estimatedCandles += Math.round(daysInPeriod * (5 / 7) * 1440);
  }

  return NextResponse.json({
    success: true,
    data: {
      symbol: symbol.toUpperCase(),
      available: true,
      files: files.map((f) => f.filename),
      dateRange: { earliest, latest },
      estimatedCandles,
    },
  });
}

/**
 * Handle standard data request — return aggregated candle data.
 */
async function handleDataRequest(
  symbol: string,
  startDate: string,
  endDate: string,
  timeframe: Timeframe,
  tzOffset: number = 0
): Promise<NextResponse> {
  // Parse dates
  const startTimestamp = Date.parse(startDate + 'T00:00:00Z') / 1000;
  const endTimestamp = Date.parse(endDate + 'T23:59:59Z') / 1000;

  if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
    return NextResponse.json(
      { success: false, error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400 }
    );
  }

  if (startTimestamp > endTimestamp) {
    return NextResponse.json(
      { success: false, error: 'Start date must be before end date.' },
      { status: 400 }
    );
  }

  // Find matching files
  const allFiles = listDataFiles(symbol);
  if (allFiles.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: `No data files found for symbol "${symbol.toUpperCase()}". Upload CSV files first.`,
      },
      { status: 404 }
    );
  }

  const matchingFiles = filterFilesByRange(allFiles, startTimestamp, endTimestamp);
  if (matchingFiles.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: `No data available for the requested date range (${startDate} to ${endDate}).`,
      },
      { status: 404 }
    );
  }

  // Load and aggregate
  const m1Candles = await loadCandles(symbol, matchingFiles, startTimestamp, endTimestamp, tzOffset);
  if (m1Candles.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: `The matching CSV file(s) contained no valid candles between ${startDate} and ${endDate}. Check the CSV date and OHLC format.`,
      },
      { status: 422 }
    );
  }

  const aggregated = aggregateCandles(m1Candles, timeframe);

  return NextResponse.json({
    success: true,
    data: aggregated,
    meta: {
      symbol: symbol.toUpperCase(),
      timeframe,
      start: startDate,
      end: endDate,
      count: aggregated.length,
      m1Count: m1Candles.length,
      filesUsed: matchingFiles.map((f) => f.filename),
    },
  });
}

// ---------- Route Handler ----------

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    // Check for info action
    const action = searchParams.get('action');
    const symbol = searchParams.get('symbol');

    if (!symbol || symbol.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: symbol' },
        { status: 400 }
      );
    }

    const sanitizedSymbol = symbol.trim().replace(/[^a-zA-Z0-9]/g, '');

    if (action === 'info') {
      return handleInfoRequest(sanitizedSymbol);
    }

    // Standard data request
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const timeframe = searchParams.get('timeframe') as Timeframe | null;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameters: start, end' },
        { status: 400 }
      );
    }

    if (!timeframe || !VALID_TIMEFRAMES.includes(timeframe)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid timeframe "${timeframe}". Valid values: ${VALID_TIMEFRAMES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const tzOffsetStr = searchParams.get('tzOffset');
    const tzOffset = tzOffsetStr ? parseInt(tzOffsetStr, 10) : 0;

    return await handleDataRequest(sanitizedSymbol, startDate, endDate, timeframe, tzOffset);
  } catch (err) {
    console.error('[market-data] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while processing market data request.' },
      { status: 500 }
    );
  }
}
