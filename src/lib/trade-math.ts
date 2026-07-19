/* ============================================
   TradingBook — Trade Math Utilities
   Pure functions for P&L, stats, and metrics
   ============================================ */

import type { TradeRecord, BacktestStats, SymbolConfig, TradeType } from '@/types';

// ---------- Symbol Configurations ----------

export const SYMBOLS: Record<string, SymbolConfig> = {
  XAUUSD: {
    key: 'XAUUSD',
    name: 'XAU/USD',
    displayName: 'Gold',
    basePrice: 2350,
    pipSize: 0.1,
    pipValue: 10,      // $10 per pip per 1.0 lot (standard Gold contract size 100 oz)
    digits: 2,
    category: 'commodities',
  },
  EURUSD: {
    key: 'EURUSD',
    name: 'EUR/USD',
    displayName: 'Euro',
    basePrice: 1.085,
    pipSize: 0.0001,
    pipValue: 10,      // $10 per pip per 1.0 lot
    digits: 5,
    category: 'forex',
  },
  GBPUSD: {
    key: 'GBPUSD',
    name: 'GBP/USD',
    displayName: 'Pound',
    basePrice: 1.272,
    pipSize: 0.0001,
    pipValue: 10,
    digits: 5,
    category: 'forex',
  },
  USDJPY: {
    key: 'USDJPY',
    name: 'USD/JPY',
    displayName: 'Yen',
    basePrice: 157.5,
    pipSize: 0.01,
    pipValue: 6.35,    // approximate, depends on JPY rate
    digits: 3,
    category: 'forex',
  },
  BTCUSD: {
    key: 'BTCUSD',
    name: 'BTC/USD',
    displayName: 'Bitcoin',
    basePrice: 67500,
    pipSize: 1,
    pipValue: 1,
    digits: 2,
    category: 'crypto',
  },
  ETHUSD: {
    key: 'ETHUSD',
    name: 'ETH/USD',
    displayName: 'Ethereum',
    basePrice: 3450,
    pipSize: 0.01,
    pipValue: 1,
    digits: 2,
    category: 'crypto',
  },
  NAS100: {
    key: 'NAS100',
    name: 'NAS100',
    displayName: 'Nasdaq',
    basePrice: 19800,
    pipSize: 0.01,
    pipValue: 1,
    digits: 2,
    category: 'stocks',
  },
};

export function getSymbolConfig(symbol: string): SymbolConfig {
  return SYMBOLS[symbol] || SYMBOLS.XAUUSD;
}

// ---------- P&L Calculations ----------

/**
 * Calculate P&L in dollars for a trade
 */
export function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  type: TradeType,
  symbol: string
): number {
  const config = getSymbolConfig(symbol);
  const priceDiff = type === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;
  const pips = priceDiff / config.pipSize;
  return pips * config.pipValue * lotSize;
}

/**
 * Calculate P&L in pips
 */
export function calculatePnLPips(
  entryPrice: number,
  exitPrice: number,
  type: TradeType,
  symbol: string
): number {
  const config = getSymbolConfig(symbol);
  const priceDiff = type === 'BUY' ? exitPrice - entryPrice : entryPrice - exitPrice;
  return priceDiff / config.pipSize;
}

/**
 * Calculate unrealized P&L for an open position
 */
export function calculateUnrealizedPnL(
  entryPrice: number,
  currentPrice: number,
  lotSize: number,
  type: TradeType,
  symbol: string
): { pnl: number; pips: number } {
  return {
    pnl: calculatePnL(entryPrice, currentPrice, lotSize, type, symbol),
    pips: calculatePnLPips(entryPrice, currentPrice, type, symbol),
  };
}

// ---------- Backtest Statistics ----------

/**
 * Calculate comprehensive backtest statistics from a list of closed trades
 */
export function calculateBacktestStats(trades: TradeRecord[]): BacktestStats {
  const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== undefined);

  if (closedTrades.length === 0) {
    return {
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      profitFactor: 0,
      netPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      avgWin: 0,
      avgLoss: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      avgRiskReward: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      avgTradeDuration: 0,
    };
  }

  const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0);
  const losses = closedTrades.filter(t => (t.pnl ?? 0) <= 0);

  const grossProfit = wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0));

  const pnls = closedTrades.map(t => t.pnl ?? 0);
  const bestTrade = Math.max(...pnls);
  const worstTrade = Math.min(...pnls);
  const netPnl = pnls.reduce((sum, p) => sum + p, 0);

  // Max drawdown
  let peak = 0;
  let maxDD = 0;
  let runningPnl = 0;
  for (const pnl of pnls) {
    runningPnl += pnl;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak - runningPnl;
    if (dd > maxDD) maxDD = dd;
  }

  // Consecutive wins/losses
  let maxConsecWins = 0;
  let maxConsecLosses = 0;
  let currentStreak = 0;
  let lastWin: boolean | null = null;

  for (const trade of closedTrades) {
    const isWin = (trade.pnl ?? 0) > 0;
    if (lastWin === null || isWin === lastWin) {
      currentStreak++;
    } else {
      currentStreak = 1;
    }
    if (isWin && currentStreak > maxConsecWins) maxConsecWins = currentStreak;
    if (!isWin && currentStreak > maxConsecLosses) maxConsecLosses = currentStreak;
    lastWin = isWin;
  }

  // Average trade duration
  const durations = closedTrades
    .filter(t => t.exitTime && t.entryTime)
    .map(t => (t.exitTime ?? 0) - t.entryTime);
  const avgDuration = durations.length > 0
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length
    : 0;

  return {
    totalTrades: closedTrades.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    netPnl,
    grossProfit,
    grossLoss,
    bestTrade,
    worstTrade,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? -(grossLoss / losses.length) : 0,
    maxDrawdown: maxDD,
    maxDrawdownPercent: peak > 0 ? (maxDD / peak) * 100 : 0,
    avgRiskReward: losses.length > 0 && wins.length > 0
      ? (grossProfit / wins.length) / (grossLoss / losses.length)
      : 0,
    consecutiveWins: maxConsecWins,
    consecutiveLosses: maxConsecLosses,
    avgTradeDuration: avgDuration,
  };
}

// ---------- Formatting ----------

/**
 * Format a number as currency ($1,234.56)
 */
export function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format pips with sign
 */
export function formatPips(pips: number): string {
  return `${pips >= 0 ? '+' : ''}${pips.toFixed(1)} pips`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format price to symbol's decimal places
 */
export function formatPrice(price: number, symbol: string): string {
  const config = getSymbolConfig(symbol);
  return price.toFixed(config.digits);
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  return `${Math.round(seconds / 86400)}d ${Math.round((seconds % 86400) / 3600)}h`;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
