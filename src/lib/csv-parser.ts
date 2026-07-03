/* ============================================
   TradingBook — Robust CSV Parser
   ============================================
   Parses HistData or MT5 M1 CSV files into CandleData.
   ============================================ */

import type { CandleData } from '@/types';

// ---------- Date Parsing ----------

/**
 * Parse "YYYYMMDD HHMMSS" → UTC timestamp in seconds.
 */
function parseDateCompact(raw: string): number | null {
  if (raw.length < 15) return null;

  const year = parseInt(raw.substring(0, 4), 10);
  const month = parseInt(raw.substring(4, 6), 10) - 1; // 0-indexed
  const day = parseInt(raw.substring(6, 8), 10);
  const hour = parseInt(raw.substring(9, 11), 10);
  const min = parseInt(raw.substring(11, 13), 10);
  const sec = parseInt(raw.substring(13, 15), 10);

  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    isNaN(hour) || isNaN(min) || isNaN(sec)
  ) {
    return null;
  }

  return Date.UTC(year, month, day, hour, min, sec) / 1000;
}

/**
 * Parse "YYYY.MM.DD" + "HH:MM:SS" → UTC timestamp in seconds.
 */
function parseDateDotted(datePart: string, timePart: string): number | null {
  const dp = datePart.split('.');
  if (dp.length !== 3) return null;

  const year = parseInt(dp[0], 10);
  const month = parseInt(dp[1], 10) - 1;
  const day = parseInt(dp[2], 10);

  // Support both HH:MM and HH:MM:SS
  const tp = timePart.split(':');
  if (tp.length < 2) return null;

  const hour = parseInt(tp[0], 10);
  const min = parseInt(tp[1], 10);
  const sec = tp.length >= 3 ? parseInt(tp[2], 10) : 0;

  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    isNaN(hour) || isNaN(min) || isNaN(sec)
  ) {
    return null;
  }

  return Date.UTC(year, month, day, hour, min, sec) / 1000;
}

/**
 * Flexible Date parser to support multiple date string configurations.
 */
function parseFlexibleDate(dateStr: string, timeStr?: string): number | null {
  const cleanDate = dateStr.trim();
  const cleanTime = timeStr ? timeStr.trim() : '';

  // 1. Separate Date and Time format: "YYYY.MM.DD" and "HH:MM:SS"
  if (cleanDate && cleanTime) {
    // Try dotted YYYY.MM.DD
    if (cleanDate.includes('.')) {
      const ts = parseDateDotted(cleanDate, cleanTime);
      if (ts !== null) return ts;
    }
    // Try dashed/slashed YYYY-MM-DD or DD/MM/YYYY
    const nativeTs = Date.parse(`${cleanDate.replace(/\//g, '-')}T${cleanTime}Z`);
    if (!isNaN(nativeTs)) return Math.floor(nativeTs / 1000);
  }

  // 2. Single string date and time format
  // Check if it's compact format YYYYMMDD HHMMSS (15 chars)
  if (cleanDate.length === 15 && !cleanDate.includes('.') && !cleanDate.includes('-') && !cleanDate.includes('/')) {
    const ts = parseDateCompact(cleanDate);
    if (ts !== null) return ts;
  }

  // Check if it contains a space or 'T' separator
  if (cleanDate.includes(' ') || cleanDate.includes('T')) {
    const parts = cleanDate.split(/[ T]/);
    const datePart = parts[0];
    const timePart = parts[1];
    if (datePart && timePart) {
      if (datePart.includes('.')) {
        const ts = parseDateDotted(datePart, timePart);
        if (ts !== null) return ts;
      }
      const nativeTs = Date.parse(`${datePart.replace(/\//g, '-')}T${timePart}Z`);
      if (!isNaN(nativeTs)) return Math.floor(nativeTs / 1000);
    }
  }

  // Fallback: try native Date parsing
  const fallbackTs = Date.parse(cleanDate);
  if (!isNaN(fallbackTs)) return Math.floor(fallbackTs / 1000);

  return null;
}

// ---------- Delimiter Detection ----------

type Delimiter = ';' | ',' | '\t';

function detectDelimiter(sample: string): Delimiter {
  if (sample.includes(';')) return ';';
  if (sample.includes('\t')) return '\t';
  return ',';
}

// ---------- Single-Line Parsing ----------

// parseLine was commented out because it is not used in the streaming or bulk CSV parsers.
/*
function parseLine(line: string, delimiter: Delimiter): CandleData | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  // Skip header lines
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('date') || lower.startsWith('time') || lower.startsWith('<date>') || lower.startsWith('datetime')) return null;

  const parts = trimmed.split(delimiter).map((p) => p.trim());
  if (parts.length < 5) return null;

  let time: number | null = null;
  let openIndex = 1;

  // Detect if parts[1] looks like a TIME column:
  // - Contains a colon ("00:00", "00:00:00", "000000")
  // - Does NOT parse as a float (i.e., it's not a price like "4626.435")
  const part1 = parts[1] || '';
  const part1AsFloat = parseFloat(part1);
  const part1IsTime = part1.includes(':') || (part1.length >= 4 && !part1.includes('.') && isNaN(part1AsFloat));

  if (parts.length >= 7 && part1IsTime) {
    // Separate Date + Time columns (e.g. MT5: Date, Time, O, H, L, C, V)
    time = parseFlexibleDate(parts[0], parts[1]);
    openIndex = 2;
  } else {
    // Single DateTime column (e.g. HistData: "20170102 170100", O, H, L, C, V)
    time = parseFlexibleDate(parts[0]);
    openIndex = 1;
  }

  if (time === null || isNaN(time)) return null;

  const open = parseFloat(parts[openIndex]);
  const high = parseFloat(parts[openIndex + 1]);
  const low = parseFloat(parts[openIndex + 2]);
  const close = parseFloat(parts[openIndex + 3]);
  const volume = parts[openIndex + 4] !== undefined ? parseFloat(parts[openIndex + 4]) : 0;

  if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) return null;

  // Basic sanity check to avoid nonsense candles
  if (high < low || open <= 0 || close <= 0 || high <= 0 || low <= 0) return null;

  return {
    time,
    open,
    high,
    low,
    close,
    volume: isNaN(volume) ? 0 : volume,
  };
}
*/

// ---------- Public API ----------

export function parseHistDataCSV(text: string, timezoneOffsetMinutes: number = 0): CandleData[] {
  const lines = text.split(/\r?\n/);
  return parseHistDataCSVStream(lines, timezoneOffsetMinutes);
}

export function parseHistDataCSVStream(lines: string[], timezoneOffsetMinutes: number = 0): CandleData[] {
  if (lines.length === 0) return [];

  let delimiter: Delimiter = ',';
  let firstValidLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0) {
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('date') || lower.startsWith('time') || lower.startsWith('<date>') || lower.startsWith('datetime')) {
        continue;
      }
      delimiter = detectDelimiter(trimmed);
      firstValidLineIndex = i;
      break;
    }
  }

  if (firstValidLineIndex === -1) return [];

  // Detect Date Format once from the first valid line
  const firstLine = lines[firstValidLineIndex].trim();
  const parts = firstLine.split(delimiter).map(p => p.trim());
  
  let separateColumns = false;
  let parseDateFn: (d: string, t?: string) => number | null = parseFlexibleDate;

  const part1 = parts[1] || '';
  const part1AsFloat = parseFloat(part1);
  const part1IsTime = part1.includes(':') || (part1.length >= 4 && !part1.includes('.') && isNaN(part1AsFloat));

  if (parts.length >= 7 && part1IsTime) {
    separateColumns = true;
    const datePart = parts[0];
    if (datePart.includes('.')) {
      parseDateFn = (d, t) => {
        if (d.length < 10 || !t || t.length < 5) return null;
        const year = parseInt(d.substring(0, 4), 10);
        const month = parseInt(d.substring(5, 7), 10) - 1;
        const day = parseInt(d.substring(8, 10), 10);
        const hour = parseInt(t.substring(0, 2), 10);
        const min = parseInt(t.substring(3, 5), 10);
        const sec = t.length >= 8 ? parseInt(t.substring(6, 8), 10) : 0;
        return Date.UTC(year, month, day, hour, min, sec) / 1000;
      };
    } else if (datePart.includes('-') || datePart.includes('/')) {
      parseDateFn = (d, t) => {
        if (d.length < 10 || !t || t.length < 5) return null;
        const year = parseInt(d.substring(0, 4), 10);
        const month = parseInt(d.substring(5, 7), 10) - 1;
        const day = parseInt(d.substring(8, 10), 10);
        const hour = parseInt(t.substring(0, 2), 10);
        const min = parseInt(t.substring(3, 5), 10);
        const sec = t.length >= 8 ? parseInt(t.substring(6, 8), 10) : 0;
        return Date.UTC(year, month, day, hour, min, sec) / 1000;
      };
    }
  } else {
    separateColumns = false;
    const datePart = parts[0];
    if (datePart.length === 15 && !datePart.includes('.') && !datePart.includes('-') && !datePart.includes('/')) {
      parseDateFn = (d) => {
        if (d.length < 15) return null;
        const year = parseInt(d.substring(0, 4), 10);
        const month = parseInt(d.substring(4, 6), 10) - 1;
        const day = parseInt(d.substring(6, 8), 10);
        const hour = parseInt(d.substring(9, 11), 10);
        const min = parseInt(d.substring(11, 13), 10);
        const sec = parseInt(d.substring(13, 15), 10);
        return Date.UTC(year, month, day, hour, min, sec) / 1000;
      };
    }
  }

  const candles: CandleData[] = [];
  const seenTimestamps = new Set<number>();
  const openIndex = separateColumns ? 2 : 1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) continue;

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('date') || lower.startsWith('time') || lower.startsWith('<date>') || lower.startsWith('datetime')) continue;

    const lineParts = trimmed.split(delimiter);
    if (lineParts.length < 5) continue;

    const time = separateColumns 
      ? parseDateFn(lineParts[0].trim(), lineParts[1].trim())
      : parseDateFn(lineParts[0].trim());

    if (time === null || isNaN(time)) continue;

    const open = parseFloat(lineParts[openIndex]);
    const high = parseFloat(lineParts[openIndex + 1]);
    const low = parseFloat(lineParts[openIndex + 2]);
    const close = parseFloat(lineParts[openIndex + 3]);
    const volume = lineParts[openIndex + 4] !== undefined ? parseFloat(lineParts[openIndex + 4]) : 0;

    if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) continue;
    if (high < low || open <= 0 || close <= 0 || high <= 0 || low <= 0) continue;

    const adjustedTime = timezoneOffsetMinutes !== 0 
      ? time - timezoneOffsetMinutes * 60 
      : time;

    if (seenTimestamps.has(adjustedTime)) continue;
    seenTimestamps.add(adjustedTime);

    candles.push({
      time: adjustedTime,
      open,
      high,
      low,
      close,
      volume: isNaN(volume) ? 0 : volume,
    });
  }

  candles.sort((a, b) => a.time - b.time);
  return candles;
}

