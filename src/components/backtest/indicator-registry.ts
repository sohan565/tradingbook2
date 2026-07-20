/**
 * Indicator registry shared by the IndicatorPanel modal and the backtest page.
 * Lives in its own module so the page can import it statically while the
 * IndicatorPanel component itself stays behind a dynamic import.
 */

export interface ActiveIndicator {
  id: string;
  type: string;
  name: string;
  inputs: Record<string, any>;
  color: string;
}

export const INDICATORS_REGISTRY = [
  { type: 'SMA', name: 'Simple Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#3b82f6', inputLabels: { len: 'Length' } },
  { type: 'EMA', name: 'Exponential Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#10b981', inputLabels: { len: 'Length' } },
  { type: 'WMA', name: 'Weighted Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#a855f7', inputLabels: { len: 'Length' } },
  { type: 'HMA', name: 'Hull Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#fb923c', inputLabels: { len: 'Length' } },
  { type: 'ALMA', name: 'Arnaud Legoux Moving Average', category: 'Trend', defaultInputs: { len: 9, offset: 0.85, sigma: 6 }, defaultColor: '#14b8a6', inputLabels: { len: 'Length', offset: 'Offset', sigma: 'Sigma' } },
  { type: 'DEMA', name: 'Double Exponential Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#ec4899', inputLabels: { len: 'Length' } },
  { type: 'TEMA', name: 'Triple Exponential Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#f43f5e', inputLabels: { len: 'Length' } },
  { type: 'LSMA', name: 'Least Squares Moving Average', category: 'Trend', defaultInputs: { len: 25 }, defaultColor: '#84cc16', inputLabels: { len: 'Length' } },
  { type: 'VWMA', name: 'Volume Weighted Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#f59e0b', inputLabels: { len: 'Length' } },
  { type: 'BollingerBands', name: 'Bollinger Bands', category: 'Trend', defaultInputs: { length: 20, mult: 2 }, defaultColor: '#eab308', inputLabels: { length: 'Length', mult: 'Multiplier' } },
  { type: 'IchimokuCloud', name: 'Ichimoku Cloud', category: 'Trend', defaultInputs: { conversionPeriod: 9, basePeriod: 26, laggingSpan2Period: 52, displacement: 26 }, defaultColor: '#6366f1', inputLabels: { conversionPeriod: 'Conversion Line', basePeriod: 'Base Line', laggingSpan2Period: 'Lagging Span', displacement: 'Displacement' } },
  { type: 'DonchianChannels', name: 'Donchian Channels', category: 'Trend', defaultInputs: { length: 20 }, defaultColor: '#00f0ff', inputLabels: { length: 'Length' } },
  { type: 'KeltnerChannels', name: 'Keltner Channels', category: 'Trend', defaultInputs: { length: 20, mult: 1 }, defaultColor: '#60a5fa', inputLabels: { length: 'Length', mult: 'Multiplier' } },
  { type: 'ParabolicSAR', name: 'Parabolic SAR', category: 'Trend', defaultInputs: { start: 0.02, increment: 0.02, maximum: 0.2 }, defaultColor: '#4caf50', inputLabels: { start: 'Start', increment: 'Increment', maximum: 'Maximum' } },
  { type: 'Supertrend', name: 'Supertrend', category: 'Trend', defaultInputs: { factor: 3, pd: 10 }, defaultColor: '#089981', inputLabels: { factor: 'Multiplier', pd: 'ATR Period' } },
  { type: 'RSI', name: 'Relative Strength Index', category: 'Momentum', defaultInputs: { len: 14 }, defaultColor: '#8b5cf6', inputLabels: { len: 'Length' } },
  { type: 'MACD', name: 'MACD (Moving Average Convergence Divergence)', category: 'Momentum', defaultInputs: { fastLength: 12, slowLength: 26, signalLength: 9 }, defaultColor: '#3b82f6', inputLabels: { fastLength: 'Fast Length', slowLength: 'Slow Length', signalLength: 'Signal Length' } },
  { type: 'Stochastic', name: 'Stochastic Oscillator', category: 'Momentum', defaultInputs: { periodK: 14, smoothK: 1, periodD: 3 }, defaultColor: '#f97316', inputLabels: { periodK: '%K Period', smoothK: '%K Smooth', periodD: '%D Period' } },
  { type: 'CCI', name: 'Commodity Channel Index', category: 'Momentum', defaultInputs: { len: 20 }, defaultColor: '#eab308', inputLabels: { len: 'Length' } },
  { type: 'WilliamsPercentRange', name: 'Williams %R', category: 'Momentum', defaultInputs: { len: 14 }, defaultColor: '#ec4899', inputLabels: { len: 'Length' } },
  { type: 'Momentum', name: 'Momentum', category: 'Momentum', defaultInputs: { len: 10 }, defaultColor: '#06b6d4', inputLabels: { len: 'Length' } },
  { type: 'ROC', name: 'Rate of Change (ROC)', category: 'Momentum', defaultInputs: { len: 9 }, defaultColor: '#3b82f6', inputLabels: { len: 'Length' } },
  { type: 'Aroon', name: 'Aroon', category: 'Momentum', defaultInputs: { length: 14 }, defaultColor: '#f97316', inputLabels: { length: 'Length' } },
  { type: 'ATR', name: 'Average True Range (ATR)', category: 'Volatility', defaultInputs: { len: 14 }, defaultColor: '#ef4444', inputLabels: { len: 'Length' } },
  { type: 'OBV', name: 'On Balance Volume (OBV)', category: 'Volume', defaultInputs: {}, defaultColor: '#10b981', inputLabels: {} },
  { type: 'MFI', name: 'Money Flow Index (MFI)', category: 'Volume', defaultInputs: { len: 14 }, defaultColor: '#14b8a6', inputLabels: { len: 'Length' } },
  { type: 'ADX', name: 'Average Directional Index (ADX)', category: 'Trend', defaultInputs: { len: 14 }, defaultColor: '#f43f5e', inputLabels: { len: 'Length' } },
  { type: 'ChaikinMF', name: 'Chaikin Money Flow (CMF)', category: 'Volume', defaultInputs: { length: 20 }, defaultColor: '#22c55e', inputLabels: { length: 'Length' } },
];
