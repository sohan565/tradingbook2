/* ============================================
   TradingBook — Candle Aggregator
   ============================================
   Aggregates M1 (1-minute) candles into higher
   timeframes: 5m, 15m, 30m, 1H, 4H, 1D, 1W.
   ============================================ */

import type { CandleData, Timeframe } from '@/types';

// ---------- Timeframe Constants ----------

/** Map each timeframe to its bucket duration in seconds. */
const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m':  60,
  '5m':  300,
  '15m': 900,
  '30m': 1800,
  '1H':  3600,
  '4H':  14400,
  '1D':  86400,
  '1W':  604800,
};

/**
 * Returns the bucket duration in seconds for a given timeframe.
 */
export function getTimeframeBucketSeconds(tf: Timeframe): number {
  return TIMEFRAME_SECONDS[tf];
}

// ---------- Bucket Key Calculation ----------

/**
 * Calculate the bucket start timestamp for a given candle time and timeframe.
 *
 * For sub-daily timeframes (1m–4H): floors to the nearest bucket boundary
 * using modulo arithmetic on UTC timestamps.
 *
 * For daily (1D): floors to the start of the UTC day.
 * For weekly (1W): floors to the start of the UTC week (Monday).
 */
function getBucketStart(time: number, tf: Timeframe): number {
  if (tf === '1D') {
    // Floor to start of UTC day
    return Math.floor(time / 86400) * 86400;
  }

  if (tf === '1W') {
    // Floor to start of UTC week (Monday 00:00:00)
    // JS Date.getUTCDay(): 0=Sun, 1=Mon, ...
    const date = new Date(time * 1000);
    const dayOfWeek = date.getUTCDay();
    // Shift so Monday=0: (dayOfWeek + 6) % 7
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const mondayTimestamp = Math.floor(time / 86400) * 86400 - daysSinceMonday * 86400;
    return mondayTimestamp;
  }

  // Sub-daily: simple modulo bucket
  const bucketSeconds = TIMEFRAME_SECONDS[tf];
  return Math.floor(time / bucketSeconds) * bucketSeconds;
}

// ---------- Public API ----------

/**
 * Aggregate an array of M1 candles into the target timeframe.
 *
 * @param candles - Array of M1 CandleData, ideally sorted by time.
 * @param targetTimeframe - The desired output timeframe.
 * @returns Aggregated CandleData array, sorted by time ascending.
 */
export function aggregateCandles(
  candles: CandleData[],
  targetTimeframe: Timeframe
): CandleData[] {
  if (candles.length === 0) return [];

  // Fast path: 1m is already 1-minute data
  if (targetTimeframe === '1m') {
    return [...candles].sort((a, b) => a.time - b.time);
  }

  // Group candles by bucket start timestamp.
  // Using a Map preserves insertion order, and we'll sort anyway.
  const buckets = new Map<number, CandleData[]>();

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const bucketStart = getBucketStart(candle.time, targetTimeframe);

    let bucket = buckets.get(bucketStart);
    if (!bucket) {
      bucket = [];
      buckets.set(bucketStart, bucket);
    }
    bucket.push(candle);
  }

  // Build aggregated candles from each bucket
  const aggregated: CandleData[] = [];

  for (const [bucketStart, bucket] of buckets) {
    // Sort within bucket to ensure correct open/close ordering
    bucket.sort((a, b) => a.time - b.time);

    let high = -Infinity;
    let low = Infinity;
    let volumeSum = 0;

    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i].high > high) high = bucket[i].high;
      if (bucket[i].low < low) low = bucket[i].low;
      volumeSum += bucket[i].volume ?? 0;
    }

    aggregated.push({
      time: bucketStart,
      open: bucket[0].open,
      high,
      low,
      close: bucket[bucket.length - 1].close,
      volume: volumeSum,
    });
  }

  // Sort by time ascending
  aggregated.sort((a, b) => a.time - b.time);

  return aggregated;
}
