import { CandleData } from '@/types';

/**
 * Computes Heikin Ashi candles from standard OHLC candles.
 * 
 * HA Close = (Open + High + Low + Close) / 4
 * HA Open = (Previous HA Open + Previous HA Close) / 2
 * HA High = Max(High, HA Open, HA Close)
 * HA Low = Min(Low, HA Open, HA Close)
 */
export function computeHeikinAshi(candles: CandleData[]): CandleData[] {
  if (!candles || candles.length === 0) return [];

  const haCandles: CandleData[] = [];
  
  // First candle
  const first = candles[0];
  const firstHaClose = (first.open + first.high + first.low + first.close) / 4;
  const firstHaOpen = (first.open + first.close) / 2;
  const firstHaHigh = Math.max(first.high, firstHaOpen, firstHaClose);
  const firstHaLow = Math.min(first.low, firstHaOpen, firstHaClose);
  
  haCandles.push({
    time: first.time,
    open: Number(firstHaOpen.toFixed(5)),
    high: Number(firstHaHigh.toFixed(5)),
    low: Number(firstHaLow.toFixed(5)),
    close: Number(firstHaClose.toFixed(5)),
    volume: first.volume
  });

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevHa = haCandles[i - 1];

    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = (prevHa.open + prevHa.close) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);

    haCandles.push({
      time: c.time,
      open: Number(haOpen.toFixed(5)),
      high: Number(haHigh.toFixed(5)),
      low: Number(haLow.toFixed(5)),
      close: Number(haClose.toFixed(5)),
      volume: c.volume
    });
  }

  return haCandles;
}
