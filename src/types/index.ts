/* ============================================
   TradingBook — Core TypeScript Types
   ============================================ */

// ---------- Market Data ----------

export interface CandleData {
  time: number; // UTC timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SymbolConfig {
  key: string;         // "XAUUSD"
  name: string;        // "XAU/USD"
  displayName: string; // "Gold"
  basePrice: number;
  pipSize: number;     // 0.01 for gold, 0.0001 for forex
  pipValue: number;    // $ per pip per standard lot
  digits: number;      // decimal places
  category: 'forex' | 'crypto' | 'stocks' | 'commodities';
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D' | '1W';

export interface TimeframeConfig {
  key: Timeframe;
  label: string;
  minutes: number;
  apiInterval: string; // Twelve Data interval string
}

// ---------- Trading ----------

export type TradeType = 'BUY' | 'SELL';
export type TradeStatus = 'open' | 'closed';
export type TradeSource = 'backtest' | 'mt5' | 'manual';

export interface TradeRecord {
  id: string;
  symbol: string;
  type: TradeType;
  lotSize: number;

  entryPrice: number;
  entryTime: number;    // UTC timestamp seconds
  exitPrice?: number;
  exitTime?: number;

  stopLoss?: number;
  takeProfit?: number;

  pnl?: number;         // $ profit/loss
  pnlPips?: number;     // pips profit/loss
  commission: number;
  swap: number;

  status: TradeStatus;
  source: TradeSource;

  // MT5 specific
  ticket?: number;
  magicNumber?: number;
  comment?: string;

  // Journal
  notes?: string;
  tags: string[];
  screenshot?: string;

  // Backtest link
  backtestId?: string;
}

export interface OpenPosition {
  id: string;
  symbol: string;
  type: TradeType;
  lotSize: number;
  entryPrice: number;
  entryTime: number;
  stopLoss?: number;
  takeProfit?: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPips: number;

  // Price line references (for cleanup)
  entryLineId?: string;
  slLineId?: string;
  tpLineId?: string;
}

// ---------- Backtesting ----------

export type BacktestStatus = 'setup' | 'in_progress' | 'paused' | 'completed';
export type ReplayStatus = 'idle' | 'playing' | 'paused' | 'stepping' | 'finished';

export interface BacktestSession {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  startDate: string;     // ISO date string
  endDate: string;

  initialBalance: number;
  currentBalance: number;
  finalBalance?: number;

  totalTrades: number;
  winRate?: number;
  profitFactor?: number;
  maxDrawdown?: number;
  netPnl?: number;

  status: BacktestStatus;
  createdAt: string;
  completedAt?: string;
}

export interface BacktestSetupParams {
  symbol: string;
  timeframe: Timeframe;
  startDate: string;
  endDate: string;
  initialBalance: number;
}

export interface BacktestStats {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;           // 0-100
  profitFactor: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  bestTrade: number;
  worstTrade: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgRiskReward: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  avgTradeDuration: number;  // in seconds
  sharpeRatio?: number;
}

// ---------- Journal ----------

export type Mood = 'confident' | 'focused' | 'neutral' | 'anxious' | 'frustrated' | 'euphoric';

export interface JournalEntry {
  id: string;
  date: string;          // ISO date
  title?: string;
  content: string;       // Rich text / HTML
  mood?: Mood;

  preSessionPlan?: string;
  postSessionReview?: string;

  tags: string[];
  screenshots: string[];

  tradeIds: string[];    // linked trades
  trades?: TradeRecord[]; // linked trades list

  createdAt: string;
  updatedAt: string;
}

// ---------- MT Account ----------

export interface MTAccount {
  id: string;
  platform: 'MT5';
  accountNumber: string;
  broker: string;
  serverName?: string;
  apiKey: string;        // for EA webhook auth
  isActive: boolean;
  lastSyncAt?: string;
}

// ---------- Chart / UI ----------

export interface ChartMarker {
  time: number;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text: string;
}

export interface PriceLineConfig {
  price: number;
  color: string;
  lineWidth: number;
  lineStyle: number; // 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed
  title: string;
  axisLabelVisible: boolean;
}

export interface OHLCDisplay {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  time: number;
  changePercent: number;
}

// ---------- API ----------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MarketDataRequest {
  symbol: string;
  interval: string;
  startDate: string;
  endDate: string;
  outputSize?: number;
}

export interface WebhookTradePayload {
  account: string;
  platform: 'MT5';
  event: 'trade_open' | 'trade_close' | 'trade_modify';
  ticket: number;
  symbol: string;
  type: TradeType;
  lots: number;
  openPrice: number;
  openTime: string;
  closePrice?: number;
  closeTime?: string;
  profit?: number;
  swap?: number;
  commission?: number;
  sl?: number;
  tp?: number;
}

// ---------- Chart Settings ----------

export interface ChartSettings {
  // Canvas / Basic Styles
  backgroundType: 'solid' | 'gradient';
  backgroundColor: string;
  showVertGridLines: boolean;
  vertGridColor: string;
  vertGridStyle: 'solid' | 'dashed' | 'dotted';
  showHorzGridLines: boolean;
  horzGridColor: string;
  horzGridStyle: 'solid' | 'dashed' | 'dotted';
  crosshairColor: string;
  crosshairStyle: 'solid' | 'dashed' | 'dotted';
  watermarkVisibility: 'hidden' | 'ticker' | 'interval' | 'description' | 'replay';
  watermarkColor: string;

  // Scales
  scalesTextColor: string;
  scalesFontSize: number;
  scalesLinesColor: string;

  // Buttons
  navigationButtons: 'always' | 'mouseover' | 'never';
  paneButtons: 'always' | 'mouseover' | 'never';

  // Symbol
  candleUpColor: string;
  candleDownColor: string;
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;
  showLastPriceLine: boolean;
  lastPriceLineColor: string;
  showHighLowLines: boolean;

  // Status Line
  showLogo: boolean;
  showTitle: boolean;
  showOpenMarketStatus: boolean;
  showOHLC: boolean;
  showBarChange: boolean;
  showVolume: boolean;

  // Scales & Lines
  showSymbolNameLabel: boolean;
  showSymbolLastPriceLabel: boolean;
  showHighLowPriceLabels: boolean;
  showCountdownToBarClose: boolean;

  // Trading
  showPositions: boolean;
  showOrders: boolean;
  showTradeHistory: boolean;
  showTradeLevels: boolean;
  showBuySellButtons: boolean;
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  backgroundType: 'solid',
  backgroundColor: '#ffffff', // Pure white default matching Screenshot 1
  showVertGridLines: true,
  vertGridColor: '#f0f3fa',
  vertGridStyle: 'solid',
  showHorzGridLines: true,
  horzGridColor: '#f0f3fa',
  horzGridStyle: 'solid',
  crosshairColor: '#787b86',
  crosshairStyle: 'dashed',
  watermarkVisibility: 'hidden',
  watermarkColor: 'rgba(0, 0, 0, 0.05)',

  scalesTextColor: '#131722',
  scalesFontSize: 12,
  scalesLinesColor: '#e0e3eb',

  navigationButtons: 'mouseover',
  paneButtons: 'mouseover',

  candleUpColor: '#089981', // TradingView Teal Green
  candleDownColor: '#f23645', // TradingView Red
  borderUpColor: '#089981',
  borderDownColor: '#f23645',
  wickUpColor: '#089981',
  wickDownColor: '#f23645',
  showLastPriceLine: true,
  lastPriceLineColor: '#f23645',
  showHighLowLines: false,

  showLogo: true,
  showTitle: true,
  showOpenMarketStatus: true,
  showOHLC: true,
  showBarChange: true,
  showVolume: true,

  showSymbolNameLabel: true,
  showSymbolLastPriceLabel: true,
  showHighLowPriceLabels: false,
  showCountdownToBarClose: true,

  showPositions: true,
  showOrders: true,
  showTradeHistory: true,
  showTradeLevels: true,
  showBuySellButtons: true,
};
