/* ============================================
   TradingBook — Technical Indicators
   Pure functions for chart overlay calculations
   ============================================ */

import type { CandleData } from '@/types';

interface IndicatorPoint {
  time: number;
  value: number;
}

// ---------- Moving Averages ----------

/**
 * Simple Moving Average
 */
export function calculateSMA(data: CandleData[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period,
    });
  }

  return result;
}

/**
 * Exponential Moving Average
 */
export function calculateEMA(data: CandleData[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);

  // First EMA value = SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  result.push({ time: data[period - 1].time, value: ema });

  // Subsequent values
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({ time: data[i].time, value: ema });
  }

  return result;
}

// ---------- RSI ----------

/**
 * Relative Strength Index
 */
export function calculateRSI(data: CandleData[], period: number = 14): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (data.length < period + 1) return result;

  const changes: number[] = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }

  // Initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({
    time: data[period].time,
    value: 100 - 100 / (1 + rs),
  });

  // Smoothed RSI
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const smoothedRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({
      time: data[i + 1].time,
      value: 100 - 100 / (1 + smoothedRS),
    });
  }

  return result;
}

// ---------- Bollinger Bands ----------

interface BollingerBandPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  data: CandleData[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerBandPoint[] {
  const result: BollingerBandPoint[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    const sma = sum / period;

    // Standard deviation
    let squaredSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      squaredSum += Math.pow(data[j].close - sma, 2);
    }
    const stdDev = Math.sqrt(squaredSum / period);

    result.push({
      time: data[i].time,
      upper: sma + stdDev * stdDevMultiplier,
      middle: sma,
      lower: sma - stdDev * stdDevMultiplier,
    });
  }

  return result;
}

// ---------- ATR ----------

/**
 * Average True Range — useful for XAU/USD volatility measurement
 */
export function calculateATR(data: CandleData[], period: number = 14): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (data.length < period + 1) return result;

  // Calculate True Range for each candle
  const trueRanges: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,                         // Current range
      Math.abs(data[i].high - data[i - 1].close),        // High - prev close
      Math.abs(data[i].low - data[i - 1].close)          // Low - prev close
    );
    trueRanges.push(tr);
  }

  // First ATR = simple average
  let atr = 0;
  for (let i = 0; i < period; i++) {
    atr += trueRanges[i];
  }
  atr /= period;

  result.push({
    time: data[period].time,
    value: atr,
  });

  // Smoothed ATR
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    result.push({
      time: data[i + 1].time,
      value: atr,
    });
  }

  return result;
}

// ---------- VWAP ----------

/**
 * Volume Weighted Average Price (intraday)
 */
export function calculateVWAP(data: CandleData[]): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (data.length === 0) return result;

  let cumulativeTPV = 0;  // Total Price × Volume
  let cumulativeVolume = 0;

  for (const candle of data) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = candle.volume ?? 0;
    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;

    result.push({
      time: candle.time,
      value: cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice,
    });
  }

  return result;
}
