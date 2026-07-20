'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  createChart,
  LineSeries,
  AreaSeries,
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { TradeRecord, Mood, BacktestStats } from '@/types';
import {
  formatCurrency,
  formatPercent,
  formatDuration,
  calculateBacktestStats,
  SYMBOLS,
} from '@/lib/trade-math';
import Select from '@/components/ui/Select';
import { CountUp, Sparkline } from '@/components/ui/StatParts';
import styles from './analytics.module.css';

const AiCoachCard = dynamic(() => import('./AiCoachCard'), { ssr: false });

// Extended type for trade with mood mapping
interface TradeWithMood extends TradeRecord {
  journalEntry?: {
    mood: Mood;
  };
}

// ---------------- Fallback Demo Data ----------------
const INITIAL_BALANCE = 10000;

const DEMO_TRADES: TradeWithMood[] = [
  {
    id: 'demo-1',
    symbol: 'EURUSD',
    type: 'BUY',
    lotSize: 1.0,
    entryPrice: 1.08250,
    entryTime: Math.floor(new Date('2026-05-25T10:00:00Z').getTime() / 1000),
    exitPrice: 1.08650,
    exitTime: Math.floor(new Date('2026-05-25T14:30:00Z').getTime() / 1000),
    pnl: 400.00,
    pnlPips: 40.0,
    commission: -6.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['trend-following', 'london-session'],
    journalEntry: { mood: 'focused' },
  },
  {
    id: 'demo-2',
    symbol: 'XAUUSD',
    type: 'SELL',
    lotSize: 2.0,
    entryPrice: 2355.50,
    entryTime: Math.floor(new Date('2026-05-26T13:15:00Z').getTime() / 1000),
    exitPrice: 2359.00,
    exitTime: Math.floor(new Date('2026-05-26T13:45:00Z').getTime() / 1000),
    pnl: -700.00,
    pnlPips: -35.0,
    commission: -12.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['support-breakout'],
    journalEntry: { mood: 'frustrated' },
  },
  {
    id: 'demo-3',
    symbol: 'XAUUSD',
    type: 'SELL',
    lotSize: 2.0,
    entryPrice: 2359.00,
    entryTime: Math.floor(new Date('2026-05-26T14:00:00Z').getTime() / 1000),
    exitPrice: 2364.50,
    exitTime: Math.floor(new Date('2026-05-26T14:40:00Z').getTime() / 1000),
    pnl: -1100.00,
    pnlPips: -55.0,
    commission: -12.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['revenge-trade'],
    journalEntry: { mood: 'frustrated' },
  },
  {
    id: 'demo-4',
    symbol: 'XAUUSD',
    type: 'BUY',
    lotSize: 1.5,
    entryPrice: 2352.00,
    entryTime: Math.floor(new Date('2026-05-27T09:30:00Z').getTime() / 1000),
    exitPrice: 2371.00,
    exitTime: Math.floor(new Date('2026-05-27T17:00:00Z').getTime() / 1000),
    pnl: 2850.00,
    pnlPips: 190.0,
    commission: -9.00,
    swap: -3.50,
    status: 'closed',
    source: 'backtest',
    tags: ['reversal', 'ny-session'],
    journalEntry: { mood: 'confident' },
  },
  {
    id: 'demo-5',
    symbol: 'GBPUSD',
    type: 'BUY',
    lotSize: 1.0,
    entryPrice: 1.26800,
    entryTime: Math.floor(new Date('2026-05-28T08:15:00Z').getTime() / 1000),
    exitPrice: 1.27250,
    exitTime: Math.floor(new Date('2026-05-28T12:00:00Z').getTime() / 1000),
    pnl: 450.00,
    pnlPips: 45.0,
    commission: -6.00,
    swap: 0,
    status: 'closed',
    source: 'mt5',
    tags: ['london-session'],
    journalEntry: { mood: 'focused' },
  },
  {
    id: 'demo-6',
    symbol: 'BTCUSD',
    type: 'BUY',
    lotSize: 0.2,
    entryPrice: 67200.0,
    entryTime: Math.floor(new Date('2026-05-30T16:00:00Z').getTime() / 1000),
    exitPrice: 68150.0,
    exitTime: Math.floor(new Date('2026-05-31T11:30:00Z').getTime() / 1000),
    pnl: 190.00,
    pnlPips: 950.0,
    commission: -4.00,
    swap: -1.80,
    status: 'closed',
    source: 'mt5',
    tags: ['weekend-scalp'],
    journalEntry: { mood: 'neutral' },
  },
  {
    id: 'demo-7',
    symbol: 'EURUSD',
    type: 'SELL',
    lotSize: 1.5,
    entryPrice: 1.08900,
    entryTime: Math.floor(new Date('2026-06-01T13:30:00Z').getTime() / 1000),
    exitPrice: 1.08550,
    exitTime: Math.floor(new Date('2026-06-01T18:15:00Z').getTime() / 1000),
    pnl: 525.00,
    pnlPips: 35.0,
    commission: -9.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['ny-session', 'cpi-news'],
    journalEntry: { mood: 'focused' },
  },
  {
    id: 'demo-8',
    symbol: 'GBPUSD',
    type: 'BUY',
    lotSize: 2.0,
    entryPrice: 1.27500,
    entryTime: Math.floor(new Date('2026-06-02T10:00:00Z').getTime() / 1000),
    exitPrice: 1.27100,
    exitTime: Math.floor(new Date('2026-06-02T11:45:00Z').getTime() / 1000),
    pnl: -800.00,
    pnlPips: -40.0,
    commission: -12.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['trend-following'],
    journalEntry: { mood: 'anxious' },
  },
  {
    id: 'demo-9',
    symbol: 'XAUUSD',
    type: 'BUY',
    lotSize: 1.0,
    entryPrice: 2365.00,
    entryTime: Math.floor(new Date('2026-06-04T14:20:00Z').getTime() / 1000),
    exitPrice: 2368.50,
    exitTime: Math.floor(new Date('2026-06-04T15:10:00Z').getTime() / 1000),
    pnl: 350.00,
    pnlPips: 35.0,
    commission: -6.00,
    swap: 0,
    status: 'closed',
    source: 'mt5',
    tags: ['pullback-buy'],
    journalEntry: { mood: 'confident' },
  },
  {
    id: 'demo-10',
    symbol: 'XAUUSD',
    type: 'BUY',
    lotSize: 1.5,
    entryPrice: 2368.00,
    entryTime: Math.floor(new Date('2026-06-04T15:30:00Z').getTime() / 1000),
    exitPrice: 2378.00,
    exitTime: Math.floor(new Date('2026-06-04T19:00:00Z').getTime() / 1000),
    pnl: 1500.00,
    pnlPips: 100.0,
    commission: -9.00,
    swap: -3.50,
    status: 'closed',
    source: 'mt5',
    tags: ['trend-following'],
    journalEntry: { mood: 'euphoric' },
  },
  {
    id: 'demo-11',
    symbol: 'XAUUSD',
    type: 'BUY',
    lotSize: 3.0,
    entryPrice: 2382.00,
    entryTime: Math.floor(new Date('2026-06-05T09:00:00Z').getTime() / 1000),
    exitPrice: 2372.00,
    exitTime: Math.floor(new Date('2026-06-05T10:15:00Z').getTime() / 1000),
    pnl: -3000.00,
    pnlPips: -100.0,
    commission: -18.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['breakout-chase', 'oversized-lots'],
    journalEntry: { mood: 'euphoric' },
  },
  {
    id: 'demo-12',
    symbol: 'XAUUSD',
    type: 'SELL',
    lotSize: 2.0,
    entryPrice: 2370.00,
    entryTime: Math.floor(new Date('2026-06-05T10:30:00Z').getTime() / 1000),
    exitPrice: 2362.00,
    exitTime: Math.floor(new Date('2026-06-05T12:00:00Z').getTime() / 1000),
    pnl: 1600.00,
    pnlPips: 80.0,
    commission: -12.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['revenge-trade', 'reversal'],
    journalEntry: { mood: 'frustrated' },
  },
  {
    id: 'demo-13',
    symbol: 'EURUSD',
    type: 'BUY',
    lotSize: 1.0,
    entryPrice: 1.08200,
    entryTime: Math.floor(new Date('2026-06-08T11:00:00Z').getTime() / 1000),
    exitPrice: 1.08050,
    exitTime: Math.floor(new Date('2026-06-08T13:45:00Z').getTime() / 1000),
    pnl: -150.00,
    pnlPips: -15.0,
    commission: -6.00,
    swap: 0,
    status: 'closed',
    source: 'mt5',
    tags: ['london-range'],
    journalEntry: { mood: 'neutral' },
  },
  {
    id: 'demo-14',
    symbol: 'BTCUSD',
    type: 'BUY',
    lotSize: 0.5,
    entryPrice: 68500.0,
    entryTime: Math.floor(new Date('2026-06-10T14:00:00Z').getTime() / 1000),
    exitPrice: 69200.0,
    exitTime: Math.floor(new Date('2026-06-10T18:30:00Z').getTime() / 1000),
    pnl: 350.00,
    pnlPips: 700.0,
    commission: -10.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['resistance-test'],
    journalEntry: { mood: 'focused' },
  },
  {
    id: 'demo-15',
    symbol: 'XAUUSD',
    type: 'SELL',
    lotSize: 1.0,
    entryPrice: 2345.00,
    entryTime: Math.floor(new Date('2026-06-11T13:00:00Z').getTime() / 1000),
    exitPrice: 2351.00,
    exitTime: Math.floor(new Date('2026-06-11T16:20:00Z').getTime() / 1000),
    pnl: -600.00,
    pnlPips: -60.0,
    commission: -6.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['counter-trend'],
    journalEntry: { mood: 'anxious' },
  },
  {
    id: 'demo-16',
    symbol: 'GBPUSD',
    type: 'BUY',
    lotSize: 1.0,
    entryPrice: 1.27200,
    entryTime: Math.floor(new Date('2026-06-15T09:00:00Z').getTime() / 1000),
    exitPrice: 1.27850,
    exitTime: Math.floor(new Date('2026-06-15T15:30:00Z').getTime() / 1000),
    pnl: 650.00,
    pnlPips: 65.0,
    commission: -6.00,
    swap: 0,
    status: 'closed',
    source: 'mt5',
    tags: ['london-session', 'bullish-channel'],
    journalEntry: { mood: 'focused' },
  },
  {
    id: 'demo-17',
    symbol: 'XAUUSD',
    type: 'SELL',
    lotSize: 1.5,
    entryPrice: 2338.00,
    entryTime: Math.floor(new Date('2026-06-17T13:00:00Z').getTime() / 1000),
    exitPrice: 2322.00,
    exitTime: Math.floor(new Date('2026-06-17T17:45:00Z').getTime() / 1000),
    pnl: 2400.00,
    pnlPips: 160.0,
    commission: -9.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['fomc-news', 'breakdown'],
    journalEntry: { mood: 'confident' },
  },
  {
    id: 'demo-18',
    symbol: 'EURUSD',
    type: 'SELL',
    lotSize: 2.0,
    entryPrice: 1.07400,
    entryTime: Math.floor(new Date('2026-06-18T10:30:00Z').getTime() / 1000),
    exitPrice: 1.07150,
    exitTime: Math.floor(new Date('2026-06-18T14:00:00Z').getTime() / 1000),
    pnl: 500.00,
    pnlPips: 25.0,
    commission: -12.00,
    swap: 0,
    status: 'closed',
    source: 'mt5',
    tags: ['london-session'],
    journalEntry: { mood: 'focused' },
  },
  {
    id: 'demo-19',
    symbol: 'GBPUSD',
    type: 'SELL',
    lotSize: 1.5,
    entryPrice: 1.26500,
    entryTime: Math.floor(new Date('2026-06-19T09:15:00Z').getTime() / 1000),
    exitPrice: 1.26750,
    exitTime: Math.floor(new Date('2026-06-19T10:45:00Z').getTime() / 1000),
    pnl: -375.00,
    pnlPips: -25.0,
    commission: -9.00,
    swap: 0,
    status: 'closed',
    source: 'mt5',
    tags: ['london-breakout'],
    journalEntry: { mood: 'anxious' },
  },
  {
    id: 'demo-20',
    symbol: 'XAUUSD',
    type: 'BUY',
    lotSize: 1.0,
    entryPrice: 2315.00,
    entryTime: Math.floor(new Date('2026-06-20T11:00:00Z').getTime() / 1000),
    exitPrice: 2326.50,
    exitTime: Math.floor(new Date('2026-06-20T14:30:00Z').getTime() / 1000),
    pnl: 1150.00,
    pnlPips: 115.0,
    commission: -6.00,
    swap: 0,
    status: 'closed',
    source: 'backtest',
    tags: ['double-bottom', 'reversal'],
    journalEntry: { mood: 'focused' },
  },
];

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  // Filters State
  const [timeRange, setTimeRange] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [symbolFilter, setSymbolFilter] = useState<string>('all');

  const [nowSec, setNowSec] = useState<number>(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 0);
    return () => clearTimeout(timer);
  }, [timeRange]);

  const [trades, setTrades] = useState<TradeWithMood[]>([]);
  const [backtestSessions, setBacktestSessions] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Calendar View State
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());

  // Charts references
  const equityContainerRef = useRef<HTMLDivElement>(null);
  const drawdownContainerRef = useRef<HTMLDivElement>(null);

  const equityChartRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const drawdownChartRef = useRef<IChartApi | null>(null);
  const drawdownSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);



  // Load trade data
  const loadTrades = async () => {
    setIsFetching(true);
    try {
      const [tradesRes, sessionsRes] = await Promise.all([
        fetch('/api/trades'),
        fetch('/api/backtest/sessions')
      ]);

      const tradesJson = await tradesRes.json();
      const sessionsJson = await sessionsRes.json();

      let dbTrades: TradeWithMood[] = [];
      let sessionsList: any[] = [];

      if (tradesJson.success && tradesJson.data) {
        dbTrades = tradesJson.data.map((t: any) => ({
          ...t,
          entryTime: typeof t.entryTime === 'string' ? Math.floor(new Date(t.entryTime).getTime() / 1000) : t.entryTime,
          exitTime: t.exitTime ? (typeof t.exitTime === 'string' ? Math.floor(new Date(t.exitTime).getTime() / 1000) : t.exitTime) : undefined,
        }));
      }

      if (sessionsJson.success && sessionsJson.data) {
        sessionsList = sessionsJson.data;
        setBacktestSessions(sessionsList);
      }

      // Extract trades from backtest sessions and combine them
      const sessionTrades: TradeWithMood[] = [];
      sessionsList.forEach((session: any) => {
        let closedTradesList: any[] = [];
        if (session.closedTrades) {
          if (Array.isArray(session.closedTrades)) {
            closedTradesList = session.closedTrades;
          } else if (typeof session.closedTrades === 'string') {
            try {
              closedTradesList = JSON.parse(session.closedTrades);
            } catch (e) {
              console.error('Failed to parse closedTrades:', e);
            }
          }
        }

        closedTradesList.forEach((t: any) => {
          sessionTrades.push({
            ...t,
            id: t.id || `bt-${session.id}-${t.ticket || Math.random()}`,
            entryTime: typeof t.entryTime === 'string' ? Math.floor(new Date(t.entryTime).getTime() / 1000) : t.entryTime,
            exitTime: t.exitTime ? (typeof t.exitTime === 'string' ? Math.floor(new Date(t.exitTime).getTime() / 1000) : t.exitTime) : undefined,
            source: `backtest-session-${session.id}`,
            sessionName: session.name,
          });
        });
      });

      const combinedTrades = [...dbTrades, ...sessionTrades];

      if (combinedTrades.length > 0) {
        setTrades(combinedTrades);
        setIsDemoMode(false);
      } else {
        // Fallback to demo data if DB is empty
        setTrades(DEMO_TRADES);
        setIsDemoMode(true);
      }
    } catch (err) {
      console.error('Failed to load trade records for analytics:', err);
      // Fallback on error
      setTrades(DEMO_TRADES);
      setIsDemoMode(true);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTrades();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Handle manual toggle of demo mode
  const handleClearDemoMode = () => {
    setTrades([]);
    setIsDemoMode(false);
  };

  // Get list of unique symbols dynamically
  const uniqueSymbols = useMemo(() => {
    const symbolsSet = new Set<string>();
    trades.forEach((t) => symbolsSet.add(t.symbol));
    return Array.from(symbolsSet);
  }, [trades]);

  // Filter Trades
  const filteredTrades = useMemo(() => {
    let result = [...trades];

    // Source Filter
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'live-all') {
        // Live database sync (MT5 + Manual + Direct DB Backtests)
        result = result.filter((t) => !t.source.startsWith('backtest-session-'));
      } else if (sourceFilter === 'backtest-all') {
        // All backtest sessions combined
        result = result.filter((t) => t.source.startsWith('backtest-session-'));
      } else {
        // Specific source filter (e.g. specific session ID or 'mt5' / 'manual')
        result = result.filter((t) => t.source === sourceFilter);
      }
    }

    // Symbol Filter
    if (symbolFilter !== 'all') {
      result = result.filter((t) => t.symbol === symbolFilter);
    }

    // Time Range Filter
    if (timeRange === '7d' && nowSec > 0) {
      result = result.filter((t) => (t.exitTime || t.entryTime) >= nowSec - 7 * 86400);
    } else if (timeRange === '30d' && nowSec > 0) {
      result = result.filter((t) => (t.exitTime || t.entryTime) >= nowSec - 30 * 86400);
    } else if (timeRange === '90d' && nowSec > 0) {
      result = result.filter((t) => (t.exitTime || t.entryTime) >= nowSec - 90 * 86400);
    } else if (timeRange === 'mtd') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const startOfMonthSec = Math.floor(startOfMonth.getTime() / 1000);
      result = result.filter((t) => (t.exitTime || t.entryTime) >= startOfMonthSec);
    }

    // Sort chronologically ascending for stats and chart plotting
    return result.sort((a, b) => (a.exitTime || a.entryTime) - (b.exitTime || b.entryTime));
  }, [trades, sourceFilter, symbolFilter, timeRange]);

  // Statistics Calculations
  const stats = useMemo(() => {
    return calculateBacktestStats(filteredTrades);
  }, [filteredTrades]);

  // Cumulative P&L series for the stat-card sparkline
  const equitySpark = useMemo(() => {
    const series: number[] = [];
    filteredTrades.reduce((running, t) => {
      const next = running + (t.pnl ?? 0);
      series.push(next);
      return next;
    }, 0);
    return series;
  }, [filteredTrades]);

  // Human-readable name of the active source filter (sent to the AI coach)
  const activeSourceName = useMemo(() => {
    if (sourceFilter === 'live-all') return 'Live / Sync Database';
    if (sourceFilter === 'backtest-all') return 'All Backtests Combined';
    if (sourceFilter.startsWith('backtest-session-')) {
      const matchingSession = backtestSessions.find(s => `backtest-session-${s.id}` === sourceFilter);
      if (matchingSession) return `${matchingSession.name} (Backtest)`;
    }
    if (sourceFilter === 'mt5') return 'MetaTrader 5 Only';
    if (sourceFilter === 'manual') return 'Manual Entry Only';
    return 'All Sources';
  }, [sourceFilter, backtestSessions]);

  // Extended Advanced stats (Sharpe Ratio, Expectancy)
  const advancedStats = useMemo(() => {
    if (filteredTrades.length === 0) {
      return { sharpeRatio: 0, expectancy: 0, avgWinDuration: 0, avgLossDuration: 0 };
    }

    const pnls = filteredTrades.map((t) => t.pnl ?? 0);
    const avgReturn = stats.netPnl / filteredTrades.length;

    // Standard deviation of returns
    const variance =
      pnls.reduce((sum, pnl) => sum + Math.pow(pnl - avgReturn, 2), 0) /
      filteredTrades.length;
    const stdDev = Math.sqrt(variance);

    // Sharpe Ratio = Average / Standard Deviation (simplified per-trade)
    const sharpe = stdDev > 0 ? avgReturn / stdDev : 0;

    // Expectancy = (Win Rate % * Avg Win) + (Loss Rate % * Avg Loss)
    const winRateFrac = stats.winRate / 100;
    const expectancy =
      winRateFrac * stats.avgWin + (1 - winRateFrac) * stats.avgLoss;

    // Win vs Loss durations
    const winTrades = filteredTrades.filter((t) => (t.pnl ?? 0) > 0);
    const lossTrades = filteredTrades.filter((t) => (t.pnl ?? 0) <= 0);

    const calcAvgDuration = (list: TradeRecord[]) => {
      const durs = list
        .filter((t) => t.exitTime && t.entryTime)
        .map((t) => (t.exitTime ?? 0) - t.entryTime);
      return durs.length > 0 ? durs.reduce((sum, d) => sum + d, 0) / durs.length : 0;
    };

    return {
      sharpeRatio: parseFloat(sharpe.toFixed(2)),
      expectancy: parseFloat(expectancy.toFixed(2)),
      avgWinDuration: calcAvgDuration(winTrades),
      avgLossDuration: calcAvgDuration(lossTrades),
    };
  }, [filteredTrades, stats]);

  // Group by symbol for distribution bar charts
  const symbolBreakdown = useMemo(() => {
    const breakdown: Record<string, { pnl: number; count: number }> = {};
    filteredTrades.forEach((trade) => {
      if (!breakdown[trade.symbol]) {
        breakdown[trade.symbol] = { pnl: 0, count: 0 };
      }
      breakdown[trade.symbol].pnl += trade.pnl ?? 0;
      breakdown[trade.symbol].count += 1;
    });

    return Object.entries(breakdown)
      .map(([symbol, data]) => ({
        symbol,
        pnl: data.pnl,
        count: data.count,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [filteredTrades]);

  // Group by mood for emotional correlations
  const moodBreakdown = useMemo(() => {
    const breakdown: Record<string, { pnl: number; count: number }> = {};
    // Initialize default moods
    ['focused', 'confident', 'neutral', 'anxious', 'frustrated', 'euphoric'].forEach(
      (m) => {
        breakdown[m] = { pnl: 0, count: 0 };
      }
    );

    filteredTrades.forEach((trade) => {
      const mood = trade.journalEntry?.mood;
      if (mood && breakdown[mood] !== undefined) {
        breakdown[mood].pnl += trade.pnl ?? 0;
        breakdown[mood].count += 1;
      }
    });

    return Object.entries(breakdown)
      .map(([mood, data]) => ({
        mood: mood as Mood,
        pnl: data.pnl,
        count: data.count,
      }))
      .filter((d) => d.count > 0); // only show moods that have trade data
  }, [filteredTrades]);



  // Render Charts (Lightweight Charts)
  useEffect(() => {
    if (!equityContainerRef.current || !drawdownContainerRef.current) return;

    // 1. Initialize Equity Curve Chart
    const eqChart = createChart(equityContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', autoScale: true },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
      width: equityContainerRef.current.clientWidth,
      height: 320,
    });
    equityChartRef.current = eqChart;

    const eqSeries = eqChart.addSeries(AreaSeries, {
      topColor: 'rgba(99, 102, 241, 0.25)',
      bottomColor: 'rgba(99, 102, 241, 0.00)',
      lineColor: '#6366f1',
      lineWidth: 3,
      priceFormat: { type: 'price', precision: 2 },
    });
    equitySeriesRef.current = eqSeries;

    // 2. Initialize Drawdown Curve Chart
    const ddChart = createChart(drawdownContainerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', autoScale: true },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
      width: drawdownContainerRef.current.clientWidth,
      height: 320,
    });
    drawdownChartRef.current = ddChart;

    const ddSeries = ddChart.addSeries(AreaSeries, {
      topColor: 'rgba(239, 68, 68, 0.25)',
      bottomColor: 'rgba(239, 68, 68, 0.00)',
      lineColor: '#ef4444',
      lineWidth: 2,
      priceFormat: { type: 'percent', precision: 2 },
    });
    drawdownSeriesRef.current = ddSeries;

    // Resize handlers
    const handleResize = () => {
      if (equityContainerRef.current && eqChart) {
        eqChart.resize(equityContainerRef.current.clientWidth, 320);
      }
      if (drawdownContainerRef.current && ddChart) {
        ddChart.resize(drawdownContainerRef.current.clientWidth, 320);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(equityContainerRef.current);
    resizeObserver.observe(drawdownContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      eqChart.remove();
      ddChart.remove();
      equityChartRef.current = null;
      drawdownChartRef.current = null;
      equitySeriesRef.current = null;
      drawdownSeriesRef.current = null;
    };
  }, [filteredTrades.length > 0]);

  // Update Chart Data when filtered trades change
  useEffect(() => {
    const eqSeries = equitySeriesRef.current;
    const ddSeries = drawdownSeriesRef.current;

    if (!eqSeries || !ddSeries || filteredTrades.length === 0) return;

    // Construct curve points
    const equityPoints: { time: UTCTimestamp; value: number }[] = [];
    const drawdownPoints: { time: UTCTimestamp; value: number }[] = [];

    let currentBalance = INITIAL_BALANCE;
    let peak = currentBalance;
    let lastTime = 0;

    // Add initial base point (1 day prior to first trade close)
    const firstTradeTime = filteredTrades[0].exitTime || filteredTrades[0].entryTime;
    equityPoints.push({
      time: (firstTradeTime - 86400) as UTCTimestamp,
      value: INITIAL_BALANCE,
    });
    drawdownPoints.push({
      time: (firstTradeTime - 86400) as UTCTimestamp,
      value: 0,
    });

    filteredTrades.forEach((t) => {
      const closeTime = t.exitTime || t.entryTime;
      // Guarantee strictly increasing times in lightweight charts
      let cleanTime = closeTime;
      if (cleanTime <= lastTime) {
        cleanTime = lastTime + 1;
      }
      lastTime = cleanTime;

      // Update balance
      currentBalance += (t.pnl ?? 0) - (t.commission ?? 0) - (t.swap ?? 0);
      
      // Update Peak for drawdown
      if (currentBalance > peak) {
        peak = currentBalance;
      }

      // Drawdown percentage calculation
      const ddPercent = peak > 0 ? -((peak - currentBalance) / peak) * 100 : 0;

      equityPoints.push({
        time: cleanTime as UTCTimestamp,
        value: parseFloat(currentBalance.toFixed(2)),
      });

      drawdownPoints.push({
        time: cleanTime as UTCTimestamp,
        value: parseFloat(ddPercent.toFixed(2)),
      });
    });

    eqSeries.setData(equityPoints);
    ddSeries.setData(drawdownPoints);

    // Fit chart bounds
    equityChartRef.current?.timeScale().fitContent();
    drawdownChartRef.current?.timeScale().fitContent();
  }, [filteredTrades]);

  // Cognitive Biases & Performance Insights Logic (AI Feedback Module)
  const insights = useMemo(() => {
    const list: {
      type: 'success' | 'warning' | 'danger';
      title: string;
      text: string;
      icon: string;
    }[] = [];

    if (filteredTrades.length === 0) return [];

    // 1. Revenge Trading check
    // Look for consecutive losses within a tight time window (e.g. 2 hours / 7200 sec)
    let revengeCount = 0;
    for (let i = 1; i < filteredTrades.length; i++) {
      const prev = filteredTrades[i - 1];
      const curr = filteredTrades[i];
      const timeDiff = (curr.entryTime) - (prev.exitTime || prev.entryTime);
      if (
        (prev.pnl ?? 0) < 0 &&
        (curr.pnl ?? 0) < 0 &&
        timeDiff > 0 &&
        timeDiff <= 7200
      ) {
        revengeCount++;
      }
    }

    if (revengeCount >= 2) {
      list.push({
        type: 'danger',
        title: 'Revenge Trading Pattern Detected',
        text: `You entered consecutive trades within 2 hours of a loss ${revengeCount} times. This behavior indicates emotional impulse and trying to "make back" losses. Implement a mandatory 30-minute block on your execution platform after any loss.`,
        icon: '😡',
      });
    }

    // 2. Cutting Winners Short vs Holding Losers
    const winDur = advancedStats.avgWinDuration;
    const lossDur = advancedStats.avgLossDuration;
    if (winDur > 0 && lossDur > 0 && lossDur > winDur * 1.5) {
      list.push({
        type: 'warning',
        title: 'Holding Losers & Cutting Winners Short',
        text: `Your average losing trade is held ${formatDuration(lossDur)} compared to winning trades held for only ${formatDuration(winDur)} (${(
          lossDur / winDur
        ).toFixed(1)}x ratio). You are choking your trade setups and closing winners early due to fear, while hoping losing setups will bounce. Standardize your stop loss execution.`,
        icon: '⏳',
      });
    }

    // 3. Peak Emotional State
    const moodStats = moodBreakdown.sort((a, b) => b.pnl - a.pnl);
    if (moodStats.length > 0 && moodStats[0].pnl > 0) {
      const bestMood = moodStats[0];
      let moodVerb = 'focused';
      if (bestMood.mood === 'focused') moodVerb = 'focused & analytical';
      else if (bestMood.mood === 'confident') moodVerb = 'confident & structured';
      else if (bestMood.mood === 'neutral') moodVerb = 'neutral & objective';

      list.push({
        type: 'success',
        title: `Peak State: ${bestMood.mood.toUpperCase()}`,
        text: `Your highest net profit of ${formatCurrency(
          bestMood.pnl
        )} was generated on days where your journal mood was logged as "${moodVerb}". Focus on reproducing this cognitive setup before opening charts.`,
        icon: '🎯',
      });
    }

    // 4. Inconsistent Position Sizing
    const lotSizes = filteredTrades.map((t) => t.lotSize);
    const avgLot = lotSizes.reduce((s, l) => s + l, 0) / lotSizes.length;
    const lotVariance =
      lotSizes.reduce((s, l) => s + Math.pow(l - avgLot, 2), 0) / lotSizes.length;
    const lotStdDev = Math.sqrt(lotVariance);

    if (lotStdDev > avgLot * 0.5 && filteredTrades.length >= 5) {
      list.push({
        type: 'warning',
        title: 'Inconsistent Lot Sizing',
        text: `Your trade sizes vary wildly (Standard Deviation of ${lotStdDev.toFixed(
          2
        )} lots vs ${avgLot.toFixed(
          2
        )} average lot). Wild shifts in trade sizing disrupt probability curves; one large loss can wipe out multiple structured wins. Maintain uniform risk per trade (e.g. 1% constant size).`,
        icon: '⚖️',
      });
    }

    // 5. Positive Risk/Reward Expectancy Check
    if (stats.avgRiskReward < 1.0 && stats.winRate < 60) {
      list.push({
        type: 'danger',
        title: 'Negative Expectancy Risk',
        text: `Average risk/reward ratio is low (${stats.avgRiskReward.toFixed(
          2
        )}:1) combined with a ${stats.winRate.toFixed(
          1
        )}% win rate. Under current stats, your trading is mathematically unprofitable. Focus on letting your trades hit their designated targets rather than manually intervening.`,
        icon: '📉',
      });
    } else if (stats.avgRiskReward >= 1.5) {
      list.push({
        type: 'success',
        title: 'Healthy Risk-to-Reward Ratio',
        text: `Great discipline! Your average risk/reward ratio is ${stats.avgRiskReward.toFixed(
          2
        )}:1. This gives your account mathematically positive expectancy even at lower win rates. Maintain this structural trade management.`,
        icon: '🛡️',
      });
    }

    return list;
  }, [filteredTrades, stats, advancedStats, moodBreakdown]);

  // Auto-align calendar month/year when filteredTrades updates (e.g. user selects a backtest session)
  useEffect(() => {
    if (filteredTrades.length > 0) {
      const lastTrade = filteredTrades[filteredTrades.length - 1];
      const lastTradeDate = new Date((lastTrade.exitTime || lastTrade.entryTime) * 1000);
      const timer = setTimeout(() => {
        setCalendarYear(lastTradeDate.getUTCFullYear());
        setCalendarMonth(lastTradeDate.getUTCMonth());
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [filteredTrades]);

  // Monthly Calendar P&L Grid generator
  const calendarDays = useMemo(() => {
    const year = calendarYear;
    const month = calendarMonth; // 0-indexed

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // day of week (0-6)
    const totalDays = new Date(year, month + 1, 0).getDate();

    const daysList = [];

    // Pad offset cells
    for (let i = 0; i < startOffset; i++) {
      daysList.push({ day: null, pnl: 0, count: 0 });
    }

    // Populate actual days of the month
    for (let d = 1; d <= totalDays; d++) {
      // Sum trades P&L for this calendar day
      let dayPnl = 0;
      let dayCount = 0;

      filteredTrades.forEach((t) => {
        // Map close time to local calendar date
        const tDate = new Date((t.exitTime || t.entryTime) * 1000);
        // Compare using UTC metrics to match standard backend indexing safely
        const tYear = tDate.getUTCFullYear();
        const tMonth = tDate.getUTCMonth();
        const tDay = tDate.getUTCDate();
        if (tYear === year && tMonth === month && tDay === d) {
          dayPnl += t.pnl ?? 0;
          dayCount += 1;
        }
      });

      daysList.push({
        day: d,
        pnl: dayPnl,
        count: dayCount,
      });
    }

    return daysList;
  }, [filteredTrades, calendarYear, calendarMonth]);

  if (!mounted) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#080b12', color: '#94a3b8', alignItems: 'center', justifyContent: 'center' }} suppressHydrationWarning>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }} suppressHydrationWarning>
          <div className="spinner" suppressHydrationWarning />
          <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Loading performance console...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.analyticsContainer}>
      <div className={styles.contentArea}>
        {/* Top Header Filter Bar */}
        <header className={styles.topBar}>
          <div className={styles.titleArea}>
            <span className={styles.titleText}>Performance Analytics</span>
            {isFetching && (
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Syncing database...</span>
            )}
          </div>

          <div className={styles.filtersRow}>
            {/* Timeframe selector */}
            <Select
              className={styles.filterSelect}
              ariaLabel="Time range"
              value={timeRange}
              onChange={setTimeRange}
              style={{ minWidth: 140 }}
              options={[
                { value: 'all', label: 'All Time' },
                { value: '7d', label: 'Last 7 Days' },
                { value: '30d', label: 'Last 30 Days' },
                { value: '90d', label: 'Last 90 Days' },
                { value: 'mtd', label: 'Month to Date' },
              ]}
            />

            {/* Source selector */}
            <Select
              className={styles.filterSelect}
              ariaLabel="Trade source"
              value={sourceFilter}
              onChange={setSourceFilter}
              style={{ minWidth: 190 }}
              options={[
                { value: 'all', label: 'All Sources' },
                { value: 'live-all', label: 'Live / Sync Database' },
                { value: 'mt5', label: 'MetaTrader 5 Only' },
                { value: 'manual', label: 'Manual Entry Only' },
                { value: 'backtest-all', label: 'All Backtests Combined' },
                ...backtestSessions.map(session => ({
                  value: `backtest-session-${session.id}`,
                  label: `${session.name} (Backtest)`,
                })),
              ]}
            />

            {/* Symbol selector */}
            <Select
              className={styles.filterSelect}
              ariaLabel="Symbol"
              value={symbolFilter}
              onChange={setSymbolFilter}
              style={{ minWidth: 140 }}
              options={[
                { value: 'all', label: 'All Symbols' },
                ...uniqueSymbols.map((sym) => ({ value: sym, label: sym })),
              ]}
            />
          </div>
        </header>

        {/* Demo Data Mode Notification Banner */}
        {isDemoMode && (
          <div className={styles.demoBanner}>
            <div className={styles.demoText}>
              <span className={styles.demoBadge}>Demo Data</span>
              <span>
                Your trade records database is empty. Showing sample trades to preview performance tracking analytics.
              </span>
            </div>
            <button className={styles.clearDemoBtn} onClick={handleClearDemoMode}>
              Clear Fallback Data
            </button>
          </div>
        )}

        {/* Main Dashboard Panel */}
        {filteredTrades.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No Performance Data Found</div>
            <div className={styles.emptyDesc}>
              No trades match your current filters. Execute sample trade replays on the backtesting screen or link your live MT5 terminal accounts to generate performance curves.
            </div>
            <button className={styles.emptyBtn} onClick={() => { setIsDemoMode(true); setTrades(DEMO_TRADES); }}>
              Load Sample Dashboard
            </button>
          </div>
        ) : (
          /* Dashboard Workspace */
          <main className={styles.workspace}>
            {/* AI Performance Coach Section (dynamic-imported, self-contained state) */}
            <AiCoachCard
              key={`${sourceFilter}|${symbolFilter}|${timeRange}`}
              stats={stats}
              recentTrades={filteredTrades.slice(-10)}
              sourceName={activeSourceName}
            />

            {/* Bento Grid: Key Metrics */}
            <section className={styles.bentoGrid}>
              {/* Card 1: Net profit */}
              <div
                className={`${styles.bentoCard} ${
                  stats.netPnl >= 0 ? styles.profitCard : styles.lossCard
                }`}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>Net P&L</span>
                  <span className={styles.cardIcon}>💰</span>
                </div>
                <div
                  className={`${styles.cardVal} ${
                    stats.netPnl >= 0 ? styles.profitVal : styles.lossVal
                  }`}
                >
                  <CountUp value={stats.netPnl} format={formatCurrency} />
                </div>
                <div className={styles.cardSub} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span>
                    Account Growth:{' '}
                    <span className={stats.netPnl >= 0 ? styles.profitVal : styles.lossVal}>
                      {stats.netPnl >= 0 ? '+' : ''}
                      {((stats.netPnl / INITIAL_BALANCE) * 100).toFixed(2)}%
                    </span>
                  </span>
                  <Sparkline
                    data={equitySpark}
                    color={stats.netPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
                  />
                </div>
              </div>

              {/* Card 2: Win Rate */}
              <div className={styles.bentoCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>Win Rate</span>
                  <span className={styles.cardIcon}>🎯</span>
                </div>
                <div className={styles.cardVal}>
                  <CountUp value={stats.winRate} format={formatPercent} />
                </div>
                <div className={styles.cardSub}>
                  Total Wins:{' '}
                  <span className={styles.subHighlight}>{stats.winCount}</span> / Losses:{' '}
                  <span className={styles.subHighlight}>{stats.lossCount}</span>
                </div>
              </div>

              {/* Card 3: Profit Factor */}
              <div className={styles.bentoCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>Profit Factor</span>
                  <span className={styles.cardIcon}>📊</span>
                </div>
                <div className={styles.cardVal}>
                  {stats.profitFactor === Infinity ? (
                    '∞'
                  ) : (
                    <CountUp value={stats.profitFactor} format={(n) => n.toFixed(2)} />
                  )}
                </div>
                <div className={styles.cardSub}>
                  Gross Profit:{' '}
                  <span className={styles.profitVal}>{formatCurrency(stats.grossProfit)}</span>
                </div>
              </div>

              {/* Card 4: Expectancy / Sharpe */}
              <div className={styles.bentoCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>Expectancy</span>
                  <span className={styles.cardIcon}>📈</span>
                </div>
                <div className={styles.cardVal}>
                  <CountUp
                    value={advancedStats.expectancy}
                    format={(n) => `${n >= 0 ? '+' : ''}${formatCurrency(n)}`}
                  />
                </div>
                <div className={styles.cardSub}>
                  Sharpe Ratio: <span className={styles.subHighlight}>{advancedStats.sharpeRatio}</span>
                </div>
              </div>

              {/* Card 5: Max Drawdown */}
              <div className={styles.bentoCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>Max Drawdown</span>
                  <span className={styles.cardIcon}>⚠️</span>
                </div>
                <div className={styles.cardVal} style={{ color: 'var(--color-loss)' }}>
                  <CountUp value={stats.maxDrawdown} format={(n) => `-${formatCurrency(n)}`} />
                </div>
                <div className={styles.cardSub}>
                  Peak Drop:{' '}
                  <span style={{ color: 'var(--color-loss)' }}>
                    -{stats.maxDrawdownPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </section>

            {/* Equity and Drawdown charts */}
            <section className={styles.chartsSection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <span>📈</span> Equity & Risk Curve Analysis
                </h3>
              </div>

              <div className={styles.chartGrid}>
                {/* Equity Curve */}
                <div className={styles.chartContainer}>
                  <h4 className={styles.chartTitle}>Equity Growth Curve ($)</h4>
                  <div ref={equityContainerRef} className={styles.chartWrapper} />
                </div>

                {/* Drawdown Curve */}
                <div className={styles.chartContainer}>
                  <h4 className={styles.chartTitle}>Account Drawdown Curve (%)</h4>
                  <div ref={drawdownContainerRef} className={styles.chartWrapper} />
                </div>
              </div>
            </section>

            {/* AI Cognitive Bias Feedback Module */}
            <section className={styles.insightsContainer}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <span>🧠</span> AI Cognitive & Risk Feedback
                </h3>
              </div>

              <div className={styles.insightsGrid}>
                {insights.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', gridColumn: 'span 3' }}>
                    Need at least 5 trade entries to isolate behavioral bias and cognitive feedback loops.
                  </div>
                ) : (
                  insights.map((insight, idx) => (
                    <div
                      key={idx}
                      className={`${styles.insightCard} ${
                        insight.type === 'danger'
                          ? styles.danger
                          : insight.type === 'warning'
                          ? styles.warning
                          : styles.success
                      }`}
                    >
                      <div className={styles.insightHeader}>
                        <span className={styles.insightIcon}>{insight.icon}</span>
                        <span className={styles.insightTitle}>{insight.title}</span>
                      </div>
                      <p className={styles.insightText}>{insight.text}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Details Breakdown (Symbols, Streaks, Durations) */}
            <section className={styles.breakdownGrid}>
              {/* Left Bento: Symbol Breakdown */}
              <div className={styles.breakdownCard}>
                <h4 className={styles.chartTitle}>Performance by Instrument</h4>

                <div className={styles.symbolList}>
                  {symbolBreakdown.map((item) => {
                    // Find max absolute pnl to determine bar widths
                    const maxPnl = Math.max(...symbolBreakdown.map((s) => Math.abs(s.pnl)));
                    const barWidth = maxPnl > 0 ? (Math.abs(item.pnl) / maxPnl) * 100 : 0;

                    return (
                      <div key={item.symbol} className={styles.symbolRow}>
                        <span className={styles.symbolBadge}>{item.symbol}</span>
                        <div className={styles.progressTrack}>
                          <div
                            className={`${styles.progressFill} ${
                              item.pnl >= 0 ? styles.profit : styles.loss
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span
                          className={`${styles.rowPnl} ${
                            item.pnl >= 0 ? styles.profitVal : styles.lossVal
                          }`}
                        >
                          {formatCurrency(item.pnl)} ({item.count}t)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Bento: Streaks & Durations */}
              <div className={styles.breakdownCard}>
                <h4 className={styles.chartTitle}>Trading Discipline Metrics</h4>

                <div className={styles.statsList}>
                  {/* Streak Wins */}
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Best Winning Streak</span>
                    <span className={styles.statVal} style={{ color: 'var(--color-profit)' }}>
                      {stats.consecutiveWins} Trades
                    </span>
                  </div>

                  {/* Streak Losses */}
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Max Consecutive Losses</span>
                    <span className={styles.statVal} style={{ color: 'var(--color-loss)' }}>
                      {stats.consecutiveLosses} Trades
                    </span>
                  </div>

                  {/* Average Win size */}
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Avg Profit / Trade</span>
                    <span className={styles.statVal} style={{ color: 'var(--color-profit)' }}>
                      {formatCurrency(stats.avgWin)}
                    </span>
                  </div>

                  {/* Average Loss size */}
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Avg Loss / Trade</span>
                    <span className={styles.statVal} style={{ color: 'var(--color-loss)' }}>
                      {formatCurrency(stats.avgLoss)}
                    </span>
                  </div>

                  {/* Average Win Hold Time */}
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Avg Win Duration</span>
                    <span className={styles.statVal}>
                      {formatDuration(advancedStats.avgWinDuration)}
                    </span>
                  </div>

                  {/* Average Loss Hold Time */}
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Avg Loss Duration</span>
                    <span className={styles.statVal}>
                      {formatDuration(advancedStats.avgLossDuration)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Mood Correlations & Monthly Heatmap */}
            <section className={styles.breakdownGrid}>
              {/* Left Bento: Mood Correlations */}
              <div className={styles.breakdownCard}>
                <h4 className={styles.chartTitle}>Journal Mood Correlations</h4>

                <div className={styles.moodBreakdownGrid}>
                  {moodBreakdown.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center', gridColumn: 'span 2' }}>
                      No linked daily journal moods found. Log daily entries with moods and link trades to view correlation curves.
                    </div>
                  ) : (
                    moodBreakdown.map((item) => {
                      const moodEmoji =
                        item.mood === 'focused'
                          ? '🎯'
                          : item.mood === 'confident'
                          ? '💪'
                          : item.mood === 'neutral'
                          ? '😐'
                          : item.mood === 'anxious'
                          ? '😰'
                          : item.mood === 'frustrated'
                          ? '😡'
                          : '🤑';

                      return (
                        <div key={item.mood} className={styles.moodCard}>
                          <span className={styles.moodEmoji}>{moodEmoji}</span>
                          <span className={styles.moodLabel}>{item.mood.toUpperCase()}</span>
                          <span className={styles.moodCount}>{item.count} Trades</span>
                          <span
                            className={`${styles.moodPnl} ${
                              item.pnl >= 0 ? styles.profitVal : styles.lossVal
                            }`}
                          >
                            {formatCurrency(item.pnl)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Bento: Monthly Heatmap Calendar */}
              <div className={styles.breakdownCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 className={styles.chartTitle} style={{ margin: 0 }}>
                    Daily P&L Heatmap
                  </h4>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Select
                      ariaLabel="Calendar month"
                      value={String(calendarMonth)}
                      onChange={(v) => setCalendarMonth(parseInt(v, 10))}
                      style={{ minWidth: 84 }}
                      options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => ({
                        value: String(idx),
                        label: m,
                      }))}
                    />
                    <Select
                      ariaLabel="Calendar year"
                      value={String(calendarYear)}
                      onChange={(v) => setCalendarYear(parseInt(v, 10))}
                      style={{ minWidth: 92 }}
                      options={Array.from({ length: 16 }, (_, i) => 2015 + i).map((y) => ({
                        value: String(y),
                        label: String(y),
                      }))}
                    />
                  </div>
                </div>

                <div className={styles.calendarWrapper}>
                  <div className={styles.calendarGrid}>
                    {/* Header days */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className={styles.calendarHeaderCell}>
                        {d}
                      </div>
                    ))}

                    {/* Cells */}
                    {calendarDays.map((cell, idx) => (
                      <div
                        key={idx}
                        className={`${styles.calendarCell} ${
                          cell.day === null
                            ? ''
                            : cell.count === 0
                            ? ''
                            : cell.pnl >= 0
                            ? styles.cellProfit
                            : styles.cellLoss
                        }`}
                      >
                        <span className={styles.cellDayNum}>{cell.day}</span>
                        {cell.day !== null && cell.count > 0 && (
                          <span className={styles.cellPnl}>
                            {cell.pnl >= 0 ? '+' : ''}
                            {Math.round(cell.pnl)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
