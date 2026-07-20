'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import Select from '@/components/ui/Select';
import { SYMBOLS, getSymbolConfig, calculatePnL, calculatePnLPips, calculateUnrealizedPnL, calculateBacktestStats, formatCurrency, formatPips, formatPercent, formatPrice, generateId, formatDuration } from '@/lib/trade-math';
import { normalizeChartCandles, debugLogCandles } from '@/lib/chart-engine';
import type { CandleData, ChartMarker, OpenPosition, TradeRecord, BacktestStats, OHLCDisplay, Timeframe, TradeType, ChartSettings } from '@/types';
import { DEFAULT_CHART_SETTINGS } from '@/types';
import { ChartSettingsModal } from '@/components/backtest/ChartSettingsModal';
import styles from './backtest.module.css';

// Phase 2 Drawing & Indicator imports
import type { SerializedDrawing } from 'lightweight-charts-drawing';
import DrawingToolbar from '@/components/backtest/DrawingToolbar';
import { INDICATORS_REGISTRY, type ActiveIndicator } from '@/components/backtest/indicator-registry';
import { parseHistDataCSV } from '@/lib/csv-parser';
import { aggregateCandles, TIMEFRAME_SECONDS } from '@/lib/aggregator';
import { drawingsShallowEqual } from '@/lib/drawing-utils';
import PlaybackControls from '@/components/backtest/panels/PlaybackControls';
import OrderPanel from '@/components/backtest/panels/OrderPanel';
import PositionsSidebar from '@/components/backtest/panels/PositionsSidebar';
import OpenPositionsTable from '@/components/backtest/panels/OpenPositionsTable';
import TradeHistoryTable from '@/components/backtest/panels/TradeHistoryTable';
import TabsHeader from '@/components/backtest/panels/TabsHeader';

// Heavy modal panels are loaded on demand — they are closed by default and
// don't need to be in the initial route bundle.
const IndicatorPanel = dynamic(() => import('@/components/backtest/IndicatorPanel'), { ssr: false });
const ObjectTreePanel = dynamic(() => import('@/components/backtest/ObjectTreePanel'), { ssr: false });

// Dynamic import of the Chart component to prevent SSR errors (Lightweight Charts uses window/ResizeObserver)
const Chart = dynamic(() => import('@/components/backtest/Chart'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', backgroundColor: '#0a0e17' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div className="spinner" />
        <span>Initializing TradingView Engine...</span>
      </div>
    </div>
  ),
});

// ============================================
// CONSTANTS
// ============================================

const TIMEFRAMES: { key: Timeframe; label: string; minutes: number }[] = [
  { key: '1m', label: '1M', minutes: 1 },
  { key: '5m', label: '5M', minutes: 5 },
  { key: '15m', label: '15M', minutes: 15 },
  { key: '30m', label: '30M', minutes: 30 },
  { key: '1H', label: '1H', minutes: 60 },
  { key: '4H', label: '4H', minutes: 240 },
  { key: '1D', label: '1D', minutes: 1440 },
];

const LEVERAGE_OPTIONS = ['1:1', '1:10', '1:50', '1:100', '1:200', '1:500'];
const INITIAL_VISIBLE_CANDLES = 50;

const CSV_TIMEZONES = [
  { label: 'UTC-12', offset: -720 },
  { label: 'UTC-11', offset: -660 },
  { label: 'UTC-10', offset: -600 },
  { label: 'UTC-9', offset: -540 },
  { label: 'UTC-8 (PST)', offset: -480 },
  { label: 'UTC-7 (MST)', offset: -420 },
  { label: 'UTC-6 (CST)', offset: -360 },
  { label: 'UTC-5 (EST)', offset: -300 },
  { label: 'UTC-4 (EDT/New York)', offset: -240 },
  { label: 'UTC-3', offset: -180 },
  { label: 'UTC-2', offset: -120 },
  { label: 'UTC-1', offset: -60 },
  { label: 'UTC', offset: 0 },
  { label: 'UTC+1 (CET)', offset: 60 },
  { label: 'UTC+2 (EET)', offset: 120 },
  { label: 'UTC+3 (MSK)', offset: 180 },
  { label: 'UTC+4', offset: 240 },
  { label: 'UTC+5', offset: 300 },
  { label: 'UTC+5:30 (IST - India)', offset: 330 },
  { label: 'UTC+6', offset: 360 },
  { label: 'UTC+7', offset: 420 },
  { label: 'UTC+8 (SGT/AWST)', offset: 480 },
  { label: 'UTC+9 (JST)', offset: 540 },
  { label: 'UTC+9:30 (ACST)', offset: 570 },
  { label: 'UTC+10 (AEST)', offset: 600 },
  { label: 'UTC+11', offset: 660 },
  { label: 'UTC+12', offset: 720 },
];

const DISPLAY_TIMEZONES = [
  { label: 'UTC', value: 'UTC' },
  { label: 'Local Time', value: 'Local' },
  { label: 'New York (EST/EDT)', value: 'America/New_York' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'Paris (CET/CEST)', value: 'Europe/Paris' },
  { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'Sydney (AEST/AEDT)', value: 'Australia/Sydney' },
  { label: 'Singapore (SGT)', value: 'Asia/Singapore' },
  { label: 'Kolkata / Mumbai (IST)', value: 'Asia/Kolkata' },
  { label: 'Dubai (GST)', value: 'Asia/Dubai' },
];

// (Pure utility functions are imported from '@/lib/csv-parser' and '@/lib/aggregator')

function normalizeCandles(value: unknown): CandleData[] {
  return normalizeChartCandles(value);
}

function getInitialReplayIndex(candles: CandleData[]): number {
  return Math.max(0, Math.min(INITIAL_VISIBLE_CANDLES, candles.length) - 1);
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function BacktestPage() {
  const confirmDialog = useConfirm();
  const [mounted, setMounted] = useState<boolean>(false);
  const [isGlobalNavCollapsed, setIsGlobalNavCollapsed] = useState<boolean>(true);
  const [isTerminalHeaderCollapsed, setIsTerminalHeaderCollapsed] = useState<boolean>(false);

  // ---- SESSION MODE ----
  type SessionStatus = 'setup' | 'active';
  type DataSourceMode = 'server' | 'upload' | 'python';

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('setup');

  useEffect(() => {
    if (sessionStatus === 'active' && isGlobalNavCollapsed) {
      document.body.classList.add('navigation-collapsed');
    } else {
      document.body.classList.remove('navigation-collapsed');
    }
    return () => {
      document.body.classList.remove('navigation-collapsed');
    };
  }, [sessionStatus, isGlobalNavCollapsed]);

  // ---- DB PERSISTENCE STATES ----
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [activeTab, setActiveTab] = useState<'positions' | 'trades' | 'analysis'>('positions');

  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/backtest/sessions');
      const json = await res.json();
      if (json.success) {
        setSavedSessions(json.data);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      fetchSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // ---- WIZARD STATE (Setup Mode) ----
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [sessionName, setSessionName] = useState<string>('Backtest Session #1');
  const [startingBalance, setStartingBalance] = useState<number>(10000);
  const [leverage, setLeverage] = useState<string>('1:100');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('XAUUSD');
  const [dataSource, setDataSource] = useState<DataSourceMode>('server');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [csvPreviewInfo, setCsvPreviewInfo] = useState<{ rows: number; dateRange: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localCsvPath, setLocalCsvPath] = useState<string>('');
  const [engineType, setEngineType] = useState<'browser' | 'python'>('python');

  // Raw M1 candles for upload mode — used for timeframe re-aggregation
  const [rawM1Candles, setRawM1Candles] = useState<CandleData[]>([]);

  // ---- ACTIVE MODE STATE ----
  const [symbol, setSymbol] = useState<string>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');

  // Market data state
  const [allCandles, setAllCandles] = useState<CandleData[]>([]);
  const [visibleCandles, setVisibleCandles] = useState<CandleData[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(49);

  // Replay wall timestamp — the exact point in time the user has reached
  // Used as source of truth when switching timeframes
  const [replayTimestamp, setReplayTimestamp] = useState<number>(0);

  // Replay playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(500);
  const [isZoomLocked, setIsZoomLocked] = useState<boolean>(true);

  // Trading state
  const [balance, setBalance] = useState<number>(10000);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [closedTrades, setClosedTrades] = useState<TradeRecord[]>([]);
  const [markers, setMarkers] = useState<ChartMarker[]>([]);

  // Input states
  const [lotSize, setLotSize] = useState<number>(1.0);
  const [stopLossInput, setStopLossInput] = useState<string>('');
  const [takeProfitInput, setTakeProfitInput] = useState<string>('');

  // Crosshair / hover metrics
  const [hoverOhlc, setHoverOhlc] = useState<OHLCDisplay | null>(null);

  // Position Modification & Close State
  const [activeCloseMenuId, setActiveCloseMenuId] = useState<string | null>(null);
  const [partialClosePercent, setPartialClosePercent] = useState<number>(50);
  const [editingSLId, setEditingSLId] = useState<string | null>(null);
  const [editingTPId, setEditingTPId] = useState<string | null>(null);
  const [tempSL, setTempSL] = useState<string>('');
  const [tempTP, setTempTP] = useState<string>('');

  // Chart Display Settings
  const [chartSettings, setChartSettings] = useState<ChartSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tradingbook_chart_settings');
      if (saved) {
        try {
          return { ...DEFAULT_CHART_SETTINGS, ...JSON.parse(saved) };
        } catch (e) {
          return DEFAULT_CHART_SETTINGS;
        }
      }
    }
    return DEFAULT_CHART_SETTINGS;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tradingbook_chart_settings', JSON.stringify(chartSettings));
    }
  }, [chartSettings]);

  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (isSettingsOpen && settingsBtnRef.current) {
      const rect = settingsBtnRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 6,
        left: rect.right + window.scrollX - 220,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [isSettingsOpen]);

  // Timer reference for playback
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const visibleCandlesRef = useRef<CandleData[]>([]);
  const openPositionsRef = useRef<OpenPosition[]>([]);
  const closedTradesRef = useRef<TradeRecord[]>([]);
  const currentIndexRef = useRef<number>(49);
  const allCandlesRef = useRef<CandleData[]>([]);
  const balanceRef = useRef<number>(10000);
  const markersRef = useRef<ChartMarker[]>([]);
  const timeframeRef = useRef<Timeframe>('15m');
  const replayTimestampRef = useRef<number>(0);

  // Sync refs with state to use in event loops without stale state
  useEffect(() => { visibleCandlesRef.current = visibleCandles; }, [visibleCandles]);
  useEffect(() => { openPositionsRef.current = openPositions; }, [openPositions]);
  useEffect(() => { closedTradesRef.current = closedTrades; }, [closedTrades]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { allCandlesRef.current = allCandles; }, [allCandles]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { markersRef.current = markers; }, [markers]);
  useEffect(() => { timeframeRef.current = timeframe; }, [timeframe]);
  useEffect(() => { replayTimestampRef.current = replayTimestamp; }, [replayTimestamp]);

  // Dynamically calculate final chart markers, appending a "Replay Start" indicator at the session starting candle
  const finalMarkers = useMemo(() => {
    if (allCandles.length === 0) return markers;
    const initialIndex = getInitialReplayIndex(allCandles);
    if (initialIndex < allCandles.length) {
      const startCandle = allCandles[initialIndex];
      const startMarker: ChartMarker = {
        time: startCandle.time,
        position: 'belowBar',
        color: '#7c4dff', // Premium purple start marker
        shape: 'arrowUp',
        text: 'Replay Start',
      };
      // Prevent duplicates
      const hasStartMarker = markers.some(m => m.time === startCandle.time && m.text === 'Replay Start');
      if (!hasStartMarker) {
        return [startMarker, ...markers];
      }
    }
    return markers;
  }, [markers, allCandles]);

  // ---- DRAWINGS & INDICATORS STATE & REFS ----
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<SerializedDrawing[]>([]);
  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicator[]>([]);
  const [isIndicatorPanelOpen, setIsIndicatorPanelOpen] = useState<boolean>(false);

  const drawingsRef = useRef<SerializedDrawing[]>([]);
  const activeIndicatorsRef = useRef<ActiveIndicator[]>([]);

  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);
  useEffect(() => { activeIndicatorsRef.current = activeIndicators; }, [activeIndicators]);

  const [chartType, setChartType] = useState<'Candles' | 'HeikinAshi' | 'Line' | 'Area' | 'Bars'>('Candles');
  const [isObjectTreeOpen, setIsObjectTreeOpen] = useState<boolean>(false);
  const chartComponentRef = useRef<any>(null);

  // Timezone and Upgrade States
  const [csvTimezoneOffset, setCsvTimezoneOffset] = useState<number>(-240); // default UTC-4 New York
  const [displayTimezone, setDisplayTimezone] = useState<string>('UTC');
  const [isMagnetMode, setIsMagnetMode] = useState<boolean>(false);
  const [isJumpToBarActive, setIsJumpToBarActive] = useState<boolean>(false);
  const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState<boolean>(false);
  const [isTradePanelCollapsed, setIsTradePanelCollapsed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const onFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
    };
  }, []);

  // Drawing undo/redo stack states
  const [drawingsHistory, setDrawingsHistory] = useState<SerializedDrawing[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const historyIndexRef = useRef<number>(-1);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Mobile order panel slide-over state
  const [isOrderPanelOpen, setIsOrderPanelOpen] = useState<boolean>(false);

  // Mobile bottom sheet drag state
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState<boolean>(false);
  const [bottomSheetTouchStart, setBottomSheetTouchStart] = useState<number | null>(null);

  const handleBottomSheetTouchStart = useCallback((e: React.TouchEvent) => {
    setBottomSheetTouchStart(e.touches[0].clientY);
  }, []);

  const handleBottomSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (bottomSheetTouchStart === null) return;
    const delta = bottomSheetTouchStart - e.touches[0].clientY;
    if (Math.abs(delta) > 40) {
      setIsBottomSheetExpanded(delta > 0);
      setBottomSheetTouchStart(null);
    }
  }, [bottomSheetTouchStart]);

  const handleBottomSheetTouchEnd = useCallback(() => {
    setBottomSheetTouchStart(null);
  }, []);

  const toggleBottomSheet = useCallback(() => {
    setIsBottomSheetExpanded(prev => !prev);
  }, []);


  // ============================================
  // WIZARD HANDLERS
  // ============================================

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      processUploadedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const processUploadedFile = async (file: File) => {
    setUploadedFile(file);
    setDataSource('upload');
    setCsvPreviewInfo(null);
    // Quick scan first 500 lines to show date range preview
    try {
      const chunk = await file.slice(0, 40000).text(); // read first ~40KB
      const lines = chunk.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        // detect first and last valid timestamps
        const parseTs = (line: string): number | null => {
          const parts = line.split(',').map((p) => p.trim());
          if (parts.length < 6) return null;
          const dp = parts[0].split('.');
          if (dp.length === 3) {
            const tp = (parts[1] || '00:00').split(':');
            const ts = Date.UTC(+dp[0], +dp[1]-1, +dp[2], +tp[0]||0, +tp[1]||0, 0);
            return isNaN(ts) ? null : ts / 1000;
          }
          return null;
        };
        const firstTs = parseTs(lines[0]);
        const firstDate = firstTs ? new Date(firstTs * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '?';
        setCsvPreviewInfo({ rows: -1, dateRange: `Starts ${firstDate}` });
      }
    } catch (_) {
      // ignore preview errors
    }
  };

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAutoSaveRef = useRef<(() => Promise<void>) | null>(null);

  const performAutoSave = async (
    bal: number,
    idx: number,
    openPos: OpenPosition[],
    closedT: TradeRecord[],
    tf: Timeframe,
    mkrs: ChartMarker[],
    candles?: CandleData[]
  ) => {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;
    try {
      await fetch(`/api/backtest/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentBalance: bal,
          currentIndex: idx,
          openPositions: openPos,
          closedTrades: closedT,
          markers: mkrs,
          timeframe: tf,
          drawings: drawingsRef.current,
          activeIndicators: activeIndicatorsRef.current,
          ...(candles ? { allCandles: candles } : {}),
        }),
      });
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  };

  // Debounced auto-save: serializing positions/trades/markers/drawings with
  // JSON.stringify on every candle step stutters the replay. Rapid calls
  // collapse into one trailing save with the latest snapshot (800ms quiet
  // period). Saves that include full candle data (session/timeframe changes)
  // flush immediately since they must not be lost or coalesced away.
  const autoSave = (
    bal: number,
    idx: number,
    openPos: OpenPosition[],
    closedT: TradeRecord[],
    tf: Timeframe,
    mkrs: ChartMarker[],
    candles?: CandleData[]
  ) => {
    if (candles) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      pendingAutoSaveRef.current = null;
      void performAutoSave(bal, idx, openPos, closedT, tf, mkrs, candles);
      return;
    }
    pendingAutoSaveRef.current = () => performAutoSave(bal, idx, openPos, closedT, tf, mkrs);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      const run = pendingAutoSaveRef.current;
      pendingAutoSaveRef.current = null;
      if (run) void run();
    }, 800);
  };

  // Flush any pending debounced save on unmount so progress isn't lost
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      const run = pendingAutoSaveRef.current;
      pendingAutoSaveRef.current = null;
      if (run) void run();
    };
  }, []);


  const handleSaveSession = async () => {
    if (!activeSessionId) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/backtest/sessions/${activeSessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentBalance: balance,
          currentIndex: currentIndexRef.current,
          openPositions: openPositionsRef.current,
          closedTrades: closedTradesRef.current,
          markers: markers,
          timeframe: timeframe,
          drawings: drawings,
          activeIndicators: activeIndicators,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        // Refresh sessions list
        fetchSessions();
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Error saving session:', err);
      setSaveStatus('error');
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/backtest/sessions/${sessionId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to load session');
      }

      const session = json.data;
      const dbAllCandles = normalizeCandles(session.allCandles);
      const isPythonSession = session.dataSource === 'python' || session.name.includes('(Python)');
      if (dbAllCandles.length === 0 && !isPythonSession) {
        throw new Error('This saved session does not contain valid candle data.');
      }
      const dbOpenPositions = session.openPositions as OpenPosition[];
      const dbClosedTrades = session.closedTrades as TradeRecord[];
      const dbMarkers = session.markers as ChartMarker[];
      const dbDrawings = (session.drawings || []) as SerializedDrawing[];
      const dbIndicators = (session.activeIndicators || []) as ActiveIndicator[];

      setActiveSessionId(session.id);
      setSessionName(session.name);
      setSymbol(session.symbol);
      setSelectedSymbol(session.symbol);
      setTimeframe(session.timeframe as Timeframe);
      setDataSource(session.dataSource as DataSourceMode);
      setStartDate(session.startDate || '');
      setEndDate(session.endDate || '');
      setStartingBalance(session.initialBalance);
      setLeverage(session.leverage);
      
      setAllCandles(dbAllCandles);
      const restoredIndex = dbAllCandles.length > 0
        ? Math.max(0, Math.min(Number(session.currentIndex) || 0, dbAllCandles.length - 1))
        : 0;
      setVisibleCandles(dbAllCandles.length > 0 ? dbAllCandles.slice(0, restoredIndex + 1) : []);
      setCurrentIndex(restoredIndex);
      // Restore replay wall timestamp from the restored candle position
      if (dbAllCandles.length > 0 && restoredIndex < dbAllCandles.length) {
        const resTf = (session.timeframe as Timeframe) || '15m';
        const resTfSecs = TIMEFRAME_SECONDS[resTf] || 900;
        setReplayTimestamp(dbAllCandles[restoredIndex].time + resTfSecs - 60);
      }
      setBalance(session.currentBalance);
      setOpenPositions(dbOpenPositions);
      setClosedTrades(dbClosedTrades);
      setMarkers(dbMarkers);
      setDrawings(dbDrawings);
      drawingsRef.current = dbDrawings;
      setDrawingsHistory([dbDrawings]);
      setHistoryIndex(0);
      setActiveIndicators(dbIndicators);
      activeIndicatorsRef.current = dbIndicators;
      setStopLossInput('');
      setTakeProfitInput('');
      setIsPlaying(false);
      
      setSessionStatus('active');
    } catch (err: any) {
      console.error('Error resuming session:', err);
      toast.error(`Error resuming session: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const ok = await confirmDialog({
      title: 'Delete saved session?',
      message: 'This will permanently remove the session and its saved progress.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/backtest/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          handleEndSession();
        }
      } else {
        toast.error(json.error || 'Failed to delete session');
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const handleLaunchSession = async () => {
    setIsLoading(true);

    try {
      let candles: CandleData[] = [];

      if (dataSource === 'server') {
        // Fetch aggregated candles from server API
        const params = new URLSearchParams({
          symbol: selectedSymbol,
          start: startDate,
          end: endDate,
          timeframe: timeframe,
          tzOffset: csvTimezoneOffset.toString(),
        });
        const res = await fetch(`/api/market-data?${params.toString()}`);
        const json = await res.json();
        if (!res.ok || json.success === false) {
          throw new Error(json.error || `Failed to fetch market data (${res.status})`);
        }
        candles = normalizeCandles(json.data ?? json.candles);
        debugLogCandles(candles, 'Server candles');

        // Also fetch raw M1 candles for client-side timeframe re-aggregation
        try {
          const m1Params = new URLSearchParams({
            symbol: selectedSymbol,
            start: startDate,
            end: endDate,
            timeframe: '1m',
            tzOffset: csvTimezoneOffset.toString(),
          });
          const m1Res = await fetch(`/api/market-data?${m1Params.toString()}`);
          const m1Json = await m1Res.json();
          if (m1Res.ok && (m1Json.data || m1Json.candles)) {
            const m1Data = normalizeCandles(m1Json.data ?? m1Json.candles);
            console.log('[BacktestEngine] Cached M1 candles for TF switching:', m1Data.length);
            setRawM1Candles(m1Data);
          }
        } catch (m1Err) {
          console.warn('[BacktestEngine] M1 cache fetch failed (TF switching will use API fallback):', m1Err);
        }
      } else {
        // Parse uploaded CSV
        if (!uploadedFile) {
          toast.info('Please upload a CSV file first.');
          setIsLoading(false);
          return;
        }
        
        console.log('[BacktestEngine] Reading CSV file:', uploadedFile.name);
        const text = await uploadedFile.text();
        console.log('[BacktestEngine] CSV text length:', text.length);
        
        const m1Candles = parseHistDataCSV(text, csvTimezoneOffset);
        console.log('[BacktestEngine] Parsed M1 candles:', m1Candles.length);
        debugLogCandles(m1Candles, 'Parsed M1 candles');
        
        if (m1Candles.length === 0) {
          toast.error('No valid candle data found in the CSV file. Please check the format.');
          setIsLoading(false);
          return;
        }
        
        setRawM1Candles(m1Candles);
        const aggregated = aggregateCandles(m1Candles, timeframe);
        console.log('[BacktestEngine] Aggregated candles:', aggregated.length, 'for timeframe:', timeframe);
        debugLogCandles(aggregated, `Aggregated ${timeframe} candles`);
        
        candles = normalizeCandles(aggregated);
        debugLogCandles(candles, 'Normalized aggregated candles');
      }

      if (candles.length === 0) {
        console.error('[BacktestEngine] No candles after processing');
        toast.error('No candle data received. Please check your date range or data source.');
        setIsLoading(false);
        return;
      }

      console.log('[BacktestEngine] Final candles ready:', candles.length);
      debugLogCandles(candles, 'Final chart candles');

      // Create session in DB
      const sessionRes = await fetch('/api/backtest/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName,
          symbol: selectedSymbol,
          timeframe: timeframe,
          dataSource: dataSource,
          startDate: startDate || null,
          endDate: endDate || null,
          initialBalance: startingBalance,
          leverage,
          allCandles: candles,
          currentIndex: getInitialReplayIndex(candles),
        }),
      });
      const sessionJson = await sessionRes.json();
      if (!sessionJson.success) {
        throw new Error(sessionJson.error || 'Failed to create database session');
      }

      const dbSession = sessionJson.data;
      setActiveSessionId(dbSession.id);

      // Set active state with all candles
      setSymbol(selectedSymbol);
      setAllCandles(candles);
      const initialIndex = getInitialReplayIndex(candles);
      console.log('[BacktestEngine] Setting visible candles from 0 to', initialIndex + 1, 'of', candles.length);
      setVisibleCandles(candles.slice(0, initialIndex + 1));
      setCurrentIndex(initialIndex);
      // Set initial replay wall timestamp
      const tfSecs = TIMEFRAME_SECONDS[timeframe] || 900;
      setReplayTimestamp(candles[initialIndex].time + tfSecs - 60);
      setBalance(startingBalance);
      setOpenPositions([]);
      setClosedTrades([]);
      setMarkers([]);
      setDrawings([]);
      drawingsRef.current = [];
      setDrawingsHistory([[]]);
      setHistoryIndex(0);
      setActiveIndicators([]);
      activeIndicatorsRef.current = [];
      setStopLossInput('');
      setTakeProfitInput('');
      setIsPlaying(false);
      setSessionStatus('active');
      
      // Refresh saved sessions list
      fetchSessions();
    } catch (err) {
      console.error('[BacktestEngine] Error launching session:', err);
      toast.error(`Error launching session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchPythonSession = async () => {
    setIsLoading(true);
    try {
      let finalCsvPath = '';

      if (dataSource === 'upload') {
        if (localCsvPath.trim()) {
          finalCsvPath = localCsvPath.trim();
        } else {
          if (!uploadedFile) {
            toast.info('Please select a CSV file or enter local path first.');
            setIsLoading(false);
            return;
          }
          // Upload file
          const formData = new FormData();
          formData.append('file', uploadedFile);
          formData.append('symbol', selectedSymbol);
          formData.append('filename', uploadedFile.name.endsWith('.csv') ? uploadedFile.name : `${uploadedFile.name}.csv`);

          const uploadRes = await fetch('/api/market-data/upload', {
            method: 'POST',
            body: formData,
          });
          const uploadJson = await uploadRes.json();
          if (!uploadRes.ok || !uploadJson.success) {
            throw new Error(uploadJson.error || 'Failed to upload CSV file to server');
          }
          finalCsvPath = uploadJson.data.path;
        }
      } else {
        // Resolve filename based on startDate (format: YYYY-MM-DD)
        if (startDate) {
          const parts = startDate.split('-');
          const year = parts[0];
          const month = parts[1];
          if (parseInt(year, 10) < 2026) {
            // Pre-2026 files are yearly: e.g. 2025.csv
            finalCsvPath = `data/histdata/${selectedSymbol.toLowerCase()}/${year}.csv`;
          } else {
            // 2026+ files are monthly: e.g. 2026_06.csv
            finalCsvPath = `data/histdata/${selectedSymbol.toLowerCase()}/${year}_${month}.csv`;
          }
        } else {
          // Fallback if no date selected
          finalCsvPath = `data/histdata/${selectedSymbol.toLowerCase()}/2026_05.csv`;
        }
        toast.info(`Launching with server file at path: ${finalCsvPath}. Make sure it is pre-loaded.`);
      }

      // Create session in DB first
      const sessionRes = await fetch('/api/backtest/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName + ' (Python)',
          symbol: selectedSymbol,
          timeframe: timeframe,
          dataSource: 'python',
          startDate: startDate || null,
          endDate: endDate || null,
          initialBalance: startingBalance,
          leverage,
          allCandles: [],
          currentIndex: 0,
        }),
      });
      const sessionJson = await sessionRes.json();
      if (!sessionJson.success) {
        throw new Error(sessionJson.error || 'Failed to create database session');
      }

      const dbSession = sessionJson.data;

      // Call run-python endpoint
      const runRes = await fetch('/api/backtest/run-python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvPath: finalCsvPath,
          symbol: selectedSymbol,
          timeframe: timeframe,
          initialBalance: startingBalance,
          leverage: leverage,
          sessionId: dbSession.id,
          tzOffset: csvTimezoneOffset
        })
      });

      const runJson = await runRes.json();
      if (!runRes.ok || !runJson.success) {
        throw new Error(runJson.error || 'Failed to run Python aggregation.');
      }

      toast.success('Python engine successfully parsed and aggregated the CSV file! Loading chart...');
      
      // Auto transition Next.js to resume this session so they can see live synced progress!
      handleResumeSession(dbSession.id);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error starting Python Engine: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = () => {
    // Before ending, auto-save one last time
    if (activeSessionIdRef.current) {
      autoSave(
        balance,
        currentIndexRef.current,
        openPositionsRef.current,
        closedTradesRef.current,
        timeframe,
        markers
      );
    }
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
    setSessionStatus('setup');
    setIsGlobalNavCollapsed(true);
    setIsTerminalHeaderCollapsed(false);
    setActiveSessionId(null);
    setAllCandles([]);
    setVisibleCandles([]);
    setOpenPositions([]);
    setClosedTrades([]);
    setMarkers([]);
    setRawM1Candles([]);
    // Refresh sessions list
    fetchSessions();
  };

  // ============================================
  // INDICATOR & DRAWING HANDLERS
  // ============================================

  const handleAddIndicator = (type: string) => {
    const registryInfo = INDICATORS_REGISTRY.find((r) => r.type === type);
    if (!registryInfo) return;

    const newIndicator: ActiveIndicator = {
      id: generateId(),
      type,
      name: registryInfo.name,
      inputs: { ...registryInfo.defaultInputs },
      color: registryInfo.defaultColor,
    };

    const nextIndicators = [...activeIndicators, newIndicator];
    setActiveIndicators(nextIndicators);
    activeIndicatorsRef.current = nextIndicators;

    if (activeSessionId) {
      autoSave(balance, currentIndexRef.current, openPositionsRef.current, closedTradesRef.current, timeframe, markers);
    }
  };

  const handleRemoveIndicator = (id: string) => {
    const nextIndicators = activeIndicators.filter((ind) => ind.id !== id);
    setActiveIndicators(nextIndicators);
    activeIndicatorsRef.current = nextIndicators;

    if (activeSessionId) {
      autoSave(balance, currentIndexRef.current, openPositionsRef.current, closedTradesRef.current, timeframe, markers);
    }
  };

  const handleUpdateIndicator = (id: string, updates: Partial<ActiveIndicator>) => {
    const nextIndicators = activeIndicators.map((ind) => {
      if (ind.id === id) {
        return { ...ind, ...updates };
      }
      return ind;
    });
    setActiveIndicators(nextIndicators);
    activeIndicatorsRef.current = nextIndicators;

    if (activeSessionId) {
      autoSave(balance, currentIndexRef.current, openPositionsRef.current, closedTradesRef.current, timeframe, markers);
    }
  };

  const hasPendingHistoryPushRef = useRef<boolean>(false);

  // MouseUp listener on window to commit dragged drawings to the undo stack
  useEffect(() => {
    const handleMouseUp = () => {
      if (hasPendingHistoryPushRef.current) {
        setDrawingsHistory(prev => {
          const truncated = prev.slice(0, historyIndexRef.current + 1);
          const last = truncated[truncated.length - 1];
          if (last && drawingsShallowEqual(last, drawingsRef.current)) {
            hasPendingHistoryPushRef.current = false;
            return prev;
          }
          const nextHist = [...truncated, drawingsRef.current];
          setHistoryIndex(nextHist.length - 1);
          hasPendingHistoryPushRef.current = false;
          return nextHist;
        });
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleDrawingChange = (nextDrawings: SerializedDrawing[]) => {
    // If undoing/redoing or updating options, check if they are identical to index
    const activeHist = drawingsHistory[historyIndex];
    if (activeHist && drawingsShallowEqual(activeHist, nextDrawings)) {
      setDrawings(nextDrawings);
      drawingsRef.current = nextDrawings;
      return;
    }

    setDrawings(nextDrawings);
    drawingsRef.current = nextDrawings;

    const prevLength = activeHist ? activeHist.length : 0;
    if (nextDrawings.length !== prevLength) {
      // Added or removed - commit immediately
      const truncated = drawingsHistory.slice(0, historyIndex + 1);
      const nextHist = [...truncated, nextDrawings];
      setDrawingsHistory(nextHist);
      setHistoryIndex(nextHist.length - 1);
    } else {
      // Dragged/updated - wait for mouseup
      hasPendingHistoryPushRef.current = true;
    }

    if (activeSessionId) {
      autoSave(balance, currentIndexRef.current, openPositionsRef.current, closedTradesRef.current, timeframe, markers);
    }
  };

  const handleUpdateDrawing = (id: string, updates: Partial<SerializedDrawing>) => {
    const nextDrawings = drawingsRef.current.map(d => {
      if (d.id === id) {
        return {
          ...d,
          options: {
            ...d.options,
            ...updates.options
          }
        };
      }
      return d;
    });
    handleDrawingChange(nextDrawings);
  };

  const handleClearDrawings = async () => {
    const ok = await confirmDialog({
      title: 'Clear all drawings?',
      message: 'Every drawing on this chart will be removed. This can be undone with Ctrl+Z.',
      confirmLabel: 'Clear all',
      danger: true,
    });
    if (!ok) return;
    chartComponentRef.current?.clearDrawings();
    
    const nextDrawings: SerializedDrawing[] = [];
    setDrawings(nextDrawings);
    drawingsRef.current = nextDrawings;

    const truncated = drawingsHistory.slice(0, historyIndex + 1);
    const nextHist = [...truncated, nextDrawings];
    setDrawingsHistory(nextHist);
    setHistoryIndex(nextHist.length - 1);

    if (activeSessionId) {
      autoSave(balance, currentIndexRef.current, openPositionsRef.current, closedTradesRef.current, timeframe, markers);
    }
  };

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      const nextDrawings = drawingsHistory[nextIndex] || [];
      setDrawings(nextDrawings);
      drawingsRef.current = nextDrawings;
      if (activeSessionId) {
        autoSave(balanceRef.current, currentIndexRef.current, openPositionsRef.current, closedTradesRef.current, timeframeRef.current, markersRef.current);
      }
    }
  }, [historyIndex, drawingsHistory, activeSessionId]);

  const handleRedo = useCallback(() => {
    if (historyIndex < drawingsHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      const nextDrawings = drawingsHistory[nextIndex] || [];
      setDrawings(nextDrawings);
      drawingsRef.current = nextDrawings;
      if (activeSessionId) {
        autoSave(balanceRef.current, currentIndexRef.current, openPositionsRef.current, closedTradesRef.current, timeframeRef.current, markersRef.current);
      }
    }
  }, [historyIndex, drawingsHistory, activeSessionId]);

  const handleJumpToBar = (timestamp: number) => {
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }

    // Find closest candle index (only consider past/current candles, not future)
    let closestIndex = 0;
    let closestDiff = Infinity;
    for (let i = 0; i < allCandles.length; i++) {
      const diff = Math.abs(allCandles[i].time - timestamp);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    // Truncate markers that are in the "future" relative to the jump point
    const cutoffTime = allCandles[closestIndex].time;
    const nextMarkers = markers.filter(m => m.time <= cutoffTime);
    setMarkers(nextMarkers);

    // Filter open positions that were opened after cutoff time
    const nextOpenPositions = openPositions.filter(p => p.entryTime <= cutoffTime);
    setOpenPositions(nextOpenPositions);

    // Filter closed trades that exited after cutoff time
    const nextClosedTrades = closedTrades.filter(t => (t.exitTime ?? 0) <= cutoffTime);
    setClosedTrades(nextClosedTrades);

    setCurrentIndex(closestIndex);
    setVisibleCandles(allCandles.slice(0, closestIndex + 1));
    setIsJumpToBarActive(false);

    // Update replay wall timestamp
    const tfSecs = TIMEFRAME_SECONDS[timeframe] || 900;
    setReplayTimestamp(allCandles[closestIndex].time + tfSecs - 60);

    // Save state
    autoSave(balance, closestIndex, nextOpenPositions, nextClosedTrades, timeframe, nextMarkers);
  };


  // ============================================
  // TIMEFRAME SWITCHING (Active mode)
  // ============================================

  const handleTimeframeChange = async (newTf: Timeframe) => {
    if (newTf === timeframe) return;

    // 1. Pause replay
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }

    // 2. Use the replay wall timestamp as the source of truth
    const wallTimestamp = replayTimestampRef.current;
    let m1Data = rawM1Candles;

    setIsLoading(true);

    try {
      // 3. Ensure we have M1 data (lazy fetch for server mode if not yet cached)
      if (m1Data.length === 0 && dataSource === 'server') {
        let finalStart = startDate;
        let finalEnd = endDate;

        if ((!finalStart || !finalEnd) && allCandles.length > 0) {
          const firstTime = allCandles[0].time;
          const lastTime = allCandles[allCandles.length - 1].time;
          finalStart = new Date(firstTime * 1000).toISOString().split('T')[0];
          finalEnd = new Date(lastTime * 1000).toISOString().split('T')[0];
        }

        const m1Params = new URLSearchParams({
          symbol,
          start: finalStart,
          end: finalEnd,
          timeframe: '1m',
        });
        const res = await fetch(`/api/market-data?${m1Params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          m1Data = normalizeCandles(json.data || json.candles || []);
          setRawM1Candles(m1Data);
          console.log('[TF Switch] Fetched and cached M1 data:', m1Data.length, 'candles');
        }
      }

      if (m1Data.length === 0) {
        console.error('[TF Switch] No M1 data available for re-aggregation');
        setIsLoading(false);
        return;
      }

      // 4. Re-aggregate ALL M1 data to the new timeframe (full dataset for future replay)
      const newAllCandles = aggregateCandles(m1Data, newTf);
      if (newAllCandles.length === 0) {
        setIsLoading(false);
        return;
      }

      // 5. Filter M1 data to only the "revealed" portion, then aggregate
      //    This naturally produces partial candles at the edge — better than TradingView
      const revealedM1 = m1Data.filter(c => c.time <= wallTimestamp);
      const visibleAggregated = aggregateCandles(revealedM1, newTf);

      // 6. Map visible candles back to allCandles indices
      const lastVisibleTime = visibleAggregated.length > 0
        ? visibleAggregated[visibleAggregated.length - 1].time
        : 0;
      let newCurrentIndex = 0;
      for (let i = 0; i < newAllCandles.length; i++) {
        if (newAllCandles[i].time <= lastVisibleTime) {
          newCurrentIndex = i;
        } else {
          break;
        }
      }

      // 7. Build final visible array with partial edge candle.
      //    We use map to construct a new array instead of direct index assignment
      //    to avoid triggering false-positive React hook immutability lint rules.
      const rawVisible = newAllCandles.slice(0, newCurrentIndex + 1);
      const finalVisible = rawVisible.map((candle, idx) => {
        if (idx === rawVisible.length - 1 && visibleAggregated.length > 0) {
          const partialEdge = visibleAggregated[visibleAggregated.length - 1];
          if (candle.time === partialEdge.time) {
            return { ...partialEdge };
          }
        }
        return { ...candle };
      });

      console.log(`[TF Switch] ${timeframe} → ${newTf} | wall=${wallTimestamp} | visible=${finalVisible.length}/${newAllCandles.length} candles`);

      // 8. Update state — NO minimum candle clamp, replayTimestamp stays the same
      setTimeframe(newTf);
      setAllCandles(newAllCandles);
      setVisibleCandles(finalVisible);
      setCurrentIndex(newCurrentIndex);

      // Auto-save the new timeframe and aggregated candles
      autoSave(
        balanceRef.current,
        newCurrentIndex,
        openPositionsRef.current,
        closedTradesRef.current,
        newTf,
        markersRef.current,
        newAllCandles
      );
    } catch (err) {
      console.error('Error switching timeframe:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // TRADING LOGIC (preserved from original)
  // ============================================

  // Helper to save trade to DB asynchronously
  const saveTradeToDatabase = async (trade: TradeRecord) => {
    try {
      await fetch('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trade),
      });
    } catch (err) {
      console.error('Error saving trade to DB:', err);
    }
  };

  // Compute live stats
  const stats: BacktestStats = useMemo(() => {
    return calculateBacktestStats(closedTrades);
  }, [closedTrades]);

  // Calculate live equity
  const unrealizedPnLTotal = openPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
  const equity = balance + unrealizedPnLTotal;

  // Sync positions live price updates when visible candles change.
  // stepForward already stamps fresh unrealized PnL on each tick, so this
  // effect only fires a state update when values actually differ (e.g. after
  // jump-to-bar or timeframe switches) — otherwise it bails out with `prev`
  // and no re-render happens.
  useEffect(() => {
    if (visibleCandles.length === 0 || openPositionsRef.current.length === 0) return;
    const currentClose = visibleCandles[visibleCandles.length - 1].close;

    setOpenPositions(prev => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map(pos => {
        const { pnl, pips } = calculateUnrealizedPnL(
          pos.entryPrice,
          currentClose,
          pos.lotSize,
          pos.type,
          pos.symbol
        );
        if (pos.currentPrice === currentClose && pos.unrealizedPnl === pnl && pos.unrealizedPips === pips) {
          return pos;
        }
        changed = true;
        return {
          ...pos,
          currentPrice: currentClose,
          unrealizedPnl: pnl,
          unrealizedPips: pips,
        };
      });
      return changed ? next : prev;
    });
  }, [visibleCandles.length]);

  // Execute Step Forward
  const stepForward = useCallback(() => {
    const nextIndex = currentIndexRef.current + 1;
    const candlesList = allCandlesRef.current;

    if (nextIndex >= candlesList.length) {
      setIsPlaying(false);
      return false; // finished
    }

    const nextCandle = candlesList[nextIndex];
    const currentPositions = [...openPositionsRef.current];
    const nextClosedTrades: TradeRecord[] = [];
    const nextOpenPositions: OpenPosition[] = [];
    let balanceAdjustment = 0;
    const nextMarkers: ChartMarker[] = [];

    // Check if open positions hit SL or TP on the new candle
    for (const position of currentPositions) {
      let isClosed = false;
      let exitPrice = nextCandle.close;
      let exitReason: 'SL' | 'TP' | 'MANUAL' = 'MANUAL';

      if (position.type === 'BUY') {
        // Stop Loss Check
        if (position.stopLoss && nextCandle.low <= position.stopLoss) {
          isClosed = true;
          exitPrice = position.stopLoss;
          exitReason = 'SL';
        }
        // Take Profit Check (if TP is hit on high)
        else if (position.takeProfit && nextCandle.high >= position.takeProfit) {
          isClosed = true;
          exitPrice = position.takeProfit;
          exitReason = 'TP';
        }
      } else { // SELL
        // Stop Loss Check
        if (position.stopLoss && nextCandle.high >= position.stopLoss) {
          isClosed = true;
          exitPrice = position.stopLoss;
          exitReason = 'SL';
        }
        // Take Profit Check
        else if (position.takeProfit && nextCandle.low <= position.takeProfit) {
          isClosed = true;
          exitPrice = position.takeProfit;
          exitReason = 'TP';
        }
      }

      if (isClosed) {
        // Calculate realized metrics
        const tradePnL = calculatePnL(position.entryPrice, exitPrice, position.lotSize, position.type, position.symbol);
        const tradePnLPips = calculatePnLPips(position.entryPrice, exitPrice, position.type, position.symbol);

        balanceAdjustment += tradePnL;

        const closedRecord: TradeRecord = {
          id: position.id,
          symbol: position.symbol,
          type: position.type,
          lotSize: position.lotSize,
          entryPrice: position.entryPrice,
          entryTime: position.entryTime,
          exitPrice,
          exitTime: nextCandle.time,
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
          pnl: tradePnL,
          pnlPips: tradePnLPips,
          commission: 0,
          swap: 0,
          status: 'closed',
          source: 'backtest',
          tags: [],
        };

        nextClosedTrades.push(closedRecord);
        saveTradeToDatabase(closedRecord);

        // Add exit marker
        nextMarkers.push({
          time: nextCandle.time,
          position: position.type === 'BUY' ? 'aboveBar' : 'belowBar',
          color: tradePnL >= 0 ? '#10b981' : '#ef4444',
          shape: position.type === 'BUY' ? 'arrowDown' : 'arrowUp',
          text: `${exitReason} (${tradePnL >= 0 ? '+' : ''}${tradePnL.toFixed(1)})`,
        });
      } else {
        // Position remains open, update unrealized state
        const { pnl, pips } = calculateUnrealizedPnL(
          position.entryPrice,
          nextCandle.close,
          position.lotSize,
          position.type,
          position.symbol
        );

        nextOpenPositions.push({
          ...position,
          currentPrice: nextCandle.close,
          unrealizedPnl: pnl,
          unrealizedPips: pips,
        });
      }
    }

    // Apply adjustments
    const nextBal = balanceRef.current + balanceAdjustment;
    const nextClosed = [...closedTradesRef.current, ...nextClosedTrades];
    const nextMkrs = [...markersRef.current, ...nextMarkers];

    if (balanceAdjustment !== 0) {
      setBalance(nextBal);
    }

    if (nextClosedTrades.length > 0) {
      setClosedTrades(nextClosed);
      setMarkers(nextMkrs);
    }

    if (currentPositions.length > 0) {
      setOpenPositions(nextOpenPositions);
    }
    setVisibleCandles(candlesList.slice(0, nextIndex + 1));
    setCurrentIndex(nextIndex);

    // Update replay wall timestamp to the end of this candle's time period
    const tfSecs = TIMEFRAME_SECONDS[timeframeRef.current] || 900;
    setReplayTimestamp(nextCandle.time + tfSecs - 60);

    // If not playing, autoSave immediately (candle-by-candle step)
    if (!isPlaying) {
      autoSave(nextBal, nextIndex, nextOpenPositions, nextClosed, timeframeRef.current, nextMkrs);
    }

    return true;
  }, [isPlaying]);

  // Execute Step Backward (Rewind 1 candle)
  const stepBackward = useCallback(() => {
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }

    const prevIndex = currentIndexRef.current - 1;
    const candlesList = allCandlesRef.current;
    const initialIndex = getInitialReplayIndex(candlesList);

    if (prevIndex < initialIndex) {
      return;
    }

    const prevCandle = candlesList[prevIndex];
    const cutoffTime = prevCandle.time;

    // 1. Filter open positions that were opened after cutoff time
    const nextOpenPositions = openPositionsRef.current.filter(p => p.entryTime <= cutoffTime);

    // 2. Filter closed trades and restore any that closed after cutoff time
    const restoredPositions = [...nextOpenPositions];
    const nextClosedTrades = closedTradesRef.current.filter(t => {
      if ((t.exitTime ?? 0) > cutoffTime) {
        // Only restore if the trade was originally opened before/at cutoffTime
        if (t.entryTime <= cutoffTime) {
          const { pnl: upnl, pips: upips } = calculateUnrealizedPnL(
            t.entryPrice,
            prevCandle.close,
            t.lotSize,
            t.type,
            t.symbol
          );
          const originalPos: OpenPosition = {
            id: t.id,
            symbol: t.symbol,
            type: t.type,
            lotSize: t.lotSize,
            entryPrice: t.entryPrice,
            entryTime: t.entryTime,
            stopLoss: t.stopLoss,
            takeProfit: t.takeProfit,
            currentPrice: prevCandle.close,
            unrealizedPnl: upnl,
            unrealizedPips: upips,
          };
          restoredPositions.push(originalPos);
        }
        return false; // Exclude from closedTrades
      }
      return true; // Keep in closedTrades
    });

    // 3. Revert balance (deduct realized P&L of reverted trades)
    let balanceDiff = 0;
    for (const t of closedTradesRef.current) {
      if ((t.exitTime ?? 0) > cutoffTime) {
        balanceDiff += t.pnl ?? 0;
      }
    }
    const nextBal = balanceRef.current - balanceDiff;

    // 4. Filter markers to only those up to cutoffTime
    const nextMarkers = markersRef.current.filter(m => m.time <= cutoffTime);

    // 5. Update state
    setBalance(nextBal);
    setClosedTrades(nextClosedTrades);
    setOpenPositions(restoredPositions);
    setMarkers(nextMarkers);
    setCurrentIndex(prevIndex);
    setVisibleCandles(candlesList.slice(0, prevIndex + 1));

    // Update replay wall timestamp
    const tfSecs = TIMEFRAME_SECONDS[timeframeRef.current] || 900;
    setReplayTimestamp(prevCandle.time + tfSecs - 60);

    // Auto-save immediately
    autoSave(nextBal, prevIndex, restoredPositions, nextClosedTrades, timeframeRef.current, nextMarkers);
  }, []);

  // Sync Timer for Play/Pause
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        const hasNext = stepForward();
        if (!hasNext) {
          setIsPlaying(false);
        }
      }, speed);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
      // AUTO-SAVE ON PAUSE!
      if (activeSessionIdRef.current) {
        autoSave(
          balanceRef.current,
          currentIndexRef.current,
          openPositionsRef.current,
          closedTradesRef.current,
          timeframeRef.current,
          markersRef.current
        );
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, speed, stepForward]);


  // Reset backtest session
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    const candlesList = allCandlesRef.current;
    if (candlesList.length > 0) {
      const resetIndex = getInitialReplayIndex(candlesList);
      const resetVisible = candlesList.slice(0, resetIndex + 1);
      setVisibleCandles(resetVisible);
      setCurrentIndex(resetIndex);
      setBalance(startingBalance);
      setOpenPositions([]);
      setClosedTrades([]);
      setMarkers([]);

      // Reset replay wall timestamp
      const tfSecs = TIMEFRAME_SECONDS[timeframeRef.current] || 900;
      setReplayTimestamp(candlesList[resetIndex].time + tfSecs - 60);

      autoSave(startingBalance, resetIndex, [], [], timeframeRef.current, []);
    }
  }, [startingBalance]);

  // Keyboard Shortcuts handler
  useEffect(() => {
    if (sessionStatus !== 'active') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
        return; // ignore in form fields
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        stepForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        stepBackward();
      } else if (e.altKey && e.code === 'KeyR') {
        e.preventDefault();
        chartComponentRef.current?.resetZoom();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        handleReset();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        setActiveTool(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepForward, stepBackward, sessionStatus, handleUndo, handleRedo, handleReset]);

  // Play/Pause toggler
  const handleTogglePlay = useCallback(() => {
    setIsPlaying(p => !p);
  }, []);

  const handleStepForwardManual = useCallback(() => {
    setIsPlaying(false);
    stepForward();
  }, [stepForward]);

  const handleToggleJumpToBar = useCallback(() => {
    setIsJumpToBarActive(active => !active);
  }, []);

  // Place Trade Order
  const handlePlaceOrder = useCallback((type: TradeType) => {
    const candlesList = visibleCandlesRef.current;
    if (candlesList.length === 0) return;
    const currentCandle = candlesList[candlesList.length - 1];
    const entryPrice = currentCandle.close;

    const slVal = stopLossInput ? parseFloat(stopLossInput) : undefined;
    const tpVal = takeProfitInput ? parseFloat(takeProfitInput) : undefined;

    // Basic Validation
    if (slVal) {
      if (type === 'BUY' && slVal >= entryPrice) {
        toast.error('BUY Stop Loss must be below the Entry Price');
        return;
      }
      if (type === 'SELL' && slVal <= entryPrice) {
        toast.error('SELL Stop Loss must be above the Entry Price');
        return;
      }
    }
    if (tpVal) {
      if (type === 'BUY' && tpVal <= entryPrice) {
        toast.error('BUY Take Profit must be above the Entry Price');
        return;
      }
      if (type === 'SELL' && tpVal >= entryPrice) {
        toast.error('SELL Take Profit must be below the Entry Price');
        return;
      }
    }

    const positionId = generateId();
    const newPosition: OpenPosition = {
      id: positionId,
      symbol,
      type,
      lotSize,
      entryPrice,
      entryTime: currentCandle.time,
      stopLoss: slVal,
      takeProfit: tpVal,
      currentPrice: entryPrice,
      unrealizedPnl: 0,
      unrealizedPips: 0,
    };

    const nextOpen = [...openPositionsRef.current, newPosition];
    setOpenPositions(nextOpen);

    // Add entry marker
    const newMarker: ChartMarker = {
      time: currentCandle.time,
      position: type === 'BUY' ? 'belowBar' : 'aboveBar',
      color: type === 'BUY' ? '#10b981' : '#ef4444',
      shape: type === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: `${type} ${lotSize} Lot`,
    };

    const nextMarkers = [...markersRef.current, newMarker];
    setMarkers(nextMarkers);

    // Reset fields
    setStopLossInput('');
    setTakeProfitInput('');

    // Auto-save
    autoSave(balanceRef.current, currentIndexRef.current, nextOpen, closedTradesRef.current, timeframeRef.current, nextMarkers);
  }, [symbol, lotSize, stopLossInput, takeProfitInput]);

  // Close Position Manually
  const handleClosePosition = useCallback((id: string, closePercent: number = 100) => {
    const openPos = openPositionsRef.current;
    const candlesList = visibleCandlesRef.current;
    const position = openPos.find(p => p.id === id);
    if (!position || candlesList.length === 0) return;

    const currentCandle = candlesList[candlesList.length - 1];
    const exitPrice = currentCandle.close;

    const closedLots = position.lotSize * (closePercent / 100);
    const remainingLots = position.lotSize - closedLots;

    const tradePnL = calculatePnL(position.entryPrice, exitPrice, closedLots, position.type, position.symbol);
    const tradePnLPips = calculatePnLPips(position.entryPrice, exitPrice, position.type, position.symbol);

    const isFullClose = closePercent === 100;

    const closedRecord: TradeRecord = {
      id: isFullClose ? position.id : generateId(),
      symbol: position.symbol,
      type: position.type,
      lotSize: closedLots,
      entryPrice: position.entryPrice,
      entryTime: position.entryTime,
      exitPrice,
      exitTime: currentCandle.time,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      pnl: tradePnL,
      pnlPips: tradePnLPips,
      commission: 0,
      swap: 0,
      status: 'closed',
      source: 'backtest',
      comment: isFullClose ? undefined : `Partial Close (${closePercent}%)`,
      tags: [],
    };

    const nextBalance = balanceRef.current + tradePnL;
    const nextClosed = [...closedTradesRef.current, closedRecord];

    let nextOpen: OpenPosition[];
    if (isFullClose) {
      nextOpen = openPos.filter(p => p.id !== id);
    } else {
      nextOpen = openPos.map(p => {
        if (p.id === id) {
          return {
            ...p,
            lotSize: remainingLots,
          };
        }
        return p;
      });
    }

    setBalance(nextBalance);
    setClosedTrades(nextClosed);
    saveTradeToDatabase(closedRecord);
    setOpenPositions(nextOpen);

    // Add exit marker
    const exitMarker: ChartMarker = {
      time: currentCandle.time,
      position: position.type === 'BUY' ? 'aboveBar' : 'belowBar',
      color: tradePnL >= 0 ? '#10b981' : '#ef4444',
      shape: position.type === 'BUY' ? 'arrowDown' : 'arrowUp',
      text: isFullClose
        ? `Close (${tradePnL >= 0 ? '+' : ''}${tradePnL.toFixed(1)})`
        : `Partial ${closePercent}% (${tradePnL >= 0 ? '+' : ''}${tradePnL.toFixed(1)})`,
    };

    const nextMarkers = [...markersRef.current, exitMarker];
    setMarkers(nextMarkers);

    // Auto-save
    autoSave(nextBalance, currentIndexRef.current, nextOpen, nextClosed, timeframeRef.current, nextMarkers);
  }, []);

  // Update active position SL/TP
  const handleUpdateSLTP = useCallback((positionId: string, sl: number | undefined, tp: number | undefined) => {
    const nextOpen = openPositionsRef.current.map(p => {
      if (p.id === positionId) {
        return {
          ...p,
          stopLoss: sl,
          takeProfit: tp,
        };
      }
      return p;
    });
    setOpenPositions(nextOpen);
    autoSave(balanceRef.current, currentIndexRef.current, nextOpen, closedTradesRef.current, timeframeRef.current, markersRef.current);
  }, []);

  // Update active position entry price
  const handleUpdateEntryPrice = useCallback((positionId: string, entryPrice: number) => {
    const nextOpen = openPositionsRef.current.map(p => {
      if (p.id === positionId) {
        return {
          ...p,
          entryPrice,
        };
      }
      return p;
    });
    setOpenPositions(nextOpen);
    autoSave(balanceRef.current, currentIndexRef.current, nextOpen, closedTradesRef.current, timeframeRef.current, markersRef.current);
  }, []);


  // Helper to set inputs to quick SL/TP options
  const setQuickSLTP = useCallback((pipsSL: number, pipsTP: number) => {
    const candlesList = visibleCandlesRef.current;
    if (candlesList.length === 0) return;
    const currentClose = candlesList[candlesList.length - 1].close;
    const config = getSymbolConfig(symbol);

    const buySL = currentClose - pipsSL * config.pipSize;
    const buyTP = currentClose + pipsTP * config.pipSize;

    setStopLossInput(buySL.toFixed(config.digits));
    setTakeProfitInput(buyTP.toFixed(config.digits));
  }, [symbol]);

  // ---- Stable callbacks for memoized panel children ----
  // These are identity-stable across replay ticks so React.memo children skip
  // re-rendering unless their data props actually change.

  const handleToggleCloseMenu = useCallback((id: string) => {
    setActiveCloseMenuId(prev => {
      if (prev === id) return null;
      setPartialClosePercent(50);
      return id;
    });
  }, []);

  const handleDismissCloseMenu = useCallback(() => {
    setActiveCloseMenuId(null);
  }, []);

  const handleStartEditSL = useCallback((editKey: string, current: number | undefined) => {
    setEditingSLId(editKey);
    setEditingTPId(null);
    setTempSL(current ? current.toString() : '');
  }, []);

  const handleStartEditTP = useCallback((editKey: string, current: number | undefined) => {
    setEditingTPId(editKey);
    setEditingSLId(null);
    setTempTP(current ? current.toString() : '');
  }, []);

  const handleCommitSL = useCallback((positionId: string, takeProfit: number | undefined, raw: string) => {
    const slNum = raw.trim() ? parseFloat(raw) : undefined;
    handleUpdateSLTP(positionId, slNum, takeProfit);
    setEditingSLId(null);
  }, [handleUpdateSLTP]);

  const handleCommitTP = useCallback((positionId: string, stopLoss: number | undefined, raw: string) => {
    const tpNum = raw.trim() ? parseFloat(raw) : undefined;
    handleUpdateSLTP(positionId, stopLoss, tpNum);
    setEditingTPId(null);
  }, [handleUpdateSLTP]);

  const handleCancelEditSL = useCallback(() => setEditingSLId(null), []);
  const handleCancelEditTP = useCallback(() => setEditingTPId(null), []);

  const handleSelectBottomTab = useCallback((tab: 'positions' | 'trades' | 'analysis') => {
    setActiveTab(tab);
    setIsBottomPanelCollapsed(false);
  }, []);

  const handleToggleZoomLocked = useCallback(() => setIsZoomLocked(v => !v), []);
  const handleToggleBottomPanelCollapsed = useCallback(() => setIsBottomPanelCollapsed(v => !v), []);
  const handleChartClosePosition = useCallback((positionId: string) => handleClosePosition(positionId, 100), [handleClosePosition]);

  // Live risk/reward preview for the order panel. Memoized so the OrderPanel
  // only re-renders when its actual inputs change, not on every candle tick
  // (currentClose is intentionally read per lastClose below).
  const lastClose = visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1].close : null;
  const liveRiskReward = useMemo(() => {
    if (lastClose === null) return null;
    const currentPrice = lastClose;
    const slVal = stopLossInput ? parseFloat(stopLossInput) : undefined;
    const tpVal = takeProfitInput ? parseFloat(takeProfitInput) : undefined;

    let riskUSD = 0;
    let rewardUSD = 0;
    let riskPercent = 0;
    let rewardPercent = 0;
    let rrRatio = '';

    if (slVal && !isNaN(slVal)) {
      const isBuy = slVal < currentPrice || (tpVal ? tpVal > currentPrice : true);
      const tradeType: TradeType = isBuy ? 'BUY' : 'SELL';

      riskUSD = calculatePnL(currentPrice, slVal, lotSize, tradeType, symbol);
      riskUSD = Math.abs(riskUSD);
      riskPercent = balance > 0 ? (riskUSD / balance) * 100 : 0;

      if (tpVal && !isNaN(tpVal)) {
        rewardUSD = calculatePnL(currentPrice, tpVal, lotSize, tradeType, symbol);
        rewardUSD = Math.abs(rewardUSD);
        rewardPercent = balance > 0 ? (rewardUSD / balance) * 100 : 0;

        if (riskUSD > 0) {
          rrRatio = `1:${(rewardUSD / riskUSD).toFixed(2)}`;
        }
      }
      return { isBuy, riskUSD, riskPercent, rewardUSD, rewardPercent, rrRatio };
    } else if (tpVal && !isNaN(tpVal)) {
      const isBuy = tpVal > currentPrice;
      const tradeType: TradeType = isBuy ? 'BUY' : 'SELL';
      rewardUSD = calculatePnL(currentPrice, tpVal, lotSize, tradeType, symbol);
      rewardUSD = Math.abs(rewardUSD);
      rewardPercent = balance > 0 ? (rewardUSD / balance) * 100 : 0;
      return { isBuy, riskUSD: 0, riskPercent: 0, rewardUSD, rewardPercent, rrRatio: '' };
    }
    return null;
  }, [lastClose, stopLossInput, takeProfitInput, lotSize, symbol, balance]);

  const currentCandle = visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1] : null;
  const config = getSymbolConfig(symbol);

  // ============================================
  // RENDER — LOADING / NOT MOUNTED
  // ============================================

  if (!mounted) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#080b12', color: '#94a3b8', alignItems: 'center', justifyContent: 'center' }} suppressHydrationWarning>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }} suppressHydrationWarning>
          <div className="spinner" suppressHydrationWarning />
          <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Initializing TradingView Engine...</span>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — SETUP MODE (WIZARD)
  // ============================================

  if (sessionStatus === 'setup') {
    return (
      <div className={styles.backtestContainer}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className="spinner" />
            <span>Loading market data...</span>
          </div>
        )}

        <div className={styles.wizardOverlay}>
          <div className={styles.wizardCard}>
            {/* Step Indicator */}
            <div className={styles.wizardStepIndicator}>
              <div className={`${styles.wizardStepDot} ${wizardStep >= 1 ? (wizardStep > 1 ? styles.completed : styles.active) : ''}`} />
              <div className={`${styles.wizardStepConnector} ${wizardStep >= 2 ? styles.active : ''}`} />
              <div className={`${styles.wizardStepDot} ${wizardStep >= 2 ? styles.active : ''}`} />
            </div>

            {/* ====== STEP 1: Session Config ====== */}
            {wizardStep === 1 && (
              <div className={styles.wizardStep1Layout}>
                {/* Left Column: Create New Session Form */}
                <div className={styles.wizardFormColumn}>
                  <h2 className={styles.wizardTitle}>Configure Session</h2>
                  <p className={styles.wizardSubtitle}>
                    Set up your backtesting environment. Choose your starting capital and leverage.
                  </p>

                  <div className={styles.wizardInputGroup}>
                    <label htmlFor="session-name">Session Name</label>
                    <input
                      id="session-name"
                      type="text"
                      className={styles.wizardInput}
                      value={sessionName}
                      onChange={e => setSessionName(e.target.value)}
                      placeholder="Backtest Session #1"
                    />
                  </div>

                  <div className={styles.wizardInputGroup}>
                    <label htmlFor="starting-balance">Starting Balance ($)</label>
                    <input
                      id="starting-balance"
                      type="number"
                      className={styles.wizardInput}
                      value={startingBalance}
                      onChange={e => setStartingBalance(parseFloat(e.target.value) || 10000)}
                      min={100}
                      step={100}
                    />
                  </div>

                  <div className={styles.wizardInputGroup}>
                    <label htmlFor="leverage">Leverage</label>
                    <Select
                      ariaLabel="Leverage"
                      value={leverage}
                      onChange={setLeverage}
                      options={LEVERAGE_OPTIONS.map(opt => ({ value: opt, label: opt }))}
                    />
                  </div>

                  <div className={styles.wizardActions} style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                    <div /> {/* Spacer */}
                    <button
                      className={styles.wizardNextBtn}
                      onClick={() => setWizardStep(2)}
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* Right Column: Resume Saved Sessions */}
                <div className={styles.savedSessionsColumn}>
                  <h3 className={styles.savedSessionsTitle}>
                    <span>📂</span> Saved Sessions ({savedSessions.length})
                  </h3>
                  
                  {savedSessions.length === 0 ? (
                    <div className={styles.noSavedSessions}>
                      No saved sessions found.<br />Configure a new session on the left to start.
                    </div>
                  ) : (
                    <div className={styles.savedSessionsList}>
                      {savedSessions.map(session => (
                        <div key={session.id} className={styles.sessionCard}>
                          <div className={styles.sessionCardHeader}>
                            <span className={styles.sessionCardName} title={session.name}>
                              {session.name}
                            </span>
                            <span className={styles.sessionCardMeta}>
                              {new Date(session.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className={styles.sessionCardSpecs}>
                            <div>Symbol: <strong>{session.symbol}</strong></div>
                            <div>TF: <strong>{session.timeframe}</strong></div>
                            <div>Capital: <strong>{formatCurrency(session.initialBalance)}</strong></div>
                            <div>Current: <strong style={{ color: session.currentBalance >= session.initialBalance ? '#10b981' : '#ef4444' }}>{formatCurrency(session.currentBalance)}</strong></div>
                          </div>
                          
                          <div className={styles.sessionCardActions}>
                            <button
                              className={styles.deleteSessionBtn}
                              onClick={(e) => handleDeleteSession(e, session.id)}
                            >
                              🗑 Delete
                            </button>
                            <button
                              className={styles.resumeSessionBtn}
                              onClick={() => handleResumeSession(session.id)}
                            >
                              ▶ Resume
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ====== STEP 2: Symbol & Data Source ====== */}
            {wizardStep === 2 && (
              <>
                <h2 className={styles.wizardTitle}>Symbol & Data</h2>
                <p className={styles.wizardSubtitle}>
                  Choose a trading symbol and select your data source for the backtest.
                </p>

                {/* Symbol Grid */}
                <div className={styles.wizardInputGroup}>
                  <label>Select Symbol</label>
                </div>
                <div className={styles.symbolGrid}>
                  {Object.values(SYMBOLS).map(sym => (
                    <div
                      key={sym.key}
                      className={`${styles.symbolCard} ${selectedSymbol === sym.key ? styles.symbolCardActive : ''}`}
                      onClick={() => setSelectedSymbol(sym.key)}
                    >
                      <span className={styles.symbolCardName}>{sym.name}</span>
                      <span className={styles.symbolCardDisplay}>{sym.displayName}</span>
                      <span className={styles.symbolCardCategory}>{sym.category}</span>
                    </div>
                  ))}
                </div>

                {/* Data Source Toggle */}
                <div className={styles.wizardInputGroup}>
                  <label>Data Source</label>
                </div>
                <div className={styles.dataSourceToggle}>
                  {/* Server Data Card */}
                  <div
                    className={`${styles.dataSourceCard} ${dataSource === 'server' ? styles.dataSourceCardActive : ''}`}
                    onClick={() => setDataSource('server')}
                  >
                    <span className={styles.dataSourceCardTitle}>📡 Server Data</span>
                    <span className={styles.dataSourceCardInfo}>
                      Uses pre-loaded historical data from the server
                    </span>
                  </div>

                  {/* Upload CSV Card */}
                  <div
                    className={`${styles.dataSourceCard} ${dataSource === 'upload' ? styles.dataSourceCardActive : ''}`}
                    onClick={() => setDataSource('upload')}
                  >
                    <span className={styles.dataSourceCardTitle}>📁 Upload CSV</span>
                    <span className={styles.dataSourceCardInfo}>
                      Upload your own M1 CSV file from HistData or MT5
                    </span>
                  </div>
                </div>

                {/* CSV Source Timezone — always visible */}
                <div className={styles.wizardInputGroup} style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
                  <label htmlFor="csv-timezone">CSV Source Timezone</label>
                  <Select
                    ariaLabel="CSV timezone"
                    value={String(csvTimezoneOffset)}
                    onChange={v => setCsvTimezoneOffset(parseInt(v, 10))}
                    options={CSV_TIMEZONES.map(tz => ({ value: String(tz.offset), label: tz.label }))}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                    Adjusts CSV timestamps to UTC during processing (e.g. choose UTC+5:30 (IST) or UTC-4 (EDT)).
                  </span>
                </div>

                {/* Timeframe Selector — always visible */}
                <div className={styles.wizardInputGroup} style={{ marginTop: '1rem' }}>
                  <label>Chart Timeframe</label>
                </div>
                <div className={styles.selectorWrapper} style={{
                  display: 'flex',
                  gap: '2px',
                  background: 'var(--term-input, #101014)',
                  padding: '3px',
                  borderRadius: '8px',
                  border: '1px solid var(--term-border, rgba(255, 255, 255, 0.06))',
                  alignSelf: 'flex-start',
                  marginBottom: '0.75rem'
                }}>
                  {TIMEFRAMES.map(tf => (
                    <button
                      key={tf.key}
                      type="button"
                      onClick={() => setTimeframe(tf.key)}
                      style={{
                        padding: '0.35rem 0.85rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: timeframe === tf.key ? 'var(--term-card, #1c1c24)' : 'transparent',
                        color: timeframe === tf.key ? 'var(--term-text, #ffffff)' : 'var(--term-text-3, #7a7a85)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: timeframe === tf.key ? '600' : '500',
                        fontFamily: 'var(--font-sans)',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>

                {/* Conditional: Server date pickers or Upload zone */}
                {dataSource === 'server' && (
                  <div className={styles.dateRangeRow}>
                    <div className={styles.wizardInputGroup}>
                      <label htmlFor="start-date">Start Date</label>
                      <input
                        id="start-date"
                        type="date"
                        className={styles.wizardInput}
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className={styles.wizardInputGroup}>
                      <label htmlFor="end-date">End Date</label>
                      <input
                        id="end-date"
                        type="date"
                        className={styles.wizardInput}
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {dataSource === 'upload' && (
                  <>
                    <div className={styles.wizardInputGroup} style={{ marginBottom: '1rem' }}>
                      <label htmlFor="local-csv-path">Absolute Local CSV Path (Bypasses upload delay)</label>
                      <input
                        id="local-csv-path"
                        type="text"
                        className={styles.wizardInput}
                        placeholder="e.g. C:\Users\sohan\OneDrive\Desktop\DAT_MT_XAUUSD_M1_202605.csv"
                        value={localCsvPath}
                        onChange={e => setLocalCsvPath(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', marginTop: '0.25rem' }}
                      />
                    </div>
                    
                    <div style={{ textAlign: 'center', margin: '0.75rem 0', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
                      ── OR UPLOAD FILE ──
                    </div>

                    <div
                      className={`${styles.uploadZone} ${isDragOver ? styles.uploadZoneActive : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadedFile ? (
                        <>
                          <span className={styles.uploadZoneIcon}>✅</span>
                          <span className={styles.uploadZoneFileName}>{uploadedFile.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                            {csvPreviewInfo ? ` · ${csvPreviewInfo.dateRange}` : ''}
                            {' '}— Click to change
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={styles.uploadZoneIcon}>📤</span>
                          <span>Drag &amp; drop your CSV file here</span>
                          <span style={{ fontSize: '0.75rem' }}>or click to browse</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.25rem' }}>
                            Supports HistData M1 format · MT5 M1 export
                          </span>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                    />
                  </>
                )}

                {/* Replay Engine Toggle */}
                <div className={styles.wizardInputGroup} style={{ marginTop: '1.25rem' }}>
                  <label>Backtest Replay Engine</label>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div
                    onClick={() => setEngineType('python')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: engineType === 'python' ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: engineType === 'python' ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: engineType === 'python' ? 'var(--accent)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      🐍 Python Desktop
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Native TradingView desktop window. Extremely fast, supports large CSV files & drawing tools.
                    </div>
                  </div>

                  <div
                    onClick={() => setEngineType('browser')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: engineType === 'browser' ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: engineType === 'browser' ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: engineType === 'browser' ? 'var(--accent)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      🌐 Web Browser
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Canvas-based browser chart inside this tab. Best for smaller files.
                    </div>
                  </div>
                </div>

                <div className={styles.wizardActions}>
                  <button
                    className={styles.wizardBackBtn}
                    onClick={() => setWizardStep(1)}
                  >
                    ← Back
                  </button>
                  {engineType === 'python' ? (
                    <button
                      className={styles.launchBtn}
                      onClick={handleLaunchPythonSession}
                      disabled={isLoading || (dataSource === 'upload' && !uploadedFile && !localCsvPath.trim())}
                      style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', boxShadow: '0 0 15px rgba(2, 132, 199, 0.4)' }}
                    >
                      🚀 Launch Python Engine
                    </button>
                  ) : (
                    <button
                      className={styles.launchBtn}
                      onClick={handleLaunchSession}
                      disabled={isLoading || (dataSource === 'server' && (!startDate || !endDate)) || (dataSource === 'upload' && !uploadedFile)}
                    >
                      🚀 Launch Web Engine
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER — ACTIVE MODE
  // ============================================

  const replayPercent = allCandles.length > 0
    ? Math.round(((currentIndex + 1) / allCandles.length) * 100)
    : 0;

  return (
    <div className={styles.backtestContainer}>
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className="spinner" />
          <span>Loading data...</span>
        </div>
      )}

      {/* ── TOP BAR ── */}
      <header className={`${styles.topBar} ${isTerminalHeaderCollapsed ? styles.topBarCollapsed : ''}`}>
        <div className={styles.brand}>
          ⚡ TradingBook
        </div>

        <div className={styles.controlsGroup}>
          {/* Symbol */}
          <span className={styles.symbolDisplay}>{SYMBOLS[symbol]?.name || symbol}</span>

          {/* Chart type */}
          <Select
            ariaLabel="Chart type"
            size="sm"
            value={chartType}
            onChange={(v) => setChartType(v as any)}
            style={{ minWidth: 118 }}
            options={[
              { value: 'Candles', label: 'Candles' },
              { value: 'HeikinAshi', label: 'Heikin Ashi' },
              { value: 'Bars', label: 'Bars' },
              { value: 'Line', label: 'Line' },
              { value: 'Area', label: 'Area' },
            ]}
          />

          <div className={styles.topBarDivider} />

          {/* Timeframes */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'var(--term-input, #101014)',
            padding: '2px',
            borderRadius: '6px',
            border: '1px solid var(--term-border, rgba(255, 255, 255, 0.06))'
          }}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                className={`${styles.timeframeBtn} ${timeframe === tf.key ? styles.activeTimeframe : ''}`}
                onClick={() => handleTimeframeChange(tf.key)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  fontWeight: timeframe === tf.key ? '600' : '500',
                  color: timeframe === tf.key ? 'var(--term-text, #ffffff)' : 'var(--term-text-3, #7a7a85)',
                  background: timeframe === tf.key ? 'var(--term-card, #1c1c24)' : 'transparent',
                  border: 'none',
                  transition: 'all 0.1s ease',
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className={styles.topBarDivider} />

          {/* Indicators */}
          <button className={styles.indicatorsBtn} onClick={() => setIsIndicatorPanelOpen(true)}>📊 Indicators</button>
          <button className={styles.indicatorsBtn} onClick={() => setIsObjectTreeOpen(true)}>🌳 Objects</button>

          <div className={styles.topBarDivider} />

          {/* Screenshot / Fullscreen */}
          <button
            className={styles.topBarBtn}
            title="Screenshot"
            onClick={() => {
              const url = chartComponentRef.current?.takeScreenshot();
              if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.download = `TradingBook_${symbol}_${timeframe}.png`;
                a.click();
              }
            }}
          >📸</button>
          <button
            className={styles.topBarBtn}
            title="Fullscreen"
            onClick={() => chartComponentRef.current?.toggleFullscreen()}
          >⛶</button>

          <div>
            <button
              ref={settingsBtnRef}
              className={styles.topBarBtn}
              title="Chart Display Settings"
              onClick={() => setIsSettingsOpen(true)}
              style={{
                borderColor: isSettingsOpen ? 'var(--term-accent, #7c4dff)' : 'var(--term-border-strong)',
                background: isSettingsOpen ? 'rgba(124, 77, 255, 0.08)' : 'transparent',
              }}
            >
              ⚙️ settings
            </button>
            
            <ChartSettingsModal
              isOpen={isSettingsOpen}
              settings={chartSettings}
              onClose={() => setIsSettingsOpen(false)}
              onSave={(newSettings) => setChartSettings(newSettings)}
            />
          </div>

          <div className={styles.topBarDivider} />

          {/* Equity */}
          <div
            className={styles.balanceDisplay}
            style={{
              color: equity >= startingBalance ? '#10b981' : '#ef4444',
              borderColor: equity >= startingBalance ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
              background: equity >= startingBalance ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
            }}
          >
            {formatCurrency(equity)}
          </div>

          {/* Session tag */}
          <div className={styles.sessionTag}>📋 {sessionName}</div>

          {/* Save */}
          {activeSessionId && (
            <button
              className={`${styles.manualSaveBtn} ${saveStatus === 'saved' ? styles.manualSaveBtnSuccess : ''}`}
              onClick={handleSaveSession}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? '⏳' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '❌' : '💾 Save'}
            </button>
          )}

          {/* Toggle navigation bar */}
          <button
            className={styles.topBarBtn}
            onClick={() => setIsGlobalNavCollapsed(!isGlobalNavCollapsed)}
            title={isGlobalNavCollapsed ? "Show main navigation header" : "Hide main navigation header"}
            style={{ borderColor: isGlobalNavCollapsed ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255,255,255,0.08)' }}
          >
            {isGlobalNavCollapsed ? '👁️ Show Nav' : '👁️ Hide Nav'}
          </button>

          {/* Collapse Controls */}
          <button
            className={styles.topBarBtn}
            onClick={() => setIsTerminalHeaderCollapsed(true)}
            title="Collapse terminal controls"
          >
            ▲ Hide Controls
          </button>

          {/* End session */}
          <button className={styles.endSessionBtn} onClick={handleEndSession}>✕ End</button>
        </div>
      </header>

      {/* ── MAIN AREA ── */}
      <main className={styles.mainArea}>
        {/* ── LEFT PANEL ── */}
        <aside className={`${styles.tradePanel} ${isOrderPanelOpen ? styles.orderPanelOpen : ''} ${isTradePanelCollapsed ? styles.tradePanelCollapsed : ''}`}>

          {/* Replay Controls */}
          <PlaybackControls
            isPlaying={isPlaying}
            speed={speed}
            isJumpToBarActive={isJumpToBarActive}
            currentIndex={currentIndex}
            totalCandles={allCandles.length}
            replayPercent={replayPercent}
            onReset={handleReset}
            onStepBackward={stepBackward}
            onTogglePlay={handleTogglePlay}
            onStepForwardManual={handleStepForwardManual}
            onToggleJumpToBar={handleToggleJumpToBar}
            onSetSpeed={setSpeed}
          />

          {/* Trade Execution */}
          <OrderPanel
            symbol={symbol}
            lotSize={lotSize}
            stopLossInput={stopLossInput}
            takeProfitInput={takeProfitInput}
            liveRiskReward={liveRiskReward}
            onPlaceOrder={handlePlaceOrder}
            onSetLotSize={setLotSize}
            onSetStopLossInput={setStopLossInput}
            onSetTakeProfitInput={setTakeProfitInput}
            onQuickSLTP={setQuickSLTP}
          />

          {/* Active Positions */}
          <PositionsSidebar
            openPositions={openPositions}
            symbol={symbol}
            activeCloseMenuId={activeCloseMenuId}
            partialClosePercent={partialClosePercent}
            editingSLId={editingSLId}
            editingTPId={editingTPId}
            tempSL={tempSL}
            tempTP={tempTP}
            onToggleCloseMenu={handleToggleCloseMenu}
            onSetPartialClosePercent={setPartialClosePercent}
            onClosePosition={handleClosePosition}
            onDismissCloseMenu={handleDismissCloseMenu}
            onSetTempSL={setTempSL}
            onSetTempTP={setTempTP}
            onStartEditSL={handleStartEditSL}
            onStartEditTP={handleStartEditTP}
            onCommitSL={handleCommitSL}
            onCommitTP={handleCommitTP}
            onCancelEditSL={handleCancelEditSL}
            onCancelEditTP={handleCancelEditTP}
          />
        </aside>

        {/* ── RIGHT CHART CONTAINER ── */}
        <section className={styles.chartArea} style={{ position: 'relative' }}>
          {isTerminalHeaderCollapsed && (
            <button
              onClick={() => setIsTerminalHeaderCollapsed(false)}
              style={{
                position: 'absolute',
                top: '8px',
                left: '60px',
                zIndex: 1000,
                background: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--accent)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(30, 41, 59, 1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.85)'}
            >
              ▼ Expand Controls
            </button>
          )}
          {dataSource === 'python' && allCandles.length === 0 ? (
            <div style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#94a3b8',
              background: 'radial-gradient(circle at 50% 50%, rgba(2, 132, 199, 0.08), rgba(7, 8, 10, 0))',
              border: '1px solid rgba(2, 132, 199, 0.1)',
              borderRadius: '12px',
              padding: '2rem',
              textAlign: 'center',
              backdropFilter: 'blur(20px)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', maxWidth: '400px' }}>
                <div style={{ fontSize: '3.5rem', filter: 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.3))' }}>🐍</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>Python Desktop Engine Active</h3>
                <p style={{ fontSize: '0.82rem', opacity: 0.8, lineHeight: 1.5 }}>
                  The lightweight-charts interactive window is currently running on your desktop.
                </p>
                <div style={{ background: 'rgba(5, 6, 8, 0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.75rem 1rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Live Database Synced Progress:</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'monospace', color: '#10b981' }}>
                    Balance: {formatCurrency(balance)}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    Trades Placed: {closedTrades.length} | Open Positions: {openPositions.length}
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', opacity: 0.5, fontStyle: 'italic' }}>
                  You can execute orders and replay bars directly in the popup window.
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.chartWorkspace}>
              {/* Drawing toolbar - thin strip on left edge of chart */}
              <div className={styles.drawingToolbarWrapper}>
                <DrawingToolbar
                  activeTool={activeTool}
                  onSelectTool={setActiveTool}
                  onClearDrawings={handleClearDrawings}
                  isMagnetMode={isMagnetMode}
                  onToggleMagnetMode={() => setIsMagnetMode(!isMagnetMode)}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={historyIndex > 0}
                  canRedo={historyIndex < drawingsHistory.length - 1}
                />
              </div>

              {/* Chart render area */}
              <div className={styles.chartContent}>
                {/* OHLC Overlay */}
                <div className={styles.ohlcOverlay}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6366f1', marginRight: '4px' }}>
                    {symbol}
                  </span>
                  {hoverOhlc ? (
                    <>
                      <span className={styles.ohlcItem}>O<span className={styles.ohlcVal}>{formatPrice(hoverOhlc.open, symbol)}</span></span>
                      <span className={styles.ohlcItem}>H<span className={styles.ohlcVal}>{formatPrice(hoverOhlc.high, symbol)}</span></span>
                      <span className={styles.ohlcItem}>L<span className={styles.ohlcVal}>{formatPrice(hoverOhlc.low, symbol)}</span></span>
                      <span className={styles.ohlcItem}>C<span className={styles.ohlcVal}>{formatPrice(hoverOhlc.close, symbol)}</span></span>
                      <span className={styles.ohlcItem}>
                        Change
                        <span className={`${styles.ohlcVal} ${hoverOhlc.changePercent >= 0 ? styles.ohlcUp : styles.ohlcDown}`}>
                          {hoverOhlc.changePercent >= 0 ? '+' : ''}{hoverOhlc.changePercent.toFixed(2)}%
                        </span>
                      </span>
                      {hoverOhlc.volume !== undefined && (
                        <span className={styles.ohlcItem}>V<span className={styles.ohlcVal}>{hoverOhlc.volume}</span></span>
                      )}
                    </>
                  ) : currentCandle ? (
                    <>
                      <span className={styles.ohlcItem}>O<span className={styles.ohlcVal}>{formatPrice(currentCandle.open, symbol)}</span></span>
                      <span className={styles.ohlcItem}>H<span className={styles.ohlcVal}>{formatPrice(currentCandle.high, symbol)}</span></span>
                      <span className={styles.ohlcItem}>L<span className={styles.ohlcVal}>{formatPrice(currentCandle.low, symbol)}</span></span>
                      <span className={styles.ohlcItem}>C<span className={styles.ohlcVal}>{formatPrice(currentCandle.close, symbol)}</span></span>
                      {currentCandle.volume !== undefined && (
                        <span className={styles.ohlcItem}>V<span className={styles.ohlcVal}>{currentCandle.volume}</span></span>
                      )}
                    </>
                  ) : (
                    <span className={styles.ohlcItem}>No candle data</span>
                  )}
                </div>

                <Chart
                  key={`${chartType}-${activeSessionId || 'none'}`}
                  ref={chartComponentRef}
                  chartType={chartType}
                  candles={visibleCandles}
                  markers={finalMarkers}
                  positions={openPositions}
                  symbol={symbol}
                  onCrosshairMove={setHoverOhlc}
                  activeTool={activeTool}
                  drawings={drawings}
                  onDrawingChange={handleDrawingChange}
                  activeIndicators={activeIndicators}
                  sessionKey={activeSessionId || undefined}
                  displayTimezone={displayTimezone}
                  isMagnetMode={isMagnetMode}
                  isJumpToBarActive={isJumpToBarActive}
                  onJumpToBar={handleJumpToBar}
                  onSelectTool={setActiveTool}
                  timeframe={timeframe}
                  isZoomLocked={isZoomLocked}
                  closedTrades={closedTrades}
                  showTradeHistory={chartSettings.showTradeHistory}
                  showTradeLevels={chartSettings.showTradeLevels}
                  chartSettings={chartSettings}
                  onUpdateSLTP={handleUpdateSLTP}
                  onUpdateEntryPrice={handleUpdateEntryPrice}
                  onClosePosition={handleChartClosePosition}
                  onPlaceTrade={handlePlaceOrder}
                />

                {/* Fullscreen Original Panels Toggle Overlays */}
                {isFullscreen && (
                  <>
                    <button
                      className={`${styles.fsToggleBtn} ${styles.fsReplayToggle}`}
                      onClick={() => setIsTradePanelCollapsed(!isTradePanelCollapsed)}
                    >
                      {isTradePanelCollapsed ? '▶ Show Replay' : '◀ Hide Replay'}
                    </button>

                    <button
                      className={`${styles.fsToggleBtn} ${styles.fsPositionsToggle}`}
                      onClick={() => setIsBottomPanelCollapsed(!isBottomPanelCollapsed)}
                    >
                      {isBottomPanelCollapsed ? '▲ Show Positions' : '▼ Hide Positions'}
                    </button>
                  </>
                )}

                {/* Display Timezone Selector Overlay */}
                <div className={styles.timezoneSelectorContainer}>
                  <Select
                    ariaLabel="Display timezone"
                    size="sm"
                    value={displayTimezone}
                    onChange={setDisplayTimezone}
                    style={{ minWidth: 150 }}
                    options={DISPLAY_TIMEZONES.map(tz => ({ value: tz.value, label: tz.label }))}
                  />
                </div>
                
                <ObjectTreePanel 
                  isOpen={isObjectTreeOpen}
                  onClose={() => setIsObjectTreeOpen(false)}
                  drawings={drawings}
                  onDelete={(id) => {
                    chartComponentRef.current?.removeDrawing(id);
                  }}
                  onUpdateDrawing={handleUpdateDrawing}
                />
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Bottom Session Tabs Panel */}
      <footer
        className={`${styles.bottomPanel} ${isBottomPanelCollapsed ? styles.bottomPanelCollapsed : ''} ${isBottomSheetExpanded ? styles.bottomSheetExpanded : ''}`}
      >
        {/* Drag handle (mobile) — swipe up/down to expand/collapse */}
        <div
          className={styles.bottomSheetHandle}
          onClick={toggleBottomSheet}
          onTouchStart={handleBottomSheetTouchStart}
          onTouchMove={handleBottomSheetTouchMove}
          onTouchEnd={handleBottomSheetTouchEnd}
        />
        <TabsHeader
          activeTab={activeTab}
          openPositionsCount={openPositions.length}
          closedTradesCount={closedTrades.length}
          saveStatus={saveStatus}
          isZoomLocked={isZoomLocked}
          isBottomPanelCollapsed={isBottomPanelCollapsed}
          onSelectTab={handleSelectBottomTab}
          onToggleZoomLocked={handleToggleZoomLocked}
          onToggleBottomPanelCollapsed={handleToggleBottomPanelCollapsed}
        />

        <div className={styles.tabContent}>
          {/* ============ POSITIONS TAB ============ */}
          {activeTab === 'positions' && (
            <div style={{ height: '100%', overflowY: 'auto' }}>
              <OpenPositionsTable
                openPositions={openPositions}
                activeCloseMenuId={activeCloseMenuId}
                partialClosePercent={partialClosePercent}
                editingSLId={editingSLId}
                editingTPId={editingTPId}
                tempSL={tempSL}
                tempTP={tempTP}
                onToggleCloseMenu={handleToggleCloseMenu}
                onSetPartialClosePercent={setPartialClosePercent}
                onClosePosition={handleClosePosition}
                onDismissCloseMenu={handleDismissCloseMenu}
                onSetTempSL={setTempSL}
                onSetTempTP={setTempTP}
                onStartEditSL={handleStartEditSL}
                onStartEditTP={handleStartEditTP}
                onCommitSL={handleCommitSL}
                onCommitTP={handleCommitTP}
                onCancelEditSL={handleCancelEditSL}
                onCancelEditTP={handleCancelEditTP}
              />
            </div>
          )}

          {/* ============ HISTORY TAB ============ */}
          {activeTab === 'trades' && (
            <div style={{ height: '100%', overflowY: 'auto' }}>
              <TradeHistoryTable closedTrades={closedTrades} />
            </div>
          )}


          {/* ============ PERFORMANCE ANALYTICS TAB ============ */}
          {activeTab === 'analysis' && (
            <div className={styles.analysisTabGrid}>
              {/* Detailed Metrics List */}
              <div className={styles.analysisStatsCard}>
                <div className={styles.analysisStatRow}>
                  <span className={styles.analysisStatLabel}>Net profit / loss</span>
                  <span className={`${styles.analysisStatValue} ${(stats.netPnl ?? 0) >= 0 ? styles.pnlPositive : styles.pnlNegative}`}>
                    {formatCurrency(stats.netPnl ?? 0)} ({formatPercent(startingBalance > 0 ? ((stats.netPnl ?? 0) / startingBalance) * 100 : 0)})
                  </span>
                </div>
                
                <div className={styles.analysisStatRow}>
                  <span className={styles.analysisStatLabel}>Win rate</span>
                  <span className={styles.analysisStatValue} style={{ color: stats.winRate >= 50 ? '#10b981' : '#fff' }}>
                    {formatPercent(stats.winRate)} ({stats.winCount}W / {stats.lossCount}L)
                  </span>
                </div>
                
                <div className={styles.analysisStatRow}>
                  <span className={styles.analysisStatLabel}>Profit factor</span>
                  <span className={styles.analysisStatValue} style={{ color: stats.profitFactor >= 1.5 ? '#10b981' : stats.profitFactor > 0 && stats.profitFactor < 1 ? '#ef4444' : '#fff' }}>
                    {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                  </span>
                </div>

                <div className={styles.analysisStatRow}>
                  <span className={styles.analysisStatLabel}>Max drawdown</span>
                  <span className={styles.analysisStatValue} style={{ color: '#ef4444' }}>
                    {formatCurrency(stats.maxDrawdown)} ({formatPercent(startingBalance > 0 ? (stats.maxDrawdown / startingBalance) * 100 : 0)})
                  </span>
                </div>

                <div className={styles.analysisStatRow}>
                  <span className={styles.analysisStatLabel}>Avg Win / Avg Loss</span>
                  <span className={styles.analysisStatValue}>
                    <span style={{ color: '#10b981' }}>{formatCurrency(stats.avgWin)}</span>
                    <span style={{ color: 'var(--text-muted)' }}> / </span>
                    <span style={{ color: '#ef4444' }}>{formatCurrency(stats.avgLoss)}</span>
                  </span>
                </div>

                <div className={styles.analysisStatRow}>
                  <span className={styles.analysisStatLabel}>Average Risk/Reward</span>
                  <span className={styles.analysisStatValue}>
                    {stats.avgRiskReward > 0 ? `1:${stats.avgRiskReward.toFixed(1)}` : 'N/A'}
                  </span>
                </div>

                <div className={styles.analysisStatRow}>
                  <span className={styles.analysisStatLabel}>Sharpe Ratio (Risk-free=0)</span>
                  <span className={styles.analysisStatValue} style={{ color: calculateSharpeRatio(closedTrades.map(t => t.pnl ?? 0)) >= 1 ? '#10b981' : '#fff' }}>
                    {calculateSharpeRatio(closedTrades.map(t => t.pnl ?? 0)).toFixed(2)}
                  </span>
                </div>

                <div className={styles.analysisStatRow}>
                  <span className={styles.analysisStatLabel}>Best / Worst Trade</span>
                  <span className={styles.analysisStatValue}>
                    <span style={{ color: '#10b981' }}>{formatCurrency(stats.bestTrade)}</span>
                    <span style={{ color: 'var(--text-muted)' }}> / </span>
                    <span style={{ color: '#ef4444' }}>{formatCurrency(stats.worstTrade)}</span>
                  </span>
                </div>

                <div className={styles.analysisStatRow}>
                  <span className={styles.analysisStatLabel}>Max Consecutive Win/Loss</span>
                  <span className={styles.analysisStatValue}>
                    <span style={{ color: '#10b981' }}>{stats.consecutiveWins}W</span>
                    <span style={{ color: 'var(--text-muted)' }}> / </span>
                    <span style={{ color: '#ef4444' }}>{stats.consecutiveLosses}L</span>
                  </span>
                </div>

                <div className={styles.analysisStatRow}>
                  <span className={styles.analysisStatLabel}>Avg Trade Duration</span>
                  <span className={styles.analysisStatValue}>
                    {stats.avgTradeDuration > 0 ? formatDuration(stats.avgTradeDuration) : 'Instant'}
                  </span>
                </div>
              </div>

              {/* Equity Curve SVG Chart */}
              <div className={styles.analysisChartCard}>
                <div className={styles.analysisChartTitle}>
                  <span>📈 Equity Curve</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Updated live after each trade</span>
                </div>
                <div className={styles.equityCurveWrapper}>
                  {(() => {
                    const balanceHistory = [startingBalance];
                    let current = startingBalance;
                    for (const t of closedTrades) {
                      current += t.pnl || 0;
                      balanceHistory.push(current);
                    }
                    return <EquityCurve history={balanceHistory} />;
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </footer>

      {/* Indicators Search Modal */}
      <IndicatorPanel
        isOpen={isIndicatorPanelOpen}
        onClose={() => setIsIndicatorPanelOpen(false)}
        activeIndicators={activeIndicators}
        onAddIndicator={handleAddIndicator}
        onRemoveIndicator={handleRemoveIndicator}
        onUpdateIndicator={handleUpdateIndicator}
      />

      {/* Mobile order-panel slide-over backdrop (tap to close) */}
      <div
        className={`${styles.orderPanelOverlay} ${isOrderPanelOpen ? styles.orderPanelOverlayVisible : ''}`}
        onClick={() => setIsOrderPanelOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile FAB — opens the order/replay panel */}
      <button
        type="button"
        className={styles.orderPanelFab}
        onClick={() => setIsOrderPanelOpen(true)}
        aria-label="Open order panel"
      >
        ⚡
      </button>
    </div>
  );
}

// ============================================
// PERFORMANCE ANALYTICS HELPERS
// ============================================

function calculateSharpeRatio(pnls: number[]): number {
  if (pnls.length < 2) return 0;
  const mean = pnls.reduce((sum, val) => sum + val, 0) / pnls.length;
  const variance = pnls.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (pnls.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return mean / stdDev;
}

const EquityCurve = ({ history, width = 600, height = 160 }: { history: number[]; width?: number; height?: number }) => {
  if (history.length <= 1) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '3.5rem 0' }}>
        No closed trades to display equity curve.
      </div>
    );
  }

  const min = Math.min(...history);
  const max = Math.max(...history);
  const padding = (max - min) * 0.1 || 100; // 10% padding
  const yMin = min - padding;
  const yMax = max + padding;

  const points = history.map((val, idx) => {
    const x = history.length > 1 ? (idx / (history.length - 1)) * (width - 40) + 20 : width / 2;
    const y = yMax !== yMin ? height - ((val - yMin) / (yMax - yMin)) * (height - 30) - 15 : height / 2;
    return `${x},${y}`;
  });

  const pathD = points.length > 0 ? `M ${points.join(' L ')}` : '';
  
  // Create gradient area
  const areaD = points.length > 0
    ? `${pathD} L ${history.length > 1 ? (width - 20) : width / 2},${height - 15} L 20,${height - 15} Z`
    : '';

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      
      {/* Zero/Starting Line reference */}
      {yMax !== yMin && (
        <line
          x1={20}
          y1={height - ((history[0] - yMin) / (yMax - yMin)) * (height - 30) - 15}
          x2={width - 20}
          y2={height - ((history[0] - yMin) / (yMax - yMin)) * (height - 30) - 15}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeDasharray="4 4"
        />
      )}

      {/* Grid lines */}
      <line x1={20} y1={15} x2={width - 20} y2={15} stroke="rgba(255, 255, 255, 0.03)" />
      <line x1={20} y1={height - 15} x2={width - 20} y2={height - 15} stroke="rgba(255, 255, 255, 0.03)" />

      {/* Area under curve */}
      {areaD && <path d={areaD} fill="url(#equityGrad)" />}

      {/* Line path */}
      {pathD && <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

      {/* Points */}
      {points.map((pt, idx) => {
        const [x, y] = pt.split(',').map(Number);
        return (
          <g key={idx}>
            <circle
              cx={x}
              cy={y}
              r={history.length > 15 ? 2.5 : 3.5}
              fill="#0d111a"
              stroke={idx === 0 ? 'var(--text-secondary)' : history[idx] >= history[idx - 1] ? '#10b981' : '#ef4444'}
              strokeWidth="2"
            />
          </g>
        );
      })}
    </svg>
  );
};
