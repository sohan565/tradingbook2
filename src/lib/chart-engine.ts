/**
 * TradingBook — Chart Engine
 * =====================================================
 * Unified chart data management and rendering logic.
 * Handles data validation, normalization, and sync.
 * =====================================================
 */

import type { CandleData, Timeframe } from '@/types';

/**
 * Validates a single candle for chart rendering
 */
export function validateCandle(candle: unknown): candle is CandleData {
  if (!candle || typeof candle !== 'object') return false;
  const c = candle as Record<string, unknown>;
  return (
    typeof c.time === 'number' &&
    typeof c.open === 'number' &&
    typeof c.high === 'number' &&
    typeof c.low === 'number' &&
    typeof c.close === 'number' &&
    Number.isFinite(c.time) &&
    Number.isFinite(c.open) &&
    Number.isFinite(c.high) &&
    Number.isFinite(c.low) &&
    Number.isFinite(c.close) &&
    c.high >= c.low &&
    c.high >= c.open &&
    c.high >= c.close &&
    c.low <= c.open &&
    c.low <= c.close &&
    c.open > 0 &&
    c.close > 0 &&
    c.high > 0 &&
    c.low > 0
  );
}

/**
 * Validates and normalizes a candles array for chart rendering.
 * Returns empty array if validation fails.
 */
export function normalizeChartCandles(value: unknown): CandleData[] {
  if (!Array.isArray(value)) {
    console.error('[ChartEngine] Expected candles array, got:', typeof value);
    return [];
  }

  const validated: CandleData[] = [];
  const seenTimestamps = new Set<number>();

  for (let i = 0; i < value.length; i++) {
    if (!validateCandle(value[i])) {
      console.warn(`[ChartEngine] Skipping invalid candle at index ${i}:`, value[i]);
      continue;
    }

    const candle = value[i];
    if (seenTimestamps.has(candle.time)) {
      console.warn(`[ChartEngine] Duplicate timestamp ${candle.time}, skipping`);
      continue;
    }

    seenTimestamps.add(candle.time);
    validated.push({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: typeof candle.volume === 'number' ? candle.volume : 0,
    });
  }

  // Ensure sorted by time
  validated.sort((a, b) => a.time - b.time);

  console.log(`[ChartEngine] Normalized ${validated.length} candles from input of ${value.length}`);
  return validated;
}

/**
 * Debug: Log candle information for troubleshooting
 */
export function debugLogCandles(
  candles: CandleData[],
  label: string = 'Candles'
): void {
  if (candles.length === 0) {
    console.warn(`[ChartEngine] ${label}: Empty array`);
    return;
  }

  const first = candles[0];
  const last = candles[candles.length - 1];

  console.log(
    `[ChartEngine] ${label}: ${candles.length} candles from ${new Date(
      first.time * 1000
    ).toISOString()} to ${new Date(last.time * 1000).toISOString()}`
  );
  console.log(`[ChartEngine] First: O=${first.open} H=${first.high} L=${first.low} C=${first.close}`);
  console.log(`[ChartEngine] Last: O=${last.open} H=${last.high} L=${last.low} C=${last.close}`);
}

/**
 * Determines if two candle sets represent the same data
 */
export function areCandlesSame(a: CandleData[], b: CandleData[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].time !== b[i].time ||
      a[i].open !== b[i].open ||
      a[i].high !== b[i].high ||
      a[i].low !== b[i].low ||
      a[i].close !== b[i].close
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Calculate initial replay index (for showing first N candles)
 */
export function getInitialReplayIndex(candles: CandleData[], initialCount: number = 50): number {
  if (candles.length === 0) return 0;
  return Math.max(0, Math.min(initialCount - 1, candles.length - 1));
}
