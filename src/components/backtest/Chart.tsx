'use client';

import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { toast } from 'sonner';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  CrosshairMode,
  LineStyle,
  createSeriesMarkers,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  MouseEventParams,
  ISeriesPrimitive,
  SeriesAttachedParameter,
} from 'lightweight-charts';
import type { CandleData, ChartMarker, OpenPosition, OHLCDisplay, TradeRecord, ChartSettings } from '@/types';
import styles from './Chart.module.css';
import { computeHeikinAshi } from '@/lib/heikin-ashi';
import { TIMEFRAME_SECONDS } from '@/lib/aggregator';
import { getSymbolConfig, formatPrice, formatCurrency, formatPips, formatPercent, calculatePnL } from '@/lib/trade-math';
import { drawingsShallowEqual } from '@/lib/drawing-utils';

// Import Drawing tools from lightweight-charts-drawing
import {
  DrawingManager,
  TrendLine,
  HorizontalLine,
  VerticalLine,
  FibRetracement,
  Rectangle,
  Triangle,
  Brush,
  TextAnnotation,
  Path,
  DatePriceRange,
  LongPosition,
  ShortPosition,
  getToolRegistry,
  type Anchor,
  type SerializedDrawing,
} from 'lightweight-charts-drawing';

// Import Technical Indicators from lightweight-charts-indicators
import * as Ind from 'lightweight-charts-indicators';

// Import Drawing overlays (context menu, toolbar, settings modal)
import {
  DrawingContextMenu,
  DrawingFloatingToolbar,
  DrawingSettingsModal,
} from './DrawingControls';


// == RECTANGLE 8-HANDLE PROTOTYPE OVERRIDES ==
if (typeof window !== 'undefined') {
  const proto = (Rectangle as any).prototype;

  proto.getControlPoints = function (viewport: any) {
    if (this.id === 'preview') {
      const pts: any[] = [];
      for (let s = 0; s < this.anchors.length; s++) {
        const p = this.anchorToPixel(this.anchors[s], viewport);
        if (p) pts.push({ index: s, x: p.x, y: p.y, radius: 5 });
      }
      return pts;
    }

    if (!this.anchors || this.anchors.length === 0) return [];
    
    // First anchor pixel
    const p0 = this.anchorToPixel(this.anchors[0], viewport);
    if (!p0) return [];

    // If only one anchor exists (drawing in progress), show one handle
    if (this.anchors.length < 2) {
      return [{ index: 0, x: p0.x, y: p0.y, radius: 5 }];
    }

    // Second anchor pixel
    const p1 = this.anchorToPixel(this.anchors[1], viewport);
    if (!p1) return [{ index: 0, x: p0.x, y: p0.y, radius: 5 }];

    const minX = Math.min(p0.x, p1.x);
    const maxX = Math.max(p0.x, p1.x);
    const minY = Math.min(p0.y, p1.y);
    const maxY = Math.max(p0.y, p1.y);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    // Return 8 control points: 4 corners + 4 middle points
    return [
      { index: 0, x: minX, y: minY, radius: 5 }, // Top-Left
      { index: 1, x: maxX, y: minY, radius: 5 }, // Top-Right
      { index: 2, x: maxX, y: maxY, radius: 5 }, // Bottom-Right
      { index: 3, x: minX, y: maxY, radius: 5 }, // Bottom-Left
      { index: 4, x: midX, y: minY, radius: 5 }, // Top-Middle
      { index: 5, x: maxX, y: midY, radius: 5 }, // Right-Middle
      { index: 6, x: midX, y: maxY, radius: 5 }, // Bottom-Middle
      { index: 7, x: minX, y: midY, radius: 5 }  // Left-Middle
    ];
  };

  proto.updateAnchor = function (index: number, anchor: any) {
    if (this.id === 'preview') {
      if (this.anchors && index < this.anchors.length) {
        this.anchors[index] = anchor;
      }
      this.requestUpdate();
      return;
    }

    const viewport = this.getViewport();
    if (!viewport || !this.anchors || this.anchors.length < 2) {
      if (this.anchors && index < this.anchors.length) {
        this.anchors[index] = anchor;
      }
      this.requestUpdate();
      return;
    }

    // Current coordinates
    const p0 = this.anchorToPixel(this.anchors[0], viewport);
    const p1 = this.anchorToPixel(this.anchors[1], viewport);
    if (!p0 || !p1) {
      if (index < this.anchors.length) {
        this.anchors[index] = anchor;
      }
      this.requestUpdate();
      return;
    }

    // New position from mouse
    const pNew = this.anchorToPixel(anchor, viewport);
    if (!pNew) return;

    let left = Math.min(p0.x, p1.x);
    let right = Math.max(p0.x, p1.x);
    let top = Math.min(p0.y, p1.y);
    let bottom = Math.max(p0.y, p1.y);

    const isC0Left = p0.x <= p1.x;
    const isC0Top = p0.y <= p1.y;

    // Constrain updates based on which of the 8 handles is dragged
    switch (index) {
      case 0: // Top-Left
        left = pNew.x;
        top = pNew.y;
        break;
      case 1: // Top-Right
        right = pNew.x;
        top = pNew.y;
        break;
      case 2: // Bottom-Right
        right = pNew.x;
        bottom = pNew.y;
        break;
      case 3: // Bottom-Left
        left = pNew.x;
        bottom = pNew.y;
        break;
      case 4: // Top-Middle
        top = pNew.y;
        break;
      case 5: // Right-Middle
        right = pNew.x;
        break;
      case 6: // Bottom-Middle
        bottom = pNew.y;
        break;
      case 7: // Left-Middle
        left = pNew.x;
        break;
      default:
        return;
    }

    // Reconstruct pixel anchors based on original mapping
    const newP0 = {
      x: isC0Left ? left : right,
      y: isC0Top ? top : bottom
    };
    const newP1 = {
      x: isC0Left ? right : left,
      y: isC0Top ? bottom : top
    };

    // Convert back to chart anchors
    const newAnchor0 = this.pixelToAnchor(newP0, viewport);
    const newAnchor1 = this.pixelToAnchor(newP1, viewport);

    if (newAnchor0 && newAnchor1) {
      this.anchors[0] = newAnchor0;
      this.anchors[1] = newAnchor1;
      this.requestUpdate();
    }
  };
}

interface ChartProps {
  candles: CandleData[];
  markers?: ChartMarker[];
  positions?: OpenPosition[];
  symbol: string;
  onCrosshairMove?: (ohlc: OHLCDisplay | null) => void;
  // Phase 2 props
  activeTool?: string | null;
  drawings?: SerializedDrawing[];
  onDrawingChange?: (drawings: SerializedDrawing[]) => void;
  activeIndicators?: { id: string; type: string; inputs: Record<string, any>; color: string }[];
  chartType?: 'Candles' | 'HeikinAshi' | 'Line' | 'Area' | 'Bars';
  /** Pass a unique value (e.g. sessionId) to force a full chart reset / fitContent on new sessions */
  sessionKey?: string;
  displayTimezone?: string;
  isMagnetMode?: boolean;
  isJumpToBarActive?: boolean;
  onJumpToBar?: (timestamp: number) => void;
  onSelectTool?: (tool: string | null) => void;
  timeframe?: string;
  isZoomLocked?: boolean;
  closedTrades?: TradeRecord[];
  showTradeHistory?: boolean;
  showTradeLevels?: boolean;
  chartSettings?: ChartSettings;
  onUpdateSLTP?: (id: string, sl: number | undefined, tp: number | undefined) => void;
  onUpdateEntryPrice?: (id: string, entryPrice: number) => void;
  onClosePosition?: (positionId: string) => void;
  onPlaceTrade?: (type: 'BUY' | 'SELL') => void;
}

export interface ChartRef {
  takeScreenshot: () => string | null;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;
  toggleFullscreen: () => void;
  resetZoom: () => void;
}

class TradeHistoryPrimitive implements ISeriesPrimitive<any> {
  private _chart: any = null;
  private _series: any = null;
  private _requestUpdate: () => void = () => {};
  private _trades: TradeRecord[] = [];
  private _visible: boolean = true;

  constructor(trades: TradeRecord[], visible: boolean) {
    this._trades = trades;
    this._visible = visible;
  }

  updateTrades(trades: TradeRecord[], visible: boolean) {
    this._trades = trades;
    this._visible = visible;
    this._requestUpdate();
  }

  attached(param: any) {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached() {
    this._chart = null;
    this._series = null;
  }

  updateAllViews() {}

  paneViews() {
    return [
      {
        zOrder: () => 'normal' as any,
        renderer: () => {
          if (!this._visible || !this._chart || !this._series || this._trades.length === 0) {
            return null;
          }
          return {
            draw: (target: any) => {
              target.useMediaCoordinateSpace((scope: any) => {
                const ctx = scope.context;
                for (const trade of this._trades) {
                  const entryTime = trade.entryTime;
                  const exitTime = trade.exitTime;
                  if (!entryTime || !exitTime) continue;

                  const xEntry = this._chart.timeScale().timeToCoordinate(entryTime as any);
                  const xExit = this._chart.timeScale().timeToCoordinate(exitTime as any);
                  const yEntry = this._series.priceToCoordinate(trade.entryPrice);
                  const yExit = this._series.priceToCoordinate(trade.exitPrice);

                  if (xEntry !== null && yEntry !== null && xExit !== null && yExit !== null) {
                    const isBuy = trade.type === 'BUY';
                    
                    // Draw entry arrow: Up pointing arrow (Blue) for BUY entry, Down (Red) for SELL entry
                    const entryColor = isBuy ? '#2196f3' : '#f44336';
                    this._drawArrow(ctx, xEntry, yEntry, isBuy ? 'up' : 'down', entryColor);

                    // Draw exit arrow: Down pointing arrow (Red) for BUY exit (SELL), Up (Blue) for SELL exit (BUY)
                    const exitColor = isBuy ? '#f44336' : '#2196f3';
                    this._drawArrow(ctx, xExit, yExit, isBuy ? 'down' : 'up', exitColor);

                    // Draw dashed line connecting entry and exit
                    ctx.save();
                    ctx.strokeStyle = 'rgba(99, 102, 241, 0.85)'; // Premium indigo dashed line
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(xEntry, yEntry);
                    ctx.lineTo(xExit, yExit);
                    ctx.stroke();
                    ctx.restore();
                  }
                }
              });
            }
          };
        }
      }
    ];
  }

  private _drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, direction: 'up' | 'down', color: string) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    if (direction === 'up') {
      // Pointing UP: tip at (x, y)
      // Body extends downwards
      ctx.moveTo(x, y); // tip
      ctx.lineTo(x - 5, y + 5);
      ctx.lineTo(x - 2, y + 5);
      ctx.lineTo(x - 2, y + 12);
      ctx.lineTo(x + 2, y + 12);
      ctx.lineTo(x + 2, y + 5);
      ctx.lineTo(x + 5, y + 5);
    } else {
      // Pointing DOWN: tip at (x, y)
      // Body extends upwards
      ctx.moveTo(x, y); // tip
      ctx.lineTo(x + 5, y - 5);
      ctx.lineTo(x + 2, y - 5);
      ctx.lineTo(x + 2, y - 12);
      ctx.lineTo(x - 2, y - 12);
      ctx.lineTo(x - 2, y - 5);
      ctx.lineTo(x - 5, y - 5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

const PANEL_INDICATORS = ['RSI', 'MACD', 'ATR', 'Stochastic', 'CCI', 'OBV', 'MFI', 'ADX', 'Aroon', 'WilliamsPercentRange', 'ChaikinMF', 'Momentum', 'ROC'];

// Drawing factory mapping type names to constructor classes
const createDrawingFromSerialized = (type: string, data: SerializedDrawing) => {
  switch (type) {
    case 'trend-line':
      return new TrendLine(data.id, data.anchors, data.style, data.options as any);
    case 'horizontal-line':
      return new HorizontalLine(data.id, data.anchors, data.style, data.options as any);
    case 'vertical-line':
      return new VerticalLine(data.id, data.anchors, data.style, data.options as any);
    case 'fib-retracement':
      return new FibRetracement(data.id, data.anchors, data.style, data.options as any);
    case 'rectangle':
      return new Rectangle(data.id, data.anchors, data.style, data.options as any);
    case 'triangle':
      return new Triangle(data.id, data.anchors, data.style, data.options as any);
    case 'brush':
      return new Brush(data.id, data.anchors, data.style, data.options as any);
    case 'text-annotation':
      return new TextAnnotation(data.id, data.anchors, data.style, data.options as any);
    case 'path':
      return new Path(data.id, data.anchors, data.style, data.options as any);
    case 'date-price-range':
      return new DatePriceRange(data.id, data.anchors, data.style, data.options as any);
    case 'long-position':
      return new LongPosition(data.id, data.anchors, data.style, data.options as any);
    case 'short-position':
      return new ShortPosition(data.id, data.anchors, data.style, data.options as any);
    default:
      console.warn('Unknown drawing type in factory:', type);
      return null;
  }
};

// Indicator calculation helper
const calculateIndicator = (type: string, bars: any[], inputs: any) => {
  try {
    switch (type) {
      case 'SMA': return Ind.SMA.calculate(bars, inputs);
      case 'EMA': return Ind.EMA.calculate(bars, inputs);
      case 'WMA': return Ind.WMA.calculate(bars, inputs);
      case 'HMA': return Ind.HMA.calculate(bars, inputs);
      case 'ALMA': return Ind.ALMA.calculate(bars, inputs);
      case 'DEMA': return Ind.DEMA.calculate(bars, inputs);
      case 'TEMA': return Ind.TEMA.calculate(bars, inputs);
      case 'LSMA': return Ind.LSMA.calculate(bars, inputs);
      case 'VWMA': return Ind.VWMA.calculate(bars, inputs);
      case 'BollingerBands': return Ind.BollingerBands.calculate(bars, inputs);
      case 'IchimokuCloud': return Ind.IchimokuCloud.calculate(bars, inputs);
      case 'DonchianChannels': return Ind.DonchianChannels.calculate(bars, inputs);
      case 'KeltnerChannels': return Ind.KeltnerChannels.calculate(bars, inputs);
      case 'ParabolicSAR': return Ind.ParabolicSAR.calculate(bars, inputs);
      case 'Supertrend': return Ind.Supertrend.calculate(bars, inputs);
      case 'RSI': return Ind.RSI.calculate(bars, inputs);
      case 'MACD': return Ind.MACD.calculate(bars, inputs);
      case 'ATR': return Ind.ATR.calculate(bars, inputs);
      case 'Stochastic': return Ind.Stochastic.calculate(bars, inputs);
      case 'CCI': return Ind.CCI.calculate(bars, inputs);
      case 'OBV': return Ind.OBV.calculate(bars, inputs);
      case 'MFI': return Ind.MFI.calculate(bars, inputs);
      case 'ADX': return Ind.ADX.calculate(bars, inputs);
      case 'Aroon': return Ind.Aroon.calculate(bars, inputs);
      case 'WilliamsPercentRange': return Ind.WilliamsPercentRange.calculate(bars, inputs);
      case 'ChaikinMF': return Ind.ChaikinMF.calculate(bars, inputs);
      case 'Momentum': return Ind.Momentum.calculate(bars, inputs);
      case 'ROC': return Ind.ROC.calculate(bars, inputs);
      default: return null;
    }
  } catch (err) {
    console.error(`Error calculating ${type}:`, err);
    return null;
  }
};

export default forwardRef<ChartRef, ChartProps>(function Chart({
  candles,
  markers = [],
  positions = [],
  symbol: _symbol,
  onCrosshairMove,
  activeTool = null,
  drawings = [],
  onDrawingChange,
  activeIndicators = [],
  chartType = 'Candles',
  sessionKey,
  displayTimezone = 'UTC',
  isMagnetMode = false,
  isJumpToBarActive = false,
  onJumpToBar,
  onSelectTool,
  timeframe,
  isZoomLocked = true,
  closedTrades = [],
  showTradeHistory = true,
  showTradeLevels = true,
  chartSettings,
  onUpdateSLTP,
  onUpdateEntryPrice,
  onClosePosition,
  onPlaceTrade,
}: ChartProps, ref) {
  const isShiftPressedRef = useRef(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; drawingId: string } | null>(null);
  const [settingsModalId, setSettingsModalId] = useState<string | null>(null);
  const [toolbarPositionState, setToolbarPositionState] = useState<{ x: number; y: number }>({ x: 120, y: 15 });
  const [renderTrigger, setRenderTrigger] = useState(0);
  const guidelineLinesRef = useRef<{ r1?: any; r15?: any; r2?: any; r3?: any }>({});
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<'stats' | 'targets' | 'journal' | 'appearance'>('stats');
  const copiedDrawingRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markerPrimitiveRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastHoveredLogicalRef = useRef<number | null>(null);
  const tradeHistoryPrimitiveRef = useRef<TradeHistoryPrimitive | null>(null);
  // Track candle data identity: first timestamp + last timestamp + count
  const dataSignatureRef = useRef<string>('');
  // Incremental series-sync bookkeeping (what the chart series currently hold)
  const syncedCountRef = useRef<number>(0);
  const syncedFirstTimeRef = useRef<number>(0);
  const syncedTailTimeRef = useRef<number>(0);
  const lastSyncedMarkersRef = useRef<ChartMarker[] | null>(null);
  const activeToolRef = useRef<string | null>(activeTool);
  const pendingAnchorsRef = useRef<Anchor[]>([]);
  const prevSessionKeyRef = useRef<string | undefined>(sessionKey);

  // Interactive Position Manager States
  const [activeDrag, setActiveDrag] = useState<{
    positionId: string;
    type: 'sl' | 'tp';
    startY: number;
    startPrice: number;
    currentPrice: number;
  } | null>(null);

  const [pendingMutation, setPendingMutation] = useState<{
    positionId: string;
    type: 'sl' | 'tp';
    price: number;
  } | null>(null);

  // inlineEdit state removed (entry no longer editable inline on chart)

  const [chartRect, setChartRect] = useState<{ width: number; height: number } | null>(null);
  const [viewportTrigger, setViewportTrigger] = useState(0);

  // References for Drawing Manager
  const drawingManagerRef = useRef<DrawingManager | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>[]>>(new Map());
  // Incremental indicator-sync bookkeeping
  const indicatorCandlePrevRef = useRef<{ count: number; firstTime: number; tailTime: number }>({ count: 0, firstTime: 0, tailTime: 0 });
  const prevIndicatorsIdentityRef = useRef<unknown>(null);

  // Keep track of active price lines to clean them up properly
  // Map of positionId -> { entryLine, slLine?, tpLine? }
  const priceLinesRef = useRef<Map<string, { entry: any; sl?: any; tp?: any }>>(new Map());

  const isMagnetModeRef = useRef<boolean>(isMagnetMode);
  const previewDrawingRef = useRef<any>(null);
  const isJumpToBarActiveRef = useRef<boolean>(isJumpToBarActive);
  const onJumpToBarRef = useRef<((timestamp: number) => void) | undefined>(onJumpToBar);
  const onSelectToolRef = useRef<((tool: string | null) => void) | undefined>(onSelectTool);

  // Helper to perform snapping of anchors to closest candle OHLC / rounding
  const performSnapping = (drawing: any, candlesData: CandleData[]) => {
    const snapMode = drawing.options?.snapMode; // 'high-low' | 'ohlc' | 'round' | null
    if (!snapMode || candlesData.length === 0) return;

    const config = getSymbolConfig(_symbol);
    let updated = false;
    const newAnchors = drawing.anchors.map((anchor: any) => {
      // Find closest candle by time
      let closestCandle = candlesData[0];
      let minDiff = Math.abs((candlesData[0].time as number) - (anchor.time as number));
      for (const c of candlesData) {
        const diff = Math.abs((c.time as number) - (anchor.time as number));
        if (diff < minDiff) {
          minDiff = diff;
          closestCandle = c;
        }
      }

      let snappedPrice = anchor.price;
      if (snapMode === 'ohlc') {
        const options = [closestCandle.open, closestCandle.high, closestCandle.low, closestCandle.close];
        let bestPrice = options[0];
        let bestDiff = Math.abs(anchor.price - bestPrice);
        for (const opt of options) {
          const d = Math.abs(anchor.price - opt);
          if (d < bestDiff) {
            bestDiff = d;
            bestPrice = opt;
          }
        }
        snappedPrice = bestPrice;
      } else if (snapMode === 'high-low') {
        const options = [closestCandle.high, closestCandle.low];
        snappedPrice = Math.abs(anchor.price - options[0]) < Math.abs(anchor.price - options[1]) ? options[0] : options[1];
      } else if (snapMode === 'round') {
        const factor = Math.pow(10, Math.max(0, config.digits - 1));
        snappedPrice = Math.round(anchor.price * factor) / factor;
      }

      if (Math.abs(snappedPrice - anchor.price) > 0.00001) {
        updated = true;
        return { ...anchor, price: snappedPrice };
      }
      return anchor;
    });

    if (updated) {
      drawing.setAnchors(newAnchors);
      drawing.requestUpdate();
    }
  };

  // Helper to draw guide lines for 1R, 1.5R, 2R, 3R target levels on chart
  const updateGuidelines = (drawing: any, series: any) => {
    const gl = guidelineLinesRef.current;
    
    // Clean up old guide lines
    if (gl.r1) { try { series.removePriceLine(gl.r1); } catch (e) {} delete gl.r1; }
    if (gl.r15) { try { series.removePriceLine(gl.r15); } catch (e) {} delete gl.r15; }
    if (gl.r2) { try { series.removePriceLine(gl.r2); } catch (e) {} delete gl.r2; }
    if (gl.r3) { try { series.removePriceLine(gl.r3); } catch (e) {} delete gl.r3; }

    if (!drawing || !series) return;
    if (drawing.type !== 'long-position' && drawing.type !== 'short-position') return;
    if (!drawing.options?.showGuidelines) return;

    const anchors = drawing.anchors;
    if (!anchors || anchors.length < 2) return;

    const entry = anchors[0].price;
    const stopLoss = anchors[1].price;
    const diff = entry - stopLoss;

    try {
      gl.r1 = series.createPriceLine({
        price: entry + 1 * diff,
        color: 'rgba(0, 229, 255, 0.45)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '1.0 R',
      });
      gl.r15 = series.createPriceLine({
        price: entry + 1.5 * diff,
        color: 'rgba(0, 229, 255, 0.45)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '1.5 R',
      });
      gl.r2 = series.createPriceLine({
        price: entry + 2 * diff,
        color: 'rgba(0, 229, 255, 0.45)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '2.0 R',
      });
      gl.r3 = series.createPriceLine({
        price: entry + 3 * diff,
        color: 'rgba(0, 229, 255, 0.45)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '3.0 R',
      });
    } catch (err) {
      console.error('Failed to create guidelines:', err);
    }
  };

  useEffect(() => {
    // Run prototype overrides once to lock Long / Short Position tool width to price/time coordinates
    try {
      const registry = getToolRegistry();
      const longDef = registry.get('long-position');
      const shortDef = registry.get('short-position');
      console.log('[PrototypeOverrides] longDef:', longDef, 'shortDef:', shortDef);

      const overridePrototypes = (definition: any) => {
        if (!definition || !definition.factory) {
          console.warn('[PrototypeOverrides] Definition or factory missing for:', definition);
          return;
        }
        // Instantiate a dummy to get prototype references with safe arguments
        const dummy = definition.factory('dummy_id', [], {}, {});
        const DrawingProto = Object.getPrototypeOf(dummy);
        console.log('[PrototypeOverrides] Patching DrawingProto:', DrawingProto);
        
        // 1. Override computeGeometry
        DrawingProto.computeGeometry = function(t: any) {
          if (!this.isValid()) return [];
          const s = this.anchorToPixel(this._anchors[0], t);
          const e = this.anchorToPixel(this._anchors[1], t);
          const n = this.anchorToPixel(this._anchors[2], t);
          if (!s || !e || !n) return [];
          
          // Dynamic width calculation based on entry and target time difference
          let r = Math.abs(n.x - s.x);
          if (r < 5) {
            const barSpacing = t.timeScale.logicalToCoordinate ? (t.timeScale.logicalToCoordinate(1) - t.timeScale.logicalToCoordinate(0)) : 10;
            r = Math.max(50, barSpacing * 15);
          }
          
          const o = [];
          const a = Math.min(s.y, e.y);
          const c = Math.abs(e.y - s.y);
          o.push({
            type: "rectangle",
            topLeft: { x: s.x, y: a },
            width: r,
            height: c
          });
          const l = Math.min(s.y, n.y);
          const h = Math.abs(n.y - s.y);
          o.push({
            type: "rectangle",
            topLeft: { x: s.x, y: l },
            width: r,
            height: h
          });
          return o;
        };

        // 2. Override testHit
        DrawingProto.testHit = function(t: any, s: any) {
          if (!this.isValid()) return false;
          const e = this.anchorToPixel(this._anchors[0], s);
          const n = this.anchorToPixel(this._anchors[1], s);
          const o = this.anchorToPixel(this._anchors[2], s);
          if (!e || !n || !o) return false;
          
          let r = Math.abs(o.x - e.x);
          if (r < 5) {
            const barSpacing = s.timeScale.logicalToCoordinate ? (s.timeScale.logicalToCoordinate(1) - s.timeScale.logicalToCoordinate(0)) : 10;
            r = Math.max(50, barSpacing * 15);
          }
          
          const a = e.x;
          const c = e.x + r;
          const l = Math.min(n.y, o.y);
          const h = Math.max(n.y, o.y);
          return t.x >= a && t.x <= c && t.y >= l && t.y <= h;
        };

        // 3. Override paneViews and the renderer's drawImpl
        const paneViews = dummy.paneViews();
        if (paneViews && paneViews[0]) {
          const view = paneViews[0];
          const renderer = view.renderer();
          const RendererProto = Object.getPrototypeOf(renderer);
          console.log('[PrototypeOverrides] Patching RendererProto:', RendererProto);

          RendererProto.drawImpl = function(i: any) {
            const { context: t, horizontalPixelRatio: s } = i;
            const e = s;
            const n = this._drawing.getViewport();
            if (!n || !this._drawing.options.visible || !this._drawing.isValid()) return;
            const o = this._drawing.anchors;
            const r = this._drawing.anchorToPixel(o[0], n);
            const a = this._drawing.anchorToPixel(o[1], n);
            const c = this._drawing.anchorToPixel(o[2], n);
            if (!r || !a || !c) return;

            // Calculate dynamic width d
            let d = Math.abs(c.x - r.x);
            if (d < 5) {
              const barSpacing = n.timeScale.logicalToCoordinate ? (n.timeScale.logicalToCoordinate(1) - n.timeScale.logicalToCoordinate(0)) : 10;
              d = Math.max(50, barSpacing * 15);
            }

            const l = this._drawing.positionOptions;
            const h = this._drawing.getPositionInfo();
            
            // Draw stop loss area (red box)
            const isLong = this._drawing.type === 'long-position';
            t.fillStyle = isLong ? "rgba(239, 83, 80, 0.25)" : "rgba(38, 166, 154, 0.25)";
            const f = Math.min(r.y, a.y);
            const g = Math.abs(a.y - r.y);
            t.fillRect(r.x * e, f * e, d * e, g * e);
            t.strokeStyle = isLong ? "#ef5350" : "#26a69a";
            t.lineWidth = 1 * e;
            t.strokeRect(r.x * e, f * e, d * e, g * e);
            
            // Draw take profit area (green box)
            t.fillStyle = isLong ? "rgba(38, 166, 154, 0.25)" : "rgba(239, 83, 80, 0.25)";
            const _ = Math.min(r.y, c.y);
            const y = Math.abs(c.y - r.y);
            t.fillRect(r.x * e, _ * e, d * e, y * e);
            t.strokeStyle = isLong ? "#26a69a" : "#ef5350";
            t.lineWidth = 1 * e;
            t.strokeRect(r.x * e, _ * e, d * e, y * e);

            // Draw line helpers
            const drawLine = (ctx: any, p1: any, p2: any, ratio: number) => {
              ctx.beginPath();
              ctx.moveTo(p1.x * ratio, p1.y * ratio);
              ctx.lineTo(p2.x * ratio, p2.y * ratio);
              ctx.stroke();
            };

            // Entry line (solid blue)
            t.strokeStyle = "#2196F3";
            t.lineWidth = 2 * e;
            drawLine(t, { x: r.x, y: r.y }, { x: r.x + d, y: r.y }, e);

            // Stop loss boundary (dashed red/green)
            t.strokeStyle = isLong ? "#ef5350" : "#26a69a";
            t.lineWidth = 2 * e;
            t.setLineDash([5 * e, 3 * e]);
            drawLine(t, { x: r.x, y: a.y }, { x: r.x + d, y: a.y }, e);

            // Take profit boundary (dashed green/red)
            t.strokeStyle = isLong ? "#26a69a" : "#ef5350";
            drawLine(t, { x: r.x, y: c.y }, { x: r.x + d, y: c.y }, e);
            t.setLineDash([]);

            // Draw Labels
            const x = 11;
            t.font = `${x * e}px sans-serif`;
            t.textAlign = "left";
            t.textBaseline = "middle";
            const w = r.x + d + 5;
            
            // Entry Label
            t.fillStyle = "#2196F3";
            let P = "Entry";
            if (l.showPrices) P += `: $${h.entry.toFixed(2)}`;
            t.fillText(P, w * e, r.y * e);

            // Stop Loss Label
            t.fillStyle = isLong ? "#ef5350" : "#26a69a";
            let O = "Stop";
            if (l.showPrices) O += `: $${h.stopLoss.toFixed(2)}`;
            if (l.showPercentage) O += ` (-${h.riskPercent.toFixed(2)}%)`;
            t.fillText(O, w * e, a.y * e);

            // Target Label
            t.fillStyle = isLong ? "#26a69a" : "#ef5350";
            let m = "Target";
            if (l.showPrices) m += `: $${h.takeProfit.toFixed(2)}`;
            if (l.showPercentage) m += ` (+${h.rewardPercent.toFixed(2)}%)`;
            t.fillText(m, w * e, c.y * e);

            // R:R text overlay
            if (l.showRiskReward) {
              t.fillStyle = "#ffffff";
              const R = `R:R = 1:${h.riskRewardRatio.toFixed(2)}`;
              const S = (r.y + c.y) / 2;
              t.fillText(R, (r.x + 10) * e, S * e);
            }

            // Draw Title (LONG/SHORT)
            t.fillStyle = isLong ? "#26a69a" : "#ef5350";
            t.font = `bold ${14 * e}px sans-serif`;
            t.fillText(isLong ? "LONG" : "SHORT", (r.x + 10) * e, (r.y - 15) * e);

            // Draw control anchor dots if selected/editing
            const T = this._drawing.state;
            if (T === "selected" || T === "editing") {
              const controlPoints = this._drawing.getControlPoints(n);
              const drawAnchor = (ctx: any, pt: any, isSelected: boolean, ratio: number, color: string) => {
                const nx = pt.x * ratio;
                const ny = pt.y * ratio;
                const rad = 4 * ratio;
                const strokeW = 1.5 * ratio;
                ctx.beginPath();
                ctx.arc(nx, ny, rad, 0, Math.PI * 2);
                ctx.fillStyle = "#131722";
                ctx.fill();
                ctx.beginPath();
                ctx.arc(nx, ny, rad - strokeW / 2, 0, Math.PI * 2);
                ctx.strokeStyle = isSelected ? "#ffffff" : color;
                ctx.lineWidth = strokeW;
                ctx.stroke();
              };
              
              controlPoints.forEach((cp: any) => {
                drawAnchor(t, cp, cp.index === this._drawing._editingAnchorIndex, e, isLong ? "#26a69a" : "#ef5350");
              });

              // Draw horizontal width adjusting handle at the center-right edge of the entry line
              t.beginPath();
              t.arc((r.x + d) * e, r.y * e, 5.5 * e, 0, Math.PI * 2);
              t.fillStyle = "#ffffff";
              t.fill();
              t.strokeStyle = "#2196F3";
              t.lineWidth = 2 * e;
              t.stroke();
            }
          };
        }
      };

      overridePrototypes(longDef);
      overridePrototypes(shortDef);
      console.log('[PrototypeOverrides] Successfully patched LongPosition & ShortPosition classes.');
    } catch (err) {
      console.error('[PrototypeOverrides] Failed to override drawing prototypes:', err);
    }
  }, []);

  useEffect(() => {
    isMagnetModeRef.current = isMagnetMode;
  }, [isMagnetMode]);

  useEffect(() => {
    isJumpToBarActiveRef.current = isJumpToBarActive;
  }, [isJumpToBarActive]);

  useEffect(() => {
    onJumpToBarRef.current = onJumpToBar;
  }, [onJumpToBar]);

  useEffect(() => {
    onSelectToolRef.current = onSelectTool;
  }, [onSelectTool]);

  useImperativeHandle(ref, () => ({
    takeScreenshot: () => {
      if (chartRef.current) {
        const canvas = chartRef.current.takeScreenshot();
        return canvas.toDataURL('image/png');
      }
      return null;
    },
    removeDrawing: (id: string) => {
      if (drawingManagerRef.current) {
        drawingManagerRef.current.removeDrawing(id);
      }
    },
    clearDrawings: () => {
      drawingManagerRef.current?.clearAll();
      pendingAnchorsRef.current = [];
    },
    toggleFullscreen: () => {
      const page = document.querySelector('[class*="backtestContainer"]');
      if (page) {
        if (!document.fullscreenElement) {
          page.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
          });
        } else {
          document.exitFullscreen();
        }
      }
    },
    resetZoom: () => {
      const timeScale = chartRef.current?.timeScale();
      if (timeScale) {
        const targetIndex = (lastHoveredLogicalRef.current !== null)
          ? lastHoveredLogicalRef.current
          : (candles.length - 1);

        const visibleBars = 120;
        const half = Math.floor(visibleBars / 2);
        timeScale.setVisibleLogicalRange({
          from: targetIndex - half,
          to: targetIndex + half,
        });

        // Reset the right price scale mode to force a recalculation of the visible price heights
        chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
      }
    }
  }));

  // Initialize Chart
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create chart
    const chart = createChart(container, {
      layout: {
        background: { color: chartSettings?.backgroundColor || '#ffffff' },
        textColor: chartSettings?.scalesTextColor || '#131722',
        fontSize: chartSettings?.scalesFontSize || 12,
      },
      grid: {
        vertLines: { color: chartSettings?.showVertGridLines !== false ? (chartSettings?.vertGridColor || '#f0f3fa') : 'transparent' },
        horzLines: { color: chartSettings?.showHorzGridLines !== false ? (chartSettings?.horzGridColor || '#f0f3fa') : 'transparent' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: chartSettings?.crosshairColor || '#787b86',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: chartSettings?.crosshairColor || '#787b86',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: chartSettings?.scalesLinesColor || '#e0e3eb',
        autoScale: true,
      },
      timeScale: {
        borderColor: chartSettings?.scalesLinesColor || '#e0e3eb',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number, tickMarkType: number, locale: string) => {
          const date = new Date(time * 1000);
          const options: Intl.DateTimeFormatOptions = {
            timeZone: displayTimezone === 'Local' ? undefined : displayTimezone,
            hour12: false,
          };
          if (tickMarkType === 0) { // Year
            options.year = 'numeric';
          } else if (tickMarkType === 1) { // Month
            options.month = 'short';
          } else if (tickMarkType === 2) { // Day
            options.day = 'numeric';
          } else { // Time
            options.hour = '2-digit';
            options.minute = '2-digit';
          }
          try {
            return new Intl.DateTimeFormat(locale, options).format(date);
          } catch (e) {
            return new Intl.DateTimeFormat('en-US', options).format(date);
          }
        }
      },
      localization: {
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleString('en-US', {
            timeZone: displayTimezone === 'Local' ? undefined : displayTimezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        }
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
    });

    chartRef.current = chart;

    let candleSeries: any;
    if (chartType === 'Line') {
      candleSeries = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2 });
    } else if (chartType === 'Area') {
      candleSeries = chart.addSeries(AreaSeries, {
        lineColor: '#2962FF',
        topColor: 'rgba(41, 98, 255, 0.4)',
        bottomColor: 'rgba(41, 98, 255, 0.0)',
        lineWidth: 2,
      });
    } else if (chartType === 'Bars') {
      candleSeries = chart.addSeries(BarSeries, {
        upColor: chartSettings?.candleUpColor || '#089981',
        downColor: chartSettings?.candleDownColor || '#f23645',
      });
    } else {
      candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: chartSettings?.candleUpColor || '#089981',
        downColor: chartSettings?.candleDownColor || '#f23645',
        borderUpColor: chartSettings?.borderUpColor || '#089981',
        borderDownColor: chartSettings?.borderDownColor || '#f23645',
        wickUpColor: chartSettings?.wickUpColor || '#089981',
        wickDownColor: chartSettings?.wickDownColor || '#f23645',
      });
    }
    candleSeriesRef.current = candleSeries;

    // Initialize markers primitive for this series
    markerPrimitiveRef.current = createSeriesMarkers(candleSeries);

    // Initialize trade history custom primitive
    const tradeHistoryPrimitive = new TradeHistoryPrimitive(closedTrades || [], showTradeHistory ?? true);
    candleSeries.attachPrimitive(tradeHistoryPrimitive);
    tradeHistoryPrimitiveRef.current = tradeHistoryPrimitive;

    // Add Volume Series (overlaid at bottom)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume-scale',
    });
    volumeSeriesRef.current = volumeSeries;

    // Configure volume scale layout to overlay on main chart
    chart.priceScale('volume-scale').applyOptions({
      scaleMargins: {
        top: 0.82, // volume takes bottom 18%
        bottom: 0,
      },
    });

    // Initialize Drawing Manager
    const drawingManager = new DrawingManager();
    drawingManagerRef.current = drawingManager;
    drawingManager.attach(chart, candleSeries, container);

    // lightweight-charts-drawing exposes tool selection but does not create
    // drawings from chart clicks. Bridge that missing interaction here using chart's mouse event subscription.
    const handleDrawingClick = (param: MouseEventParams) => {
      // Handle Jump to Bar cutoff
      if (isJumpToBarActiveRef.current && param.time !== undefined) {
        if (onJumpToBarRef.current) {
          onJumpToBarRef.current(param.time as number);
        }
        return;
      }

      const toolType = activeToolRef.current;
      if (!toolType || !param.point) {
        return;
      }

      let time = param.time;
      if (time === undefined && param.point) {
        const timeScale = chart.timeScale();
        const logicalIndex = timeScale.coordinateToLogical(param.point.x);
        if (logicalIndex !== null && candles.length > 0) {
          const lastCandle = candles[candles.length - 1];
          const lastCandleLogical = timeScale.timeToCoordinate(lastCandle.time as any) !== null 
            ? timeScale.coordinateToLogical(timeScale.timeToCoordinate(lastCandle.time as any)!)
            : candles.length - 1;
          
          if (lastCandleLogical !== null) {
            const tfSecs = (TIMEFRAME_SECONDS as any)[timeframe || '15m'] || 900;
             time = ((lastCandle.time as number) + Math.round(logicalIndex - lastCandleLogical) * tfSecs) as any;
          }
        }
      }

      if (time === undefined) {
        return;
      }

      let price = candleSeries.coordinateToPrice(param.point.y);
      if (price === null) return;

      // Snapping / Magnet Mode
      if (isMagnetModeRef.current) {
        const candleData = param.seriesData.get(candleSeries) as any;
        if (candleData) {
          const o = candleData.open;
          const h = candleData.high;
          const l = candleData.low;
          const c = candleData.close;
          if (typeof o === 'number' && typeof h === 'number' && typeof l === 'number' && typeof c === 'number') {
            const ohlc = [o, h, l, c];
            let closest = o;
            let minDiff = Math.abs(price - o);
            for (const val of ohlc) {
              const diff = Math.abs(price - val);
              if (diff < minDiff) {
                minDiff = diff;
                closest = val;
              }
            }
            price = closest;
          }
        }
      }

      const registry = getToolRegistry();
      const definition = registry.get(toolType);
      if (!definition) {
        console.warn(`Unknown drawing tool: ${toolType}`);
        return;
      }

      // Handle path tool separately for continuous drawing
      if (toolType === 'path') {
        const nextAnchors = [
          ...pendingAnchorsRef.current,
          { time, price },
        ];
        pendingAnchorsRef.current = nextAnchors;

        if (nextAnchors.length === 1) {
          try {
            const tempDrawing = registry.createDrawing(
              'path',
              'preview',
              [{ time, price }, { time, price }],
              definition.defaultStyle,
              { ...definition.defaultOptions, closed: false } as any
            );
            if (tempDrawing) {
              drawingManager.addDrawing(tempDrawing);
              previewDrawingRef.current = tempDrawing;
            }
          } catch (err) {
            console.error('[Drawing] Failed to create preview path:', err);
          }
        } else {
          if (previewDrawingRef.current) {
            previewDrawingRef.current.setAnchors([...nextAnchors, { time, price }]);
            previewDrawingRef.current.requestUpdate();
          }
        }
        return;
      }

      const nextAnchors = [
        ...pendingAnchorsRef.current,
        { time, price },
      ];
      pendingAnchorsRef.current = nextAnchors;

      // First click: Create preview drawing
      if (nextAnchors.length === 1) {
        try {
          const tempDrawing = registry.createDrawing(
            toolType,
            'preview',
            Array(definition.requiredAnchors).fill({ time, price }),
            definition.defaultStyle,
            definition.defaultOptions
          );
          if (tempDrawing) {
            drawingManager.addDrawing(tempDrawing);
            previewDrawingRef.current = tempDrawing;
          }
        } catch (err) {
          console.error('[Drawing] Failed to create preview drawing:', err);
        }
      }

      // If we need more anchors, update the preview and wait
      if (nextAnchors.length < definition.requiredAnchors) {
        if (previewDrawingRef.current) {
          for (let i = 0; i < nextAnchors.length; i++) {
            previewDrawingRef.current.updateAnchor(i, nextAnchors[i]);
          }
        }
        console.log(`[Drawing] Collected anchor ${nextAnchors.length}/${definition.requiredAnchors} for ${toolType}`);
        return;
      }

      // Last click: Clear preview and add the permanent drawing
      if (previewDrawingRef.current) {
        drawingManager.removeDrawing('preview');
        previewDrawingRef.current = null;
      }

      console.log(`[Drawing] Creating permanent ${toolType} with ${nextAnchors.length} anchors`);
      const drawing = registry.createDrawing(
        toolType,
        crypto.randomUUID(),
        nextAnchors.slice(0, definition.requiredAnchors),
        definition.defaultStyle,
        definition.defaultOptions
      );

      if (drawing) {
        drawingManager.addDrawing(drawing);
        drawingManager.selectDrawing(drawing.id);
        
        // Auto deselect drawing tool after placement
        if (onSelectToolRef.current) {
          onSelectToolRef.current(null);
        }
      }
      pendingAnchorsRef.current = [];
    };

    // Double-click listener on chart container to end continuous path drawings / open settings modal
    const handleDblClick = (e: MouseEvent) => {
      const toolType = activeToolRef.current;
      if (toolType === 'path' && previewDrawingRef.current) {
        const anchors = pendingAnchorsRef.current;
        if (anchors.length >= 2) {
          // Remove the temporary preview drawing
          drawingManager.removeDrawing('preview');
          previewDrawingRef.current = null;

          const registry = getToolRegistry();
          const definition = registry.get('path');
          if (definition) {
            // Remove duplicate anchor added by second click of double-click event
            let finalAnchors = [...anchors];
            if (finalAnchors.length > 2) {
              const last = finalAnchors[finalAnchors.length - 1];
              const prev = finalAnchors[finalAnchors.length - 2];
              if (last.time === prev.time && Math.abs(last.price - prev.price) < 0.0001) {
                finalAnchors = finalAnchors.slice(0, -1);
              }
            }

            console.log(`[Drawing] Finalizing path drawing with ${finalAnchors.length} anchors`);
            const drawing = registry.createDrawing(
              'path',
              crypto.randomUUID(),
              finalAnchors,
              definition.defaultStyle,
              definition.defaultOptions
            );
            if (drawing) {
              drawingManager.addDrawing(drawing);
              drawingManager.selectDrawing(drawing.id);
            }
          }
        }

        // Auto deselect active tool
        if (onSelectToolRef.current) {
          onSelectToolRef.current(null);
        }
        pendingAnchorsRef.current = [];
      } else if (!toolType && drawingManager && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const pt = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        const hit = drawingManager.hitTest(pt);
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
          setSettingsModalId(hit.id);
        }
      }
    };

    // Right-click context menu event listener
    const handleContextMenu = (e: MouseEvent) => {
      if (!drawingManager || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const pt = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      const hit = drawingManager.hitTest(pt);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();

        drawingManager.selectDrawing(hit.id);
        setSelectedDrawingId(hit.id);

        setContextMenuState({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          drawingId: hit.id
        });
      }
    };

    // Subscribe to chart clicks via chart's mouse event API
    chart.subscribeClick(handleDrawingClick);

    const handleVisibleRangeChange = () => {
      drawingManager.getAllDrawings().forEach(drawing => {
        drawing.requestUpdate();
      });
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    // Subscribe to drawing events
    const handleDrawingEvent = () => {
      if (onDrawingChange) {
        // Filter out the temporary preview drawing from output
        const all = drawingManager.exportDrawings().filter(d => d.id !== 'preview');
        onDrawingChange(all);
      }
    };

    const unsubs: (() => void)[] = [
      drawingManager.on('drawing:added', () => {
        handleDrawingEvent();
        setRenderTrigger(prev => prev + 1);
      }),
      drawingManager.on('drawing:updated', () => {
        const selected = drawingManager.getSelectedDrawing();
        if (selected) {
          performSnapping(selected, candles);
          setSelectedDrawingId(selected.id);
          updateGuidelines(selected, candleSeries);
        }
        handleDrawingEvent();
        setRenderTrigger(prev => prev + 1);
      }),
      drawingManager.on('drawing:removed', () => {
        handleDrawingEvent();
        const selected = drawingManager.getSelectedDrawing();
        if (!selected) {
          setSelectedDrawingId(null);
          updateGuidelines(null, candleSeries);
        }
        setRenderTrigger(prev => prev + 1);
      }),
      drawingManager.on('drawing:cleared', () => {
        handleDrawingEvent();
        setSelectedDrawingId(null);
        updateGuidelines(null, candleSeries);
        setRenderTrigger(prev => prev + 1);
      }),
      drawingManager.on('drawing:selected', () => {
        const selected = drawingManager.getSelectedDrawing();
        if (selected) {
          console.log('[DrawingManager] selected:', selected.type, selected.id);
          setSelectedDrawingId(selected.id);
          updateGuidelines(selected, candleSeries);
          setRenderTrigger(prev => prev + 1);
          if (selected.anchors && selected.anchors.length > 0 && containerRef.current) {
            const tScale = chart.timeScale();
            const firstAnchor = selected.anchors[0];
            const xCoord = tScale.timeToCoordinate(firstAnchor.time as any);
            const yCoord = candleSeries.priceToCoordinate(firstAnchor.price);
            if (xCoord !== null && yCoord !== null) {
              setToolbarPositionState({
                x: Math.max(10, Math.min(xCoord - 100, containerRef.current.clientWidth - 300)),
                y: Math.max(10, Math.min(yCoord - 60, containerRef.current.clientHeight - 50))
              });
            }
          }
        }
      }),
      drawingManager.on('drawing:deselected', () => {
        setSelectedDrawingId(null);
        setContextMenuState(null);
        updateGuidelines(null, candleSeries);
        setRenderTrigger(prev => prev + 1);
      }),
    ].filter((unsub): unsub is () => void => unsub !== undefined);

    // Crosshair Move Handling (includes OHLC and drawing preview)
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (param.logical !== undefined && param.logical !== null) {
        lastHoveredLogicalRef.current = param.logical as number;
      }
      // Update preview drawing anchors if a preview is active
      const toolType = activeToolRef.current;
      if (toolType && previewDrawingRef.current && param.point && param.time !== undefined) {
        let price = candleSeries.coordinateToPrice(param.point.y);
        const time = param.time;

        if (price !== null) {
          // Snap price to closest candle OHLC if magnet mode is enabled
          if (isMagnetModeRef.current) {
            const candleData = param.seriesData.get(candleSeries) as any;
            if (candleData) {
              const o = candleData.open;
              const h = candleData.high;
              const l = candleData.low;
              const c = candleData.close;
              if (typeof o === 'number' && typeof h === 'number' && typeof l === 'number' && typeof c === 'number') {
                const ohlc = [o, h, l, c];
                let closest = o;
                let minDiff = Math.abs(price - o);
                for (const val of ohlc) {
                  const diff = Math.abs(price - val);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closest = val;
                  }
                }
                price = closest;
              }
            }
          }

          if (toolType === 'path') {
            const nextPreviewAnchors = [
              ...pendingAnchorsRef.current,
              { time, price }
            ];
            previewDrawingRef.current.setAnchors(nextPreviewAnchors);
            previewDrawingRef.current.requestUpdate();
          } else {
            // Update all remaining anchors of the preview drawing to follow the crosshair
            const startIdx = pendingAnchorsRef.current.length;
            const totalAnchors = previewDrawingRef.current.anchors.length;
            for (let i = startIdx; i < totalAnchors; i++) {
              previewDrawingRef.current.updateAnchor(i, { time, price });
            }
          }
        }
      }

      if (!onCrosshairMove) return;

      if (
        !param.time ||
        param.point === undefined ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        onCrosshairMove(null);
        return;
      }

      const candleData = param.seriesData.get(candleSeries);
      const volumeData = param.seriesData.get(volumeSeries);

      if (candleData) {
        let cOpen, cHigh, cLow, cClose, cTime;
        if ('open' in candleData) {
          const c = candleData as any;
          cOpen = c.open; cHigh = c.high; cLow = c.low; cClose = c.close; cTime = c.time;
        } else if ('value' in candleData) {
          const c = candleData as any;
          cClose = c.value; cOpen = c.value; cHigh = c.value; cLow = c.value; cTime = c.time;
        }

        const volVal = volumeData && 'value' in volumeData ? (volumeData.value as number) : undefined;
        const change = cClose - cOpen;
        const changePercent = (change / cOpen) * 100;

        onCrosshairMove({
          open: cOpen,
          high: cHigh,
          low: cLow,
          close: cClose,
          time: typeof cTime === 'number' ? cTime : 0,
          volume: volVal,
          changePercent,
        });
      } else {
        onCrosshairMove(null);
      }
    });

    // Keyboard listener to delete, copy, paste selected drawings
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events when typing in inputs/textareas
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = drawingManager.getSelectedDrawing();
        if (selected && !selected.options?.locked) {
          drawingManager.removeDrawing(selected.id);
        }
      }

      // Copy (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const selected = drawingManager.getSelectedDrawing();
        if (selected) {
          e.preventDefault();
          const allDrawings = drawingManager.exportDrawings();
          const serialized = allDrawings.find(d => d.id === selected.id);
          if (serialized) {
            copiedDrawingRef.current = serialized;
          }
        }
      }

      // Paste (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedDrawingRef.current) {
          e.preventDefault();
          const serialized = copiedDrawingRef.current;
          const registry = getToolRegistry();
          const definition = registry.get(serialized.type);
          if (definition) {
            // Shift the anchors slightly to the right (e.g. by 1 candle time interval)
            const candlesCount = candles.length;
            const shiftTime = candlesCount > 2 ? (candles[candlesCount - 1].time - candles[candlesCount - 2].time) : 900;
            const newAnchors = serialized.anchors.map((a: any) => ({
              time: ((a.time as number) + shiftTime) as any,
              price: a.price
            }));
            const newId = crypto.randomUUID();
            const pasted = registry.createDrawing(
              serialized.type,
              newId,
              newAnchors,
              { ...serialized.style },
              { ...serialized.options, locked: false }
            );
            if (pasted) {
              drawingManager.addDrawing(pasted);
              drawingManager.selectDrawing(newId);
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Custom drag-and-drop logic to allow dragging the entire body of drawings (like in TradingView)
    let isDraggingBody = false;
    let dragDrawing: any = null;
    let startPoint: { x: number; y: number } | null = null;
    let startAnchors: Anchor[] = [];
    let startLogical: number | null = null;
    let startPrice: number | null = null;

    let isDraggingAnchor = false;
    let dragAnchorIndex: number | null = null;
    let dragAnchorDrawing: any = null;
    let originalAnchors: Anchor[] = [];
    let isDraggingWidth = false;
    let dragWidthDrawing: any = null;
    let startWidthAnchors: Anchor[] = [];

    const timeScale = chart.timeScale();

    const getLastCandleLogical = () => {
      if (candles.length === 0) return null;
      const lastCandle = candles[candles.length - 1];
      const coord = timeScale.timeToCoordinate(lastCandle.time as any);
      if (coord !== null) {
        return timeScale.coordinateToLogical(coord);
      }
      return candles.length - 1;
    };

    const timeToLogical = (t: number): number | null => {
      const coord = timeScale.timeToCoordinate(t as any);
      if (coord !== null) {
        return timeScale.coordinateToLogical(coord);
      }
      if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const lastLogical = getLastCandleLogical();
        if (lastLogical !== null) {
          const tfSecs = (TIMEFRAME_SECONDS as any)[timeframe || '15m'] || 900;
          return lastLogical + Math.round((t - (lastCandle.time as number)) / tfSecs);
        }
      }
      return null;
    };

    const logicalToTime = (l: number): number | null => {
      const coord = timeScale.logicalToCoordinate(l as any);
      if (coord !== null) {
        const time = timeScale.coordinateToTime(coord);
        if (time !== null) return time as number;
      }
      if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const lastLogical = getLastCandleLogical();
        if (lastLogical !== null) {
          const tfSecs = (TIMEFRAME_SECONDS as any)[timeframe || '15m'] || 900;
           return (lastCandle.time as number) + Math.round(l - lastLogical) * tfSecs;
        }
      }
      return null;
    };

    const handleBodyPointerDown = (e: PointerEvent) => {
      // Touch-aware: accept touch/pen primary contact, and mouse left-button only
      const isTouchOrPen = e.pointerType === 'touch' || e.pointerType === 'pen';
      if (!isTouchOrPen && e.button !== 0) return;
      if (activeToolRef.current) return;
      if (!drawingManager || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const pt = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      // Check if we hit an anchor of the currently selected drawing.
      // If yes, let the DrawingManager handle it but register tracking for Shift snapping.
      const selected = drawingManager.getSelectedDrawing();
      if (selected) {
        const anchorIndex = drawingManager.hitTestAnchor(pt);
        if (anchorIndex !== null) {
          isDraggingAnchor = true;
          dragAnchorIndex = anchorIndex;
          dragAnchorDrawing = selected;
          
          const viewport = selected.getViewport();
          if (viewport) {
            originalAnchors = selected.getControlPoints(viewport).map((cp: any) => {
              const anchor = (selected as any).pixelToAnchor(cp, viewport);
              return anchor ? { ...anchor } : { time: 0, price: 0 };
            });
          } else {
            originalAnchors = selected.anchors.map((a: any) => ({ ...a }));
          }

          // Disable chart scrolling during anchor dragging
          chart.applyOptions({
            handleScroll: false
          });

          return; // Let library handle anchor dragging
        }

        // Check if we hit the dedicated horizontal width handle of the selected drawing (for long/short position)
        if (selected.type === 'long-position' || selected.type === 'short-position') {
          const viewport = selected.getViewport();
          if (viewport) {
            const entryPx = (selected as any).anchorToPixel(selected.anchors[0], viewport);
            const tpPx = (selected as any).anchorToPixel(selected.anchors[2], viewport);
            if (entryPx && tpPx) {
              let width = Math.abs(tpPx.x - entryPx.x);
              if (width < 5) {
                const barSpacing = (viewport as any).timeScale.logicalToCoordinate ? ((viewport as any).timeScale.logicalToCoordinate(1 as any) - (viewport as any).timeScale.logicalToCoordinate(0 as any)) : 10;
                width = Math.max(50, barSpacing * 15);
              }
              const handleX = entryPx.x + width;
              const handleY = entryPx.y;
              
              const dx = pt.x - handleX;
              const dy = pt.y - handleY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= 8) {
                isDraggingWidth = true;
                dragWidthDrawing = selected;
                startWidthAnchors = selected.anchors.map((a: any) => ({ ...a }));
                
                chart.applyOptions({
                  handleScroll: false
                });
                return;
              }
            }
          }
        }
      }

      // Check if we hit the body of any drawing
      const hit = drawingManager.hitTest(pt);
      if (hit && !hit.options.locked) {
        let drawingToDrag = hit;

        // If Ctrl is pressed (mouse), clone the drawing! (Ctrl + Drag shortcut)
        if (e.ctrlKey) {
          const registry = getToolRegistry();
          const definition = registry.get(hit.type);
          if (definition) {
            const newId = crypto.randomUUID();
            const cloned = registry.createDrawing(
              hit.type,
              newId,
              hit.anchors.map((a: any) => ({ ...a })),
              { ...hit.style },
              { ...hit.options, locked: false }
            );
            if (cloned) {
              drawingManager.addDrawing(cloned);
              drawingManager.selectDrawing(newId);
              drawingToDrag = cloned;
            }
          }
        } else {
          drawingManager.selectDrawing(hit.id);
        }

        isDraggingBody = true;
        dragDrawing = drawingToDrag;
        startPoint = pt;
        startAnchors = drawingToDrag.anchors.map((a: any) => ({ ...a }));
        
        startLogical = timeScale.coordinateToLogical(pt.x);
        startPrice = candleSeries.coordinateToPrice(pt.y);

        if (containerRef.current) {
          containerRef.current.setAttribute('data-dragging-drawing', 'true');
        }

        // Disable chart scrolling during body dragging
        chart.applyOptions({
          handleScroll: false
        });

        // Stop chart from panning
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const handleBodyPointerMove = (e: PointerEvent) => {
      // 0. Width handle dragging logic (Horizontal width adjust only)
      if (isDraggingWidth && dragWidthDrawing) {
        const rect = containerRef.current!.getBoundingClientRect();
        const pt = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        const currentLogical = timeScale.coordinateToLogical(pt.x);
        if (currentLogical !== null) {
          const entryLogical = timeToLogical(startWidthAnchors[0].time as number);
          if (entryLogical !== null) {
            // Force horizontal direction - anchors[2].time updates, price stays TP price
            const targetLogical = Math.max(entryLogical + 1, currentLogical);
            const timeVal = logicalToTime(targetLogical);
            if (timeVal !== null) {
              const anchors = [...dragWidthDrawing.anchors];
              anchors[2] = {
                ...anchors[2],
                time: timeVal as any
              };
              dragWidthDrawing.setAnchors(anchors);
              dragWidthDrawing.requestUpdate();
              
              // update guidelines
              updateGuidelines(dragWidthDrawing, candleSeriesRef.current);
              
              setRenderTrigger(prev => prev + 1);
            }
          }
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      // 1. Shift key anchor dragging constraint (horizontal-only / vertical-only)
      if (isDraggingAnchor && dragAnchorDrawing && dragAnchorIndex !== null) {
        if (isShiftPressedRef.current && originalAnchors[dragAnchorIndex]) {
          const rect = containerRef.current!.getBoundingClientRect();
          const pt = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };
          
          const currentLogical = timeScale.coordinateToLogical(pt.x);
          const currentPrice = candleSeries.coordinateToPrice(pt.y);
          
          if (currentLogical !== null && currentPrice !== null) {
            const origAnchor = originalAnchors[dragAnchorIndex];
            const origLogical = timeToLogical(origAnchor.time as number);
            
            if (origLogical !== null) {
              const origY = candleSeries.priceToCoordinate(origAnchor.price);
              if (origY !== null) {
                const dy = pt.y - origY;
                const dx = pt.x - timeScale.logicalToCoordinate(origLogical as any)!;
                
                let targetTime = origAnchor.time;
                let targetPrice = origAnchor.price;
                
                if (Math.abs(dx) > Math.abs(dy)) {
                  // Moved more horizontally -> lock price (Horizontal Resize Only)
                  const targetLogical = currentLogical;
                  const t = logicalToTime(targetLogical);
                   if (t !== null) targetTime = t as any;
                  targetPrice = origAnchor.price;
                } else {
                  // Moved more vertically -> lock time (Vertical Resize Only)
                  targetTime = origAnchor.time;
                  targetPrice = currentPrice;
                }
                
                // Update the anchor in the drawing!
                dragAnchorDrawing.updateAnchor(dragAnchorIndex, { time: targetTime, price: targetPrice });
                dragAnchorDrawing.requestUpdate();
                
                e.stopPropagation();
                e.preventDefault();
                return;
              }
            }
          }
        }
      }

      if (!isDraggingBody || !dragDrawing || !startPoint || startLogical === null || startPrice === null) return;

      const rect = containerRef.current!.getBoundingClientRect();
      const pt = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      const currentLogical = timeScale.coordinateToLogical(pt.x);
      const currentPrice = candleSeries.coordinateToPrice(pt.y);

      if (currentLogical === null || currentPrice === null) return;

      const deltaLogical = currentLogical - startLogical;
      const deltaPrice = currentPrice - startPrice;

      if (deltaLogical === 0 && deltaPrice === 0) return;

      // Shift anchors by delta logical index and price
      const newAnchors = startAnchors.map(anchor => {
        const logical = timeToLogical(anchor.time as number);
        if (logical === null) return anchor;

        const targetLogical = logical + deltaLogical;
        const time = logicalToTime(targetLogical);
        if (time === null) return anchor;

        return {
          time: time as any,
          price: anchor.price + deltaPrice
        };
      });

      dragDrawing.setAnchors(newAnchors);
      dragDrawing.requestUpdate();

      // Stop propagation to prevent chart from responding
      e.stopPropagation();
      e.preventDefault();
    };

    const handleBodyPointerUp = (e: PointerEvent) => {
      if (isDraggingAnchor) {
        isDraggingAnchor = false;
        dragAnchorIndex = null;
        dragAnchorDrawing = null;
        originalAnchors = [];

        // Re-enable chart scrolling
        chart.applyOptions({
          handleScroll: activeToolRef.current
            ? false
            : {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
              }
        });

        if (onDrawingChange) {
          const all = drawingManager.exportDrawings().filter((d: any) => d.id !== 'preview');
          onDrawingChange(all);
        }
      }

      if (isDraggingBody) {
        isDraggingBody = false;

        // Re-enable chart scrolling
        chart.applyOptions({
          handleScroll: activeToolRef.current
            ? false
            : {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
              }
        });

        if (dragDrawing && onDrawingChange) {
          // Trigger drawing change callback to save the updated drawing to state and database
          const all = drawingManager.exportDrawings().filter((d: any) => d.id !== 'preview');
          onDrawingChange(all);
        }
        dragDrawing = null;
        startPoint = null;
        startAnchors = [];
        startLogical = null;
        startPrice = null;

        if (containerRef.current) {
          containerRef.current.removeAttribute('data-dragging-drawing');
        }
        
        e.stopPropagation();
        e.preventDefault();
      }

      if (isDraggingWidth) {
        isDraggingWidth = false;

        // Re-enable chart scrolling
        chart.applyOptions({
          handleScroll: activeToolRef.current
            ? false
            : {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
              }
        });

        if (dragWidthDrawing && onDrawingChange) {
          const all = drawingManager.exportDrawings().filter((d: any) => d.id !== 'preview');
          onDrawingChange(all);
        }
        dragWidthDrawing = null;
        startWidthAnchors = [];
      }
    };

    const handlePointerMoveHover = (e: PointerEvent) => {
      // Hover hit-test only makes sense for mouse; on touch there's no hover state
      if (e.pointerType !== 'mouse') return;
      if (activeToolRef.current || isDraggingBody) return;
      if (!drawingManager || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const pt = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      const hit = drawingManager.hitTest(pt);
      if (hit && !hit.options.locked) {
        containerRef.current.setAttribute('data-hover-drawing', 'true');
      } else {
        containerRef.current.removeAttribute('data-hover-drawing');
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressedRef.current = true;
      }
    };
    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressedRef.current = false;
      }
    };

    // Register event listeners (Pointer Events = mouse + touch + pen)
    container.addEventListener('pointerdown', handleBodyPointerDown, true);
    container.addEventListener('pointermove', handlePointerMoveHover, true);
    container.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('pointermove', handleBodyPointerMove, true);
    window.addEventListener('pointerup', handleBodyPointerUp, true);
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    window.addEventListener('keyup', handleGlobalKeyUp, true);

    // Register double click listener
    container.addEventListener('dblclick', handleDblClick);

    // Resize Observer to handle responsiveness
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.resize(width, height);
    });
    resizeObserver.observe(container);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      if (container) {
        container.removeEventListener('pointerdown', handleBodyPointerDown, true);
        container.removeEventListener('pointermove', handlePointerMoveHover, true);
        container.removeEventListener('contextmenu', handleContextMenu, true);
        container.removeEventListener('dblclick', handleDblClick);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointermove', handleBodyPointerMove, true);
      window.removeEventListener('pointerup', handleBodyPointerUp, true);
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      window.removeEventListener('keyup', handleGlobalKeyUp, true);
      resizeObserver.disconnect();
      unsubs.forEach((unsub) => unsub());
      chart.unsubscribeClick(handleDrawingClick);
      drawingManager.detach();
      chart.remove();
      chartRef.current = null;
      if (tradeHistoryPrimitiveRef.current && candleSeriesRef.current) {
        try {
          candleSeriesRef.current.detachPrimitive(tradeHistoryPrimitiveRef.current);
        } catch {}
      }
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markerPrimitiveRef.current = null;
      tradeHistoryPrimitiveRef.current = null;
      drawingManagerRef.current = null;
      // Series were destroyed — force a full setData on next candle sync
      syncedCountRef.current = 0;
      syncedFirstTimeRef.current = 0;
      syncedTailTimeRef.current = 0;
    };
  }, [onCrosshairMove, chartType]);

  // 1. Sync viewport dimensions & scale changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleViewportChange = () => {
      setViewportTrigger(prev => prev + 1);
    };

    // Listen to timescale scroll/zoom
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleViewportChange);

    // Initial rect
    if (containerRef.current) {
      setChartRect({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      if (containerRef.current) {
        setChartRect({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
      setViewportTrigger(prev => prev + 1);
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleViewportChange);
      resizeObserver.disconnect();
    };
  }, [candles]);

  // 2. Global mouse drag-and-drop state machine (when activeDrag is not null)
  useEffect(() => {
    if (!activeDrag) return;

    // rAF throttle: pointermove can fire at 240Hz+ on high-refresh devices;
    // coalesce to at most one setActiveDrag (and thus one overlay re-render)
    // per animation frame.
    let rafId: number | null = null;
    let lastEvent: PointerEvent | null = null;

    const processMove = () => {
      rafId = null;
      const e = lastEvent;
      if (!e) return;
      const nextPrice = computeDragPrice(e);
      if (nextPrice === null) return;
      setActiveDrag(prev => {
        if (!prev) return null;
        if (prev.currentPrice === nextPrice) return prev;
        return { ...prev, currentPrice: nextPrice };
      });
    };

    // Derives the guarded, pip-snapped price for the current drag from a
    // pointer event. Shared by the per-frame update and the pointerup flush.
    const computeDragPrice = (e: PointerEvent): number | null => {
      const container = containerRef.current;
      const candleSeries = candleSeriesRef.current;
      if (!container || !candleSeries) return null;

      const rect = container.getBoundingClientRect();
      const currentY = e.clientY - rect.top;

      // No viewport clamping — coordinateToPrice extrapolates linearly beyond the
      // visible pane, so dragging above/below the chart yields prices past the candles
      const rawPrice = candleSeries.coordinateToPrice(currentY);
      if (rawPrice === null) return null;

      const config = getSymbolConfig(_symbol);
      // Snap to instrument min pip size (e.g. 0.1 for Gold)
      const snappedPrice = Math.round(rawPrice / config.pipSize) * config.pipSize;

      // Apply inversion guards & boundaries
      const position = positions.find(p => p.id === activeDrag.positionId);
      if (!position) return null;

      let finalPrice = snappedPrice;
      const entryPrice = position.entryPrice;

      if (activeDrag.type === 'tp') {
        if (position.type === 'BUY') {
          // TP must be above entry
          finalPrice = Math.max(entryPrice + config.pipSize, snappedPrice);
        } else {
          // TP must be below entry
          finalPrice = Math.min(entryPrice - config.pipSize, snappedPrice);
        }
      } else if (activeDrag.type === 'sl') {
        if (position.type === 'BUY') {
          // SL must be below entry
          finalPrice = Math.min(entryPrice - config.pipSize, snappedPrice);
        } else {
          // SL must be above entry
          finalPrice = Math.max(entryPrice + config.pipSize, snappedPrice);
        }
      }

      return parseFloat(finalPrice.toFixed(config.digits));
    };

    const handlePointerMove = (e: PointerEvent) => {
      lastEvent = e;
      if (rafId === null) {
        rafId = requestAnimationFrame(processMove);
      }
    };

    const handlePointerUp = () => {
      // Cancel any in-flight frame and resolve the definitive drop price from
      // the last pointer position (state may lag one frame behind).
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      const flushedPrice = lastEvent ? computeDragPrice(lastEvent) : null;
      if (activeDrag) {
        const dropPrice = flushedPrice ?? activeDrag.currentPrice;
        // Only trigger mutation confirmation if price actually changed
        if (dropPrice !== activeDrag.startPrice) {
          setPendingMutation({
            positionId: activeDrag.positionId,
            type: activeDrag.type,
            price: dropPrice,
          });
        }
        setActiveDrag(null);
      }

      // Re-enable chart scale and scroll (full options, incl. price-axis drag zoom)
      chartRef.current?.applyOptions({
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: {
            time: true,
            price: true,
          },
          axisDoubleClickReset: {
            time: true,
            price: true,
          },
        }
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag, positions, _symbol]);

  // Live update chart settings (colors, grid lines, background, crosshair)
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !chartSettings) return;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;

    chart.applyOptions({
      layout: {
        background: { color: chartSettings.backgroundColor || '#ffffff' },
        textColor: chartSettings.scalesTextColor || '#131722',
        fontSize: chartSettings.scalesFontSize || 12,
      },
      grid: {
        vertLines: {
          color: chartSettings.showVertGridLines !== false ? (chartSettings.vertGridColor || '#f0f3fa') : 'transparent',
          style: chartSettings.vertGridStyle === 'dashed' ? LineStyle.Dashed : chartSettings.vertGridStyle === 'dotted' ? LineStyle.Dotted : LineStyle.Solid,
        },
        horzLines: {
          color: chartSettings.showHorzGridLines !== false ? (chartSettings.horzGridColor || '#f0f3fa') : 'transparent',
          style: chartSettings.horzGridStyle === 'dashed' ? LineStyle.Dashed : chartSettings.horzGridStyle === 'dotted' ? LineStyle.Dotted : LineStyle.Solid,
        },
      },
      crosshair: {
        vertLine: {
          color: chartSettings.crosshairColor || '#787b86',
          style: chartSettings.crosshairStyle === 'dashed' ? LineStyle.Dashed : chartSettings.crosshairStyle === 'dotted' ? LineStyle.Dotted : LineStyle.Solid,
        },
        horzLine: {
          color: chartSettings.crosshairColor || '#787b86',
          style: chartSettings.crosshairStyle === 'dashed' ? LineStyle.Dashed : chartSettings.crosshairStyle === 'dotted' ? LineStyle.Dotted : LineStyle.Solid,
        },
      },
      rightPriceScale: {
        borderColor: chartSettings.scalesLinesColor || '#e0e3eb',
      },
      timeScale: {
        borderColor: chartSettings.scalesLinesColor || '#e0e3eb',
      },
    });

    if (chartType === 'Candles' || !chartType) {
      candleSeries.applyOptions({
        upColor: chartSettings.candleUpColor || '#089981',
        downColor: chartSettings.candleDownColor || '#f23645',
        borderUpColor: chartSettings.borderUpColor || '#089981',
        borderDownColor: chartSettings.borderDownColor || '#f23645',
        wickUpColor: chartSettings.wickUpColor || '#089981',
        wickDownColor: chartSettings.wickDownColor || '#f23645',
      });
    }
  }, [chartSettings, chartType]);

  // Sync Timeframe-specific visibility filter
  useEffect(() => {
    const manager = drawingManagerRef.current;
    if (!manager || !timeframe) return;

    let updatedAny = false;
    const all = manager.getAllDrawings();
    
    for (const drawing of all) {
      if (drawing.id === 'preview') continue;
      const visibleTimeframes = (drawing.options as any)?.visibleTimeframes;
      if (Array.isArray(visibleTimeframes)) {
        const isVisibleOnCurrentTf = visibleTimeframes.includes(timeframe);
        const currentlyVisible = drawing.options?.visible !== false;
        if (currentlyVisible !== isVisibleOnCurrentTf) {
          drawing.updateOptions({ visible: isVisibleOnCurrentTf });
          drawing.requestUpdate();
          updatedAny = true;
        }
      }
    }

    if (updatedAny && onDrawingChange) {
      onDrawingChange(manager.exportDrawings().filter(d => d.id !== 'preview'));
    }
  }, [timeframe, drawings]);

  const handleVisualOrder = (action: 'bring-to-front' | 'send-to-back', drawingId: string) => {
    if (!drawingManagerRef.current) return;
    const allSerialized = drawingManagerRef.current.exportDrawings();
    const targetIdx = allSerialized.findIndex(d => d.id === drawingId);
    if (targetIdx === -1) return;
    
    const target = allSerialized[targetIdx];
    const rest = allSerialized.filter(d => d.id !== drawingId);
    
    let newOrder: SerializedDrawing[];
    if (action === 'bring-to-front') {
      newOrder = [...rest, target];
    } else {
      newOrder = [target, ...rest];
    }

    drawingManagerRef.current.clearAll();
    drawingManagerRef.current.importDrawings(newOrder, createDrawingFromSerialized);
    
    drawingManagerRef.current.selectDrawing(drawingId);

    if (onDrawingChange) {
      onDrawingChange(newOrder.filter(d => d.id !== 'preview'));
    }
  };

  const handleDrawingAction = (action: string, drawingId: string) => {
    if (!drawingManagerRef.current) return;
    const drawing = drawingManagerRef.current.getDrawing(drawingId);
    if (!drawing) return;

    const id = drawing.id;
    const manager = drawingManagerRef.current;

    switch (action) {
      case 'clone': {
        const registry = getToolRegistry();
        const definition = registry.get(drawing.type);
        if (definition) {
          const allDrawings = manager.exportDrawings();
          const serialized = allDrawings.find(d => d.id === id);
          if (serialized) {
            const shiftTime = candles.length > 2 ? (candles[candles.length - 1].time - candles[candles.length - 2].time) : 900;
            const newAnchors = serialized.anchors.map((a: any) => ({
              time: ((a.time as number) + shiftTime) as any,
              price: a.price
            }));
            const newId = crypto.randomUUID();
            const cloned = registry.createDrawing(
              drawing.type,
              newId,
              newAnchors,
              { ...serialized.style },
              { ...serialized.options, locked: false }
            );
            if (cloned) {
              manager.addDrawing(cloned);
              manager.selectDrawing(newId);
              setSelectedDrawingId(newId);
            }
          }
        }
        setContextMenuState(null);
        break;
      }
      case 'copy': {
        const allDrawings = manager.exportDrawings();
        const serialized = allDrawings.find(d => d.id === id);
        if (serialized) {
          copiedDrawingRef.current = serialized;
        }
        setContextMenuState(null);
        break;
      }
      case 'bring-to-front':
        handleVisualOrder('bring-to-front', id);
        setContextMenuState(null);
        break;
      case 'send-to-back':
        handleVisualOrder('send-to-back', id);
        setContextMenuState(null);
        break;
      case 'toggle-lock': {
        const currentlyLocked = !!drawing.options?.locked;
        drawing.updateOptions({ locked: !currentlyLocked });
        drawing.requestUpdate();
        setSelectedDrawingId(id);
        if (onDrawingChange) {
          onDrawingChange(manager.exportDrawings().filter(d => d.id !== 'preview'));
        }
        setContextMenuState(null);
        break;
      }
      case 'toggle-hide': {
        const currentlyVisible = drawing.options?.visible !== false;
        drawing.updateOptions({ visible: !currentlyVisible });
        drawing.requestUpdate();
        setSelectedDrawingId(id);
        if (onDrawingChange) {
          onDrawingChange(manager.exportDrawings().filter(d => d.id !== 'preview'));
        }
        setContextMenuState(null);
        break;
      }
      case 'delete':
        manager.removeDrawing(id);
        setSelectedDrawingId(null);
        setContextMenuState(null);
        break;
      case 'settings':
        setSettingsModalId(id);
        setContextMenuState(null);
        break;
      default:
        break;
    }
  };

  const handleUpdateStyle = (styleUpdates: any) => {
    if (!drawingManagerRef.current || !selectedDrawingId) return;
    const selected = drawingManagerRef.current.getDrawing(selectedDrawingId);
    if (selected && typeof selected.updateStyle === 'function') {
      selected.updateStyle(styleUpdates);
      selected.requestUpdate();
      setRenderTrigger(prev => prev + 1);
      if (onDrawingChange) {
        onDrawingChange(drawingManagerRef.current.exportDrawings().filter(d => d.id !== 'preview'));
      }
    }
  };

  const handleUpdateOptions = (optionUpdates: any) => {
    if (!drawingManagerRef.current || !selectedDrawingId) return;
    const selected = drawingManagerRef.current.getDrawing(selectedDrawingId);
    if (selected && typeof selected.updateOptions === 'function') {
      selected.updateOptions(optionUpdates);
      selected.requestUpdate();
      setRenderTrigger(prev => prev + 1);
      if (onDrawingChange) {
        onDrawingChange(drawingManagerRef.current.exportDrawings().filter(d => d.id !== 'preview'));
      }
    }
  };

  const handleSaveSettings = (styleUpdates: any, optionUpdates: any) => {
    if (!drawingManagerRef.current || !settingsModalId) return;
    const target = drawingManagerRef.current.getDrawing(settingsModalId);
    if (target && typeof target.updateStyle === 'function') {
      target.updateStyle(styleUpdates);
      target.updateOptions(optionUpdates);
      target.requestUpdate();
      
      setRenderTrigger(prev => prev + 1);
      if (onDrawingChange) {
        onDrawingChange(drawingManagerRef.current.exportDrawings().filter(d => d.id !== 'preview'));
      }
    }
  };

  // Sync active drawing tool mode
  useEffect(() => {
    activeToolRef.current = activeTool;
    pendingAnchorsRef.current = [];

    if (previewDrawingRef.current && drawingManagerRef.current) {
      try {
        drawingManagerRef.current.removeDrawing('preview');
      } catch (e) {}
      previewDrawingRef.current = null;
    }

    if (drawingManagerRef.current) {
      drawingManagerRef.current.setActiveTool(activeTool);
    }

    chartRef.current?.applyOptions({
      handleScroll: activeTool
        ? false
        : {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
      handleScale: activeTool
        ? false
        : {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
          },
    });
  }, [activeTool]);

  // Sync drawings from props (handles undo/redo, tree toggle, and locks)
  useEffect(() => {
    const manager = drawingManagerRef.current;
    if (!manager) return;

    // Filter out preview drawing for comparison
    const managerDrawings = manager.exportDrawings().filter(d => d.id !== 'preview');

    if (!drawingsShallowEqual(drawings || [], managerDrawings)) {
      try {
        const prevSelectedId = selectedDrawingId;
        manager.clearAll();
        if (drawings && drawings.length > 0) {
          manager.importDrawings(drawings, createDrawingFromSerialized);
          // Restore selection if drawing still exists in the imported set
          if (prevSelectedId && manager.getDrawing(prevSelectedId)) {
            manager.selectDrawing(prevSelectedId);
            setSelectedDrawingId(prevSelectedId);
          }
        }
      } catch (e) {
        console.error('Error syncing drawings from props:', e);
      }
    }
  }, [drawings, selectedDrawingId]);

  // Sync Display Timezone options
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      localization: {
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleString('en-US', {
            timeZone: displayTimezone === 'Local' ? undefined : displayTimezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        }
      },
      timeScale: {
        tickMarkFormatter: (time: number, tickMarkType: number, locale: string) => {
          const date = new Date(time * 1000);
          const options: Intl.DateTimeFormatOptions = {
            timeZone: displayTimezone === 'Local' ? undefined : displayTimezone,
            hour12: false,
          };
          if (tickMarkType === 0) { // Year
            options.year = 'numeric';
          } else if (tickMarkType === 1) { // Month
            options.month = 'short';
          } else if (tickMarkType === 2) { // Day
            options.day = 'numeric';
          } else { // Time
            options.hour = '2-digit';
            options.minute = '2-digit';
          }
          try {
            return new Intl.DateTimeFormat(locale, options).format(date);
          } catch (e) {
            return new Intl.DateTimeFormat('en-US', options).format(date);
          }
        }
      }
    });
  }, [displayTimezone]);

  // Sync Candle Data & Markers
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;

    if (!candleSeries || !volumeSeries) return;

    if (candles.length === 0) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      markerPrimitiveRef.current?.setMarkers([]);
      dataSignatureRef.current = '';
      syncedCountRef.current = 0;
      syncedFirstTimeRef.current = 0;
      syncedTailTimeRef.current = 0;
      return;
    }

    // Convert a single candle to the active series format
    const toSeriesBar = (c: CandleData): any => {
      if (chartType === 'Line' || chartType === 'Area') {
        return { time: c.time as UTCTimestamp, value: c.close };
      }
      return {
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      };
    };
    const toVolumeBar = (c: CandleData): any => ({
      time: c.time as UTCTimestamp,
      value: c.volume || 0,
      color: c.close >= c.open ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 61, 0, 0.25)',
    });

    // Incremental replay path: when the new candle array extends the previously
    // synced one (same start, same bar at the old tail index), push only the
    // new/changed tail bars with series.update() instead of re-feeding the full
    // dataset with setData() — setData on every tick is the classic cause of
    // replay lag. Heikin Ashi recomputes its transform (pure math, cheap) but
    // still only updates the tail bars on the series.
    const prevCount = syncedCountRef.current;
    const canIncrement =
      prevCount > 0 &&
      candles.length >= prevCount &&
      candles.length - prevCount <= 10 &&
      candles[0].time === syncedFirstTimeRef.current &&
      candles[prevCount - 1].time === syncedTailTimeRef.current;

    if (canIncrement) {
      const haData = chartType === 'HeikinAshi' ? computeHeikinAshi(candles) : null;
      // Re-update from the previous tail bar (it may have been a partial edge
      // candle) through the newly appended bars.
      for (let i = prevCount - 1; i < candles.length; i++) {
        const source = haData ? haData[i] : candles[i];
        candleSeries.update(toSeriesBar(source as CandleData));
        volumeSeries.update(toVolumeBar(candles[i]));
      }
    } else {
      // Full re-sync (session load, timeframe switch, step backward, jump)
      let chartCandles: any[];
      if (chartType === 'HeikinAshi') {
        chartCandles = computeHeikinAshi(candles).map((c: any) => toSeriesBar(c));
      } else {
        chartCandles = candles.map(toSeriesBar);
      }
      candleSeries.setData(chartCandles);
      volumeSeries.setData(candles.map(toVolumeBar));
    }

    syncedCountRef.current = candles.length;
    syncedFirstTimeRef.current = candles[0].time;
    syncedTailTimeRef.current = candles[candles.length - 1].time;

    // Build a compact signature: firstTime_lastTime_count
    const newSignature = `${candles[0].time}_${candles[candles.length - 1].time}_${candles.length}`;
    const sessionChanged = sessionKey !== undefined && sessionKey !== prevSessionKeyRef.current;
    const dataChanged = newSignature !== dataSignatureRef.current;

    if (sessionChanged) {
      // Full reset / fit content for a brand new session
      chartRef.current?.timeScale().fitContent();
      prevSessionKeyRef.current = sessionKey;
      dataSignatureRef.current = newSignature;
    } else if (dataChanged) {
      // New candle generated during active replay
      if (isZoomLocked) {
        // Keep the latest candle in view but preserve user's zoom level
        chartRef.current?.timeScale().scrollToPosition(0, true);
      }
      dataSignatureRef.current = newSignature;
    }

    // Apply markers only when the markers prop identity actually changed —
    // this effect reruns on every candle tick, but markers only change when a
    // trade opens/closes.
    if (lastSyncedMarkersRef.current !== markers) {
      lastSyncedMarkersRef.current = markers;
      if (markers && markers.length > 0) {
        // Filter out trade entry/exit markers to prevent collision with custom primitive
        const filteredMarkers = markers.filter((m) => {
          // Keep "Replay Start" always
          if (m.text === 'Replay Start') return true;
          // Hide other trade history markers since they are rendered via the custom primitive
          return false;
        });

        // Ensure markers are sorted by time
        const sortedMarkers = [...filteredMarkers]
          .sort((a, b) => a.time - b.time)
          .map((m) => ({
            time: m.time as UTCTimestamp,
            position: m.position,
            color: m.color,
            shape: m.shape,
            text: m.text,
          }));

        if (markerPrimitiveRef.current) {
          markerPrimitiveRef.current.setMarkers(sortedMarkers);
        }
      } else {
        if (markerPrimitiveRef.current) {
          markerPrimitiveRef.current.setMarkers([]);
        }
      }
    }
  }, [candles, markers, chartType, sessionKey, showTradeHistory]);

  // Sync Trade History Primitive
  useEffect(() => {
    if (tradeHistoryPrimitiveRef.current) {
      tradeHistoryPrimitiveRef.current.updateTrades(closedTrades || [], showTradeHistory);
    }
  }, [closedTrades, showTradeHistory]);

  // Sync Technical Indicators
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;

    const currentSeriesMap = indicatorSeriesRef.current;
    const activeIds = new Set((activeIndicators || []).map((ind) => ind.id));

    // Detect the incremental replay tick: candles extended in place and the
    // indicator config is untouched. In that case each plot only changes at
    // its tail, so we push those points with series.update() instead of
    // re-feeding the whole plot with setData() every tick.
    const prevSync = indicatorCandlePrevRef.current;
    const sameIndicators = prevIndicatorsIdentityRef.current === activeIndicators;
    const appendedCount = candles.length - prevSync.count;
    const isIncrementalTick =
      sameIndicators &&
      prevSync.count > 0 &&
      appendedCount >= 0 &&
      appendedCount <= 10 &&
      candles[0].time === prevSync.firstTime &&
      candles[prevSync.count - 1]?.time === prevSync.tailTime;

    // Push tail points (previous tail bar may be a partial candle, so always
    // re-update it too) or fall back to a full setData re-sync.
    const syncPlot = (series: ISeriesApi<any>, data: any[]) => {
      if (isIncrementalTick && data.length > 0) {
        const tail = data.slice(-(appendedCount + 1));
        for (const p of tail) series.update(p);
      } else {
        series.setData(data);
      }
    };

    // 1. Remove series for indicators that are no longer active
    for (const [id, seriesList] of currentSeriesMap.entries()) {
      if (!activeIds.has(id)) {
        seriesList.forEach((series: ISeriesApi<any>) => {
          try {
            chart.removeSeries(series);
          } catch (e) {
            console.error('Error removing series:', e);
          }
        });
        currentSeriesMap.delete(id);
      }
    }

    // 2. Classify active indicators and calculate panel stacking
    const panelIndicators = (activeIndicators || []).filter((ind) => PANEL_INDICATORS.includes(ind.type));
    const N = panelIndicators.length;

    const panelHeight = 0.15; // 15% height for each panel
    const volumeHeight = 0.08; // 8% height for volume
    const bottomSpace = volumeHeight + N * panelHeight;

    // Scale margins only depend on the indicator set — skip on candle ticks
    if (!isIncrementalTick) {
      // Apply scale margins to main right price scale
      chart.priceScale('right').applyOptions({
        scaleMargins: {
          top: 0.05,
          bottom: bottomSpace,
        },
      });

      // Apply scale margins to volume scale
      chart.priceScale('volume-scale').applyOptions({
        scaleMargins: {
          top: 1.0 - bottomSpace,
          bottom: N * panelHeight,
        },
      });
    }

    // Helper to extract and filter non-null plot data
    const getPlotData = (plots: any, plotId: string) => {
      const data = plots[plotId] || [];
      return data
        .map((p: any) => ({
          time: p.time as UTCTimestamp,
          value: typeof p.value === 'number' && !isNaN(p.value) ? p.value : null,
        }))
        .filter((p: any) => p.value !== null);
    };

    // 3. Render and update active indicators
    for (const indicator of activeIndicators || []) {
      const res = calculateIndicator(indicator.type, candles, indicator.inputs);
      if (!res || !res.plots) continue;

      const panelIndex = panelIndicators.findIndex((p) => p.id === indicator.id);
      const isPanel = panelIndex !== -1;
      const scaleId = isPanel ? `${indicator.type.toLowerCase()}-${indicator.id}` : 'right';

      // Set scale options if it's a panel indicator
      if (isPanel) {
        chart.priceScale(scaleId).applyOptions({
          scaleMargins: {
            top: 1.0 - (panelIndex + 1) * panelHeight,
            bottom: panelIndex * panelHeight,
          },
          visible: true,
          borderColor: '#141722',
        });
      }

      let seriesList = currentSeriesMap.get(indicator.id);

      // Create series based on indicator type
      if (!seriesList) {
        seriesList = [];

        if (['SMA', 'EMA', 'WMA', 'HMA', 'ALMA', 'DEMA', 'TEMA', 'LSMA', 'VWMA', 'ATR', 'RSI', 'CCI', 'OBV', 'MFI', 'ADX', 'WilliamsPercentRange', 'ChaikinMF', 'Momentum', 'ROC'].includes(indicator.type)) {
          const series = chart.addSeries(LineSeries, {
            color: indicator.color || '#2962FF',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            priceScaleId: scaleId,
          });

          // Add threshold lines for specific indicators
          if (indicator.type === 'RSI') {
            series.createPriceLine({ price: 70, color: 'rgba(148, 163, 184, 0.25)', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '70' });
            series.createPriceLine({ price: 30, color: 'rgba(148, 163, 184, 0.25)', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '30' });
          } else if (indicator.type === 'CCI') {
            series.createPriceLine({ price: 100, color: 'rgba(148, 163, 184, 0.25)', lineWidth: 1, lineStyle: LineStyle.Dotted });
            series.createPriceLine({ price: -100, color: 'rgba(148, 163, 184, 0.25)', lineWidth: 1, lineStyle: LineStyle.Dotted });
          } else if (indicator.type === 'WilliamsPercentRange') {
            series.createPriceLine({ price: -20, color: 'rgba(148, 163, 184, 0.25)', lineWidth: 1, lineStyle: LineStyle.Dotted });
            series.createPriceLine({ price: -80, color: 'rgba(148, 163, 184, 0.25)', lineWidth: 1, lineStyle: LineStyle.Dotted });
          }

          seriesList.push(series);
        } else if (indicator.type === 'BollingerBands') {
          const basis = chart.addSeries(LineSeries, { color: indicator.color || '#fb8c00', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
          const upper = chart.addSeries(LineSeries, { color: 'rgba(41, 98, 255, 0.8)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          const lower = chart.addSeries(LineSeries, { color: 'rgba(41, 98, 255, 0.8)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          seriesList.push(basis, upper, lower);
        } else if (indicator.type === 'MACD') {
          const hist = chart.addSeries(HistogramSeries, { priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: false });
          const macd = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: false });
          const signal = chart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: false });
          seriesList.push(hist, macd, signal);
        } else if (indicator.type === 'Stochastic') {
          const percentK = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: false });
          const percentD = chart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: false });
          seriesList.push(percentK, percentD);
          percentK.createPriceLine({ price: 80, color: 'rgba(148, 163, 184, 0.25)', lineWidth: 1, lineStyle: LineStyle.Dotted });
          percentK.createPriceLine({ price: 20, color: 'rgba(148, 163, 184, 0.25)', lineWidth: 1, lineStyle: LineStyle.Dotted });
        } else if (indicator.type === 'Supertrend') {
          const upTrend = chart.addSeries(LineSeries, { color: '#089981', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
          const downTrend = chart.addSeries(LineSeries, { color: '#f23645', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
          seriesList.push(upTrend, downTrend);
        } else if (indicator.type === 'IchimokuCloud') {
          const conversion = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          const base = chart.addSeries(LineSeries, { color: '#B71C1C', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          const lagging = chart.addSeries(LineSeries, { color: '#43A047', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          const leadA = chart.addSeries(LineSeries, { color: '#A5D6A7', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          const leadB = chart.addSeries(LineSeries, { color: '#EF9A9A', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          seriesList.push(conversion, base, lagging, leadA, leadB);
        } else if (indicator.type === 'DonchianChannels') {
          const basis = chart.addSeries(LineSeries, { color: '#ff6d00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          const upper = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          const lower = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          seriesList.push(basis, upper, lower);
        } else if (indicator.type === 'KeltnerChannels') {
          const upper = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          const basis = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          const lower = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          seriesList.push(upper, basis, lower);
        } else if (indicator.type === 'ParabolicSAR') {
          const sar = chart.addSeries(LineSeries, { color: indicator.color || '#4caf50', lineWidth: 2, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false });
          seriesList.push(sar);
        } else if (indicator.type === 'Aroon') {
          const up = chart.addSeries(LineSeries, { color: '#FB8C00', lineWidth: 2, priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: false });
          const down = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, priceScaleId: scaleId, priceLineVisible: false, lastValueVisible: false });
          seriesList.push(up, down);
        }

        currentSeriesMap.set(indicator.id, seriesList);
      }

      // Populate series data
      if (['SMA', 'EMA', 'WMA', 'HMA', 'ALMA', 'DEMA', 'TEMA', 'LSMA', 'VWMA', 'ATR', 'RSI', 'CCI', 'OBV', 'MFI', 'ADX', 'WilliamsPercentRange', 'ChaikinMF', 'Momentum', 'ROC', 'ParabolicSAR'].includes(indicator.type)) {
        syncPlot(seriesList[0], getPlotData(res.plots, 'plot0'));
      } else if (['BollingerBands', 'DonchianChannels'].includes(indicator.type)) {
        syncPlot(seriesList[0], getPlotData(res.plots, 'plot0')); // Basis
        syncPlot(seriesList[1], getPlotData(res.plots, 'plot1')); // Upper
        syncPlot(seriesList[2], getPlotData(res.plots, 'plot2')); // Lower
      } else if (indicator.type === 'KeltnerChannels') {
        syncPlot(seriesList[0], getPlotData(res.plots, 'plot0')); // Upper
        syncPlot(seriesList[1], getPlotData(res.plots, 'plot1')); // Basis
        syncPlot(seriesList[2], getPlotData(res.plots, 'plot2')); // Lower
      } else if (indicator.type === 'MACD') {
        const rawHist = res.plots.plot0 || [];
        const histData = rawHist.map((p: any) => ({
          time: p.time as UTCTimestamp,
          value: typeof p.value === 'number' && !isNaN(p.value) ? p.value : 0,
          color: p.color || '#26A69A',
        }));
        syncPlot(seriesList[0], histData); // Histogram
        syncPlot(seriesList[1], getPlotData(res.plots, 'plot1')); // MACD
        syncPlot(seriesList[2], getPlotData(res.plots, 'plot2')); // Signal
      } else if (['Stochastic', 'Supertrend', 'Aroon'].includes(indicator.type)) {
        syncPlot(seriesList[0], getPlotData(res.plots, 'plot0'));
        syncPlot(seriesList[1], getPlotData(res.plots, 'plot1'));
      } else if (indicator.type === 'IchimokuCloud') {
        syncPlot(seriesList[0], getPlotData(res.plots, 'plot0')); // Conversion Line
        syncPlot(seriesList[1], getPlotData(res.plots, 'plot1')); // Base Line
        syncPlot(seriesList[2], getPlotData(res.plots, 'plot2')); // Lagging Span
        syncPlot(seriesList[3], getPlotData(res.plots, 'plot3')); // Leading Span A
        syncPlot(seriesList[4], getPlotData(res.plots, 'plot4')); // Leading Span B
      }
    }

    // Record what the series now hold for the next incremental check
    indicatorCandlePrevRef.current = {
      count: candles.length,
      firstTime: candles[0].time,
      tailTime: candles[candles.length - 1].time,
    };
    prevIndicatorsIdentityRef.current = activeIndicators;
  }, [candles, activeIndicators]);

  // Sync Position Lines (Entry, SL, TP)
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    const currentLinesMap = priceLinesRef.current;

    // Clear all static price lines (they are now rendered interactively by PositionManager)
    for (const [posId, lines] of currentLinesMap.entries()) {
      try {
        if (lines.entry) candleSeries.removePriceLine(lines.entry);
        if (lines.sl) candleSeries.removePriceLine(lines.sl);
        if (lines.tp) candleSeries.removePriceLine(lines.tp);
      } catch (e) {
        console.error('Failed to remove price line:', e);
      }
    }
    currentLinesMap.clear();
  }, [positions, showTradeLevels]);

  const selectedDrawing = selectedDrawingId ? drawingManagerRef.current?.getDrawing(selectedDrawingId) : null;
  const isPositionTool = selectedDrawing && (selectedDrawing.type === 'long-position' || selectedDrawing.type === 'short-position');

  const renderPositionToolPanel = (drawing: any) => {
    if (!drawing) return null;
    const isLong = drawing.type === 'long-position';

    // Retrieve anchors
    const entry = drawing.anchors[0]?.price || 0;
    const stopLoss = drawing.anchors[1]?.price || 0;
    const takeProfit = drawing.anchors[2]?.price || 0;

    // Symbol configuration
    const config = getSymbolConfig(_symbol);
    const riskPriceDiff = Math.abs(entry - stopLoss);
    const rewardPriceDiff = Math.abs(takeProfit - entry);
    const riskPips = riskPriceDiff / config.pipSize;
    const rewardPips = rewardPriceDiff / config.pipSize;
    const rr = riskPips > 0 ? (rewardPips / riskPips) : 0;

    // Load options
    const opt = drawing.options || {};
    const balance = opt.balance !== undefined ? opt.balance : 10000;
    const riskPercent = opt.riskPercent !== undefined ? opt.riskPercent : 1.0;
    const riskAmount = opt.riskAmount !== undefined ? opt.riskAmount : 100;
    const useFixedAmount = !!opt.useFixedAmount;
    const leverage = opt.leverage || '1:100';
    const commission = opt.commission !== undefined ? opt.commission : 7.0;
    const spread = opt.spread !== undefined ? opt.spread : 2.0;
    const snapMode = opt.snapMode || 'none';
    const showGuidelines = !!opt.showGuidelines;
    const notes = opt.notes || '';
    const checklist = opt.checklist || {};
    const psychology = opt.psychology || {
      emotion: 'Calm',
      confidence: 5,
      ruleFollowed: true,
      fomo: false,
      revengeTrade: false,
      patience: 5,
      discipline: 5,
      mistakes: [],
      lessons: '',
    };
    const partials = opt.partials || [
      { price: entry + (isLong ? rewardPriceDiff * 0.25 : -rewardPriceDiff * 0.25), percent: 25, active: false },
      { price: entry + (isLong ? rewardPriceDiff * 0.50 : -rewardPriceDiff * 0.50), percent: 50, active: false },
      { price: entry + (isLong ? rewardPriceDiff * 0.75 : -rewardPriceDiff * 0.75), percent: 25, active: false },
      { price: entry + (isLong ? rewardPriceDiff * 1.00 : -rewardPriceDiff * 1.00), percent: 100, active: false }
    ];
    const sessionName = opt.sessionName || 'London Session';

    // Lot Size calculation: standard MT4/MT5 forex/gold risk size
    const riskPipsWithSpread = riskPips + spread;
    const dollarRisk = useFixedAmount ? riskAmount : balance * (riskPercent / 100);
    const lotSize = riskPipsWithSpread > 0 ? (dollarRisk / (riskPipsWithSpread * config.pipValue)) : 0;
    const dollarReward = lotSize * rewardPips * config.pipValue;

    // Expected profit/loss after commission/spread costs
    const expectedProfit = dollarReward - (lotSize * commission);
    const expectedLoss = dollarRisk + (lotSize * commission);

    // Required win rate for breakeven
    const winRateRequired = rr > 0 ? (1 / (1 + rr)) * 100 : 50;

    // Scan candles since entry to calculate MAE, MFE and trade status
    const entryTime = drawing.anchors[0]?.time || 0;
    const tradeCandles = candles.filter(c => c.time >= entryTime);

    let status = 'Waiting';
    let exitIndex = -1;
    let exitPrice = 0;

    if (tradeCandles.length > 0) {
      status = 'Active';
      for (let i = 0; i < tradeCandles.length; i++) {
        const c = tradeCandles[i];
        if (isLong) {
          if (c.low <= stopLoss) {
            status = 'Stopped Out';
            exitIndex = i;
            exitPrice = stopLoss;
            break;
          } else if (c.high >= takeProfit) {
            status = 'Target Hit';
            exitIndex = i;
            exitPrice = takeProfit;
            break;
          }
        } else {
          if (c.high >= stopLoss) {
            status = 'Stopped Out';
            exitIndex = i;
            exitPrice = stopLoss;
            break;
          } else if (c.low <= takeProfit) {
            status = 'Target Hit';
            exitIndex = i;
            exitPrice = takeProfit;
            break;
          }
        }
      }
    }

    // MAE/MFE Calculations
    let mfePips = 0;
    let maePips = 0;
    if (tradeCandles.length > 0) {
      const activePeriodCandles = exitIndex !== -1 ? tradeCandles.slice(0, exitIndex + 1) : tradeCandles;
      if (isLong) {
        const maxHigh = Math.max(...activePeriodCandles.map(c => c.high));
        const minLow = Math.min(...activePeriodCandles.map(c => c.low));
        mfePips = Math.max(0, maxHigh - entry) / config.pipSize;
        maePips = Math.max(0, entry - minLow) / config.pipSize;
      } else {
        const minLow = Math.min(...activePeriodCandles.map(c => c.low));
        const maxHigh = Math.max(...activePeriodCandles.map(c => c.high));
        mfePips = Math.max(0, entry - minLow) / config.pipSize;
        maePips = Math.max(0, maxHigh - entry) / config.pipSize;
      }
    }

    const durationBars = status === 'Waiting' ? 0 : (exitIndex !== -1 ? exitIndex + 1 : tradeCandles.length);

    // Update helpers
    const handleUpdatePanelOption = (key: string, val: any) => {
      const updatedOptions = {
        ...drawing.options,
        [key]: val
      };
      
      if (key === 'showGuidelines') {
        drawing.options.showGuidelines = val;
        updateGuidelines(drawing, candleSeriesRef.current);
      }
      if (key === 'snapMode') {
        drawing.options.snapMode = val;
        performSnapping(drawing, candles);
      }

      handleUpdateOptions(updatedOptions);
    };

    const handleUpdatePsychology = (key: string, val: any) => {
      const nextPsych = {
        ...psychology,
        [key]: val
      };
      handleUpdatePanelOption('psychology', nextPsych);
    };

    // Keyboard entry level edits
    const handleUpdateAnchorPrice = (index: number, newPrice: number) => {
      if (isNaN(newPrice)) return;
      const anchors = [...drawing.anchors];
      anchors[index] = { ...anchors[index], price: parseFloat(newPrice.toFixed(config.digits)) };
      drawing.setAnchors(anchors);
      drawing.requestUpdate();
      
      // Keep guidelines aligned
      updateGuidelines(drawing, candleSeriesRef.current);
      
      if (onDrawingChange && drawingManagerRef.current) {
        onDrawingChange(drawingManagerRef.current.exportDrawings().filter(d => d.id !== 'preview'));
      }
      setRenderTrigger(prev => prev + 1);
    };

    const handleToggleChecklist = (item: string) => {
      const nextCheck = {
        ...checklist,
        [item]: !checklist[item]
      };
      handleUpdatePanelOption('checklist', nextCheck);
    };

    const handleTogglePartial = (index: number) => {
      const nextPartials = [...partials];
      nextPartials[index] = { ...nextPartials[index], active: !nextPartials[index].active };
      handleUpdatePanelOption('partials', nextPartials);
    };

    const handleUpdatePartialPrice = (index: number, priceVal: number) => {
      const nextPartials = [...partials];
      nextPartials[index] = { ...nextPartials[index], price: priceVal };
      handleUpdatePanelOption('partials', nextPartials);
    };

    const handleUpdatePartialPercent = (index: number, pct: number) => {
      const nextPartials = [...partials];
      nextPartials[index] = { ...nextPartials[index], percent: pct };
      handleUpdatePanelOption('partials', nextPartials);
    };

    // Copy to clipboard formatting
    const copyJournalTemplate = () => {
      const listItems = Object.entries(checklist)
        .filter(([_, active]) => active)
        .map(([key]) => `  - [x] ${key}`)
        .join('\n');
      
      const mistakesList = (psychology.mistakes || []).map((m: string) => `  - ${m}`).join('\n');

      const template = `### Trade Journal - ${_symbol} (${isLong ? 'LONG' : 'SHORT'})
- **Session:** ${sessionName}
- **Entry Price:** ${entry.toFixed(config.digits)}
- **Stop Loss:** ${stopLoss.toFixed(config.digits)} (${riskPips.toFixed(1)} pips)
- **Take Profit:** ${takeProfit.toFixed(config.digits)} (${rewardPips.toFixed(1)} pips)
- **Risk:Reward:** ${rr.toFixed(2)} R
- **Lot Size:** ${lotSize.toFixed(2)} lots
- **Trade Status:** ${status}
- **Trade Duration:** ${durationBars} bars

#### Psychology Log
- **Emotion:** ${psychology.emotion}
- **Confidence:** ${'*'.repeat(psychology.confidence)}${'.'.repeat(5 - psychology.confidence)}
- **Rule Followed:** ${psychology.ruleFollowed ? 'Yes' : 'No'}
- **FOMO:** ${psychology.fomo ? 'Yes' : 'No'}
- **Revenge Trade:** ${psychology.revengeTrade ? 'Yes' : 'No'}
- **Patience Rating:** ${psychology.patience}/10
- **Discipline Rating:** ${psychology.discipline}/10
${mistakesList ? `\n- **Mistakes Made:**\n${mistakesList}` : ''}
${psychology.lessons ? `\n- **Lessons Learned:**\n${psychology.lessons}` : ''}

#### Confirmation Checklist
${listItems || '  - None selected'}

#### Notes
${notes || 'No notes added.'}`;

      navigator.clipboard.writeText(template);
      toast.success('Journal template copied to clipboard!');
    };

    return (
      <div className={`${styles.positionPanel} ${isPanelMinimized ? styles.positionPanelMinimized : ''}`}>
        {isPanelMinimized ? (
          <button 
            className={styles.minimizeIcon} 
            onClick={() => setIsPanelMinimized(false)}
            title="Expand Position Panel"
          >
            P
          </button>
        ) : (
          <>
            {/* Panel Header */}
            <div className={styles.positionPanelHeader}>
              <div className={styles.panelTitle}>
                <span style={{ color: isLong ? '#089981' : '#f23645' }}>{isLong ? 'Long Position' : 'Short Position'}</span>
                <span className={styles.smallId}>#{drawing.id.substring(0, 6)}</span>
              </div>
              <div className={styles.headerActions}>
                <button 
                  className={styles.minimizeBtn} 
                  onClick={() => setIsPanelMinimized(true)}
                  title="Minimize"
                >
                  +
                </button>
                <button 
                  className={styles.closeBtn} 
                  onClick={() => {
                    if (drawingManagerRef.current) {
                      drawingManagerRef.current.deselectAll();
                    }
                  }}
                  title="Close Panel"
                >
                  -
                </button>
              </div>
            </div>

            {/* Tab Selection */}
            <div className={styles.tabRow}>
              <button 
                className={`${styles.tabBtn} ${activePanelTab === 'stats' ? styles.tabBtnActive : ''}`}
                onClick={() => setActivePanelTab('stats')}
              >
                Size & Stats
              </button>
              <button 
                className={`${styles.tabBtn} ${activePanelTab === 'targets' ? styles.tabBtnActive : ''}`}
                onClick={() => setActivePanelTab('targets')}
              >
                Targets
              </button>
              <button 
                className={`${styles.tabBtn} ${activePanelTab === 'journal' ? styles.tabBtnActive : ''}`}
                onClick={() => setActivePanelTab('journal')}
              >
                Journal
              </button>
              <button 
                className={`${styles.tabBtn} ${activePanelTab === 'appearance' ? styles.tabBtnActive : ''}`}
                onClick={() => setActivePanelTab('appearance')}
              >
                Style
              </button>
            </div>

            {/* Scrollable Contents */}
            <div className={styles.scrollContent}>
              {activePanelTab === 'stats' && (
                <>
                  <div className={styles.panelRow}>
                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel}>Account Balance</span>
                      <input 
                        type="number" 
                        className={styles.panelInput} 
                        value={balance} 
                        onChange={(e) => handleUpdatePanelOption('balance', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className={styles.panelRow}>
                    <div className={styles.panelCol} style={{ flex: 2 }}>
                      <span className={styles.panelLabel}>{useFixedAmount ? 'Fixed Risk Amount ($)' : 'Risk Percent (%)'}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {useFixedAmount ? (
                          <input 
                            type="number" 
                            className={styles.panelInput} 
                            value={riskAmount} 
                            onChange={(e) => handleUpdatePanelOption('riskAmount', parseFloat(e.target.value) || 0)}
                          />
                        ) : (
                          <>
                            <input 
                              type="range" 
                              min="0.1" 
                              max="10" 
                              step="0.1"
                              value={riskPercent} 
                              onChange={(e) => handleUpdatePanelOption('riskPercent', parseFloat(e.target.value))}
                              style={{ flex: 1, accentColor: 'var(--accent)' }}
                            />
                            <span style={{ minWidth: '40px', fontWeight: 600 }}>{riskPercent}%</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={styles.panelCol} style={{ flex: 1 }}>
                      <span className={styles.panelLabel}>Risk Type</span>
                      <button 
                        className={styles.outlineBtn}
                        onClick={() => handleUpdatePanelOption('useFixedAmount', !useFixedAmount)}
                      >
                        {useFixedAmount ? 'Fixed $' : 'Percent %'}
                      </button>
                    </div>
                  </div>

                  <div className={styles.panelRow}>
                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel}>Leverage</span>
                      <select 
                        className={styles.panelSelect}
                        value={leverage}
                        onChange={(e) => handleUpdatePanelOption('leverage', e.target.value)}
                      >
                        <option value="1:1">1:1</option>
                        <option value="1:10">1:10</option>
                        <option value="1:50">1:50</option>
                        <option value="1:100">1:100</option>
                        <option value="1:200">1:200</option>
                        <option value="1:500">1:500</option>
                      </select>
                    </div>
                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel}>Commission/lot ($)</span>
                      <input 
                        type="number" 
                        className={styles.panelInput} 
                        value={commission} 
                        onChange={(e) => handleUpdatePanelOption('commission', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className={styles.panelRow}>
                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel}>Spread (pips)</span>
                      <input 
                        type="number" 
                        className={styles.panelInput} 
                        value={spread} 
                        onChange={(e) => handleUpdatePanelOption('spread', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className={styles.menuDivider} style={{ margin: '4px 0', opacity: 0.1 }} />

                  {/* Calculator Outputs & Smart Stats */}
                  <div className={styles.statsGrid}>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Calculated Lot Size</span>
                      <span className={styles.statVal} style={{ color: 'var(--accent)' }}>{lotSize.toFixed(2)} lots</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Risk : Reward Ratio</span>
                      <span className={styles.statVal}>{rr.toFixed(2)} R</span>
                    </div>

                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Expected Profit (Net)</span>
                      <span className={`${styles.statVal} ${styles.statGreen}`}>{formatCurrency(expectedProfit)}</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Expected Loss (Net)</span>
                      <span className={`${styles.statVal} ${styles.statRed}`}>{formatCurrency(expectedLoss)}</span>
                    </div>

                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Required Win Rate</span>
                      <span className={styles.statVal}>{winRateRequired.toFixed(1)}%</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Status</span>
                      <span className={`${styles.statVal} ${status === 'Target Hit' ? styles.statGreen : status === 'Stopped Out' ? styles.statRed : ''}`}>{status}</span>
                    </div>

                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Max Favorable Excursion</span>
                      <span className={`${styles.statVal} ${styles.statGreen}`}>{mfePips.toFixed(1)} pips</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Max Adverse Excursion</span>
                      <span className={`${styles.statVal} ${styles.statRed}`}>{maePips.toFixed(1)} pips</span>
                    </div>

                    <div className={`${styles.statBox} ${styles.statBoxFull}`}>
                      <span className={styles.statLabel}>Trade Duration</span>
                      <span className={styles.statVal}>{durationBars} bars ({status === 'Waiting' ? 'Not Entry Yet' : timeframe || '15m'})</span>
                    </div>
                  </div>
                </>
              )}

              {activePanelTab === 'targets' && (
                <>
                  {/* Manual price level overrides */}
                  <div className={styles.panelRow}>
                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel}>Entry Price</span>
                      <input 
                        type="number" 
                        step={config.pipSize}
                        className={styles.panelInput} 
                        value={entry} 
                        onChange={(e) => handleUpdateAnchorPrice(0, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className={styles.panelRow}>
                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel} style={{ color: '#ef4444' }}>Stop Loss Price</span>
                      <input 
                        type="number" 
                        step={config.pipSize}
                        className={styles.panelInput} 
                        value={stopLoss} 
                        onChange={(e) => handleUpdateAnchorPrice(1, parseFloat(e.target.value) || 0)}
                      />
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Distance: {riskPips.toFixed(1)} pips</span>
                    </div>
                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel} style={{ color: '#22c55e' }}>Take Profit Price</span>
                      <input 
                        type="number" 
                        step={config.pipSize}
                        className={styles.panelInput} 
                        value={takeProfit} 
                        onChange={(e) => handleUpdateAnchorPrice(2, parseFloat(e.target.value) || 0)}
                      />
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Distance: {rewardPips.toFixed(1)} pips</span>
                    </div>
                  </div>

                  <div className={styles.guidelinesBox}>
                    <label className={styles.checkItem}>
                      <input 
                        type="checkbox" 
                        checked={showGuidelines} 
                        onChange={(e) => handleUpdatePanelOption('showGuidelines', e.target.checked)}
                      />
                      <span style={{ fontWeight: 600 }}>Show R-Multiples Target Lines</span>
                    </label>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      Draws horizontal targets representing 1R, 1.5R, 2R, and 3R multiples of risk directly on the chart.
                    </span>
                  </div>

                  {/* Partial Profits Target Configurator */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Partial Take Profits</span>
                    {partials.map((pt: any, idx: number) => {
                      const partialPips = Math.abs(pt.price - entry) / config.pipSize;
                      const partialRR = riskPips > 0 ? (partialPips / riskPips) : 0;
                      const expectedPartialProfit = (lotSize * (pt.percent / 100)) * partialPips * config.pipValue;

                      return (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px' }}>
                          <input 
                            type="checkbox" 
                            checked={pt.active}
                            onChange={() => handleTogglePartial(idx)}
                          />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.72rem', color: pt.active ? '#fff' : '#64748b' }}>TP {idx + 1} ({pt.percent}%)</span>
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Profit: {pt.active ? formatCurrency(expectedPartialProfit) : '$0'} ({partialRR.toFixed(1)}R)</span>
                          </div>
                          <input 
                            type="number"
                            step={config.pipSize}
                            disabled={!pt.active}
                            className={styles.panelInput}
                            style={{ width: '80px', padding: '4px', fontSize: '0.75rem', opacity: pt.active ? 1 : 0.4 }}
                            value={pt.price}
                            onChange={(e) => handleUpdatePartialPrice(idx, parseFloat(e.target.value) || 0)}
                          />
                          <input 
                            type="number"
                            disabled={!pt.active}
                            className={styles.panelInput}
                            style={{ width: '50px', padding: '4px', fontSize: '0.75rem', opacity: pt.active ? 1 : 0.4 }}
                            value={pt.percent}
                            onChange={(e) => handleUpdatePartialPercent(idx, parseInt(e.target.value) || 0)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {activePanelTab === 'journal' && (
                <>
                  <div className={styles.panelCol}>
                    <span className={styles.panelLabel}>Trading Session Name</span>
                    <input 
                      type="text" 
                      className={styles.panelInput} 
                      value={sessionName}
                      onChange={(e) => handleUpdatePanelOption('sessionName', e.target.value)}
                    />
                  </div>

                  {/* Checklist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontWeight: 600 }}>Strategy Checklist</span>
                    <div className={styles.checklistGrid}>
                      {['HTF Bias Confirmation', 'Liquidity Sweep', 'Market Structure Shift (MSS)', 'Order Block (OB) mitigation', 'Fair Value Gap (FVG) entry', 'Supply/Demand Zone interaction', 'Volume Expansion', 'Trading Session Open alignment', 'Red Folder News checked', 'Trend Alignment'].map((item) => (
                        <label key={item} className={styles.checkItem}>
                          <input 
                            type="checkbox" 
                            checked={!!checklist[item]} 
                            onChange={() => handleToggleChecklist(item)}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Psychology Log */}
                  <div className={styles.psychologyGrid}>
                    <span style={{ fontWeight: 600 }}>Psychology & Discipline</span>
                    
                    <div className={styles.panelRow}>
                      <div className={styles.panelCol}>
                        <span className={styles.panelLabel}>Dominant Emotion</span>
                        <select 
                          className={styles.panelSelect}
                          value={psychology.emotion}
                          onChange={(e) => handleUpdatePsychology('emotion', e.target.value)}
                        >
                          <option value="Calm">Calm / Patient</option>
                          <option value="Neutral">Neutral</option>
                          <option value="Greedy">Greedy / FOMO</option>
                          <option value="Fearful">Fearful / Hesitant</option>
                          <option value="Anxious">Anxious / Nervous</option>
                          <option value="Angry">Angry / Revengeful</option>
                        </select>
                      </div>

                      <div className={styles.panelCol}>
                        <span className={styles.panelLabel}>Confidence (1-5)</span>
                        <select 
                          className={styles.panelSelect}
                          value={psychology.confidence}
                          onChange={(e) => handleUpdatePsychology('confidence', parseInt(e.target.value))}
                        >
                          <option value="1">*</option>
                          <option value="2">**</option>
                          <option value="3">***</option>
                          <option value="4">****</option>
                          <option value="5">*****</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <label className={styles.checkItem} style={{ width: '45%' }}>
                        <input 
                          type="checkbox" 
                          checked={!!psychology.ruleFollowed} 
                          onChange={(e) => handleUpdatePsychology('ruleFollowed', e.target.checked)}
                        />
                        <span>Rules Followed</span>
                      </label>
                      <label className={styles.checkItem} style={{ width: '45%' }}>
                        <input 
                          type="checkbox" 
                          checked={!!psychology.fomo} 
                          onChange={(e) => handleUpdatePsychology('fomo', e.target.checked)}
                        />
                        <span>FOMO Entry</span>
                      </label>
                      <label className={styles.checkItem} style={{ width: '45%' }}>
                        <input 
                          type="checkbox" 
                          checked={!!psychology.revengeTrade} 
                          onChange={(e) => handleUpdatePsychology('revengeTrade', e.target.checked)}
                        />
                        <span>Revenge Trade</span>
                      </label>
                    </div>

                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel}>Patience Rating: {psychology.patience}/10</span>
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        value={psychology.patience || 5} 
                        onChange={(e) => handleUpdatePsychology('patience', parseInt(e.target.value))}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                    </div>

                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel}>Discipline Rating: {psychology.discipline}/10</span>
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        value={psychology.discipline || 5} 
                        onChange={(e) => handleUpdatePsychology('discipline', parseInt(e.target.value))}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                    </div>

                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel}>Mistakes Made</span>
                      <div className={styles.pillsRow}>
                        {['None', 'Overleveraged', 'Chased Price', 'Moved Stop Too Early', 'Closed Too Early', 'Ignored Rules', 'Flipped Bias', 'Felt Anxious'].map((m) => {
                          const active = (psychology.mistakes || []).includes(m);
                          return (
                            <span 
                              key={m} 
                              className={`${styles.pill} ${active ? styles.pillActive : ''}`}
                              onClick={() => {
                                const curr = psychology.mistakes || [];
                                const next = curr.includes(m) ? curr.filter((x: string) => x !== m) : [...curr, m];
                                handleUpdatePsychology('mistakes', next);
                              }}
                            >
                              {m}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className={styles.panelCol}>
                      <span className={styles.panelLabel}>Lessons Learned / Refined Plan</span>
                      <textarea 
                        className={styles.notesArea}
                        value={psychology.lessons || ''}
                        onChange={(e) => handleUpdatePsychology('lessons', e.target.value)}
                        placeholder="Write down reflections, lessons or notes on discipline..."
                      />
                    </div>
                  </div>

                  <div className={styles.panelCol}>
                    <span className={styles.panelLabel}>General Trade Notes</span>
                    <textarea 
                      className={styles.notesArea} 
                      value={notes}
                      onChange={(e) => handleUpdatePanelOption('notes', e.target.value)}
                      placeholder="Add charting markup explanations or trade logs..."
                    />
                  </div>
                </>
              )}

              {activePanelTab === 'appearance' && (
                <>
                  <div className={styles.panelCol}>
                    <span className={styles.panelLabel}>Smart Snapping Mode</span>
                    <select 
                      className={styles.panelSelect}
                      value={snapMode}
                      onChange={(e) => handleUpdatePanelOption('snapMode', e.target.value)}
                    >
                      <option value="none">None (Free Dragging)</option>
                      <option value="high-low">Wick Snapping (High/Low)</option>
                      <option value="ohlc">Body/Wick Snapping (OHLC)</option>
                      <option value="round">Round Price Snapping</option>
                    </select>
                  </div>

                  <div className={styles.panelCol}>
                    <span className={styles.panelLabel}>Line Thickness</span>
                    <select 
                      className={styles.panelSelect}
                      value={drawing.style?.lineWidth || 1}
                      onChange={(e) => handleUpdateStyle({ lineWidth: parseInt(e.target.value) || 1 })}
                    >
                      <option value="1">1 px</option>
                      <option value="2">2 px</option>
                      <option value="3">3 px</option>
                    </select>
                  </div>

                  <div className={styles.panelCol}>
                    <span className={styles.panelLabel}>Text Font Size</span>
                    <select 
                      className={styles.panelSelect}
                      value={drawing.style?.fontSize || 12}
                      onChange={(e) => handleUpdateStyle({ fontSize: parseInt(e.target.value) || 12 })}
                    >
                      <option value="10">10 px</option>
                      <option value="12">12 px</option>
                      <option value="14">14 px</option>
                    </select>
                  </div>

                  <div className={styles.menuDivider} style={{ margin: '10px 0', opacity: 0.1 }} />

                  {/* Export Box */}
                  <div className={styles.exportBox}>
                    <span style={{ fontWeight: 600 }}>Journal Copy & Export</span>
                    <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: 0 }}>
                      Copy a beautifully-formatted markdown summary of this trade to paste directly into your journal sheet.
                    </p>
                    <button className={styles.actionBtn} onClick={copyJournalTemplate}>
                      Copy Markdown Journal
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // Position Management Tool Helpers & Renderers

  const getLevelPrice = (position: OpenPosition, type: 'sl' | 'tp') => {
    if (activeDrag && activeDrag.positionId === position.id && activeDrag.type === type) {
      return activeDrag.currentPrice;
    }
    if (pendingMutation && pendingMutation.positionId === position.id && pendingMutation.type === type) {
      return pendingMutation.price;
    }
    if (type === 'sl') return position.stopLoss;
    if (type === 'tp') return position.takeProfit;
    return undefined;
  };

  const handleLinePointerDown = (e: React.PointerEvent, positionId: string, type: 'sl' | 'tp', currentPrice: number) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current!.getBoundingClientRect();
    const startY = e.clientY - rect.top;

    setActiveDrag({
      positionId,
      type,
      startY,
      startPrice: currentPrice,
      currentPrice: currentPrice,
    });

    // Disable chart scale/scroll while dragging
    chartRef.current?.applyOptions({
      handleScroll: false,
      handleScale: false,
    });
  };

  const handleConfirmMutation = (pos: OpenPosition, type: 'sl' | 'tp', price: number) => {
    if (onUpdateSLTP) {
      if (type === 'sl') {
        onUpdateSLTP(pos.id, price, pos.takeProfit);
      } else {
        onUpdateSLTP(pos.id, pos.stopLoss, price);
      }
    }
    setPendingMutation(null);
  };

  const handleDiscardMutation = () => {
    setPendingMutation(null);
  };

  const handleAddTP = (position: OpenPosition) => {
    const config = getSymbolConfig(_symbol);
    const defaultTP = position.type === 'BUY'
      ? position.entryPrice + 50 * config.pipSize
      : position.entryPrice - 50 * config.pipSize;
    const price = parseFloat(defaultTP.toFixed(config.digits));
    if (onUpdateSLTP) onUpdateSLTP(position.id, position.stopLoss, price);
  };

  const handleAddSL = (position: OpenPosition) => {
    const config = getSymbolConfig(_symbol);
    const defaultSL = position.type === 'BUY'
      ? position.entryPrice - 30 * config.pipSize
      : position.entryPrice + 30 * config.pipSize;
    const price = parseFloat(defaultSL.toFixed(config.digits));
    if (onUpdateSLTP) onUpdateSLTP(position.id, price, position.takeProfit);
  };

  const handleRemoveLevel = (pos: OpenPosition, type: 'sl' | 'tp') => {
    if (onUpdateSLTP) {
      if (type === 'sl') onUpdateSLTP(pos.id, undefined, pos.takeProfit);
      else onUpdateSLTP(pos.id, pos.stopLoss, undefined);
    }
  };

  // Esc listener for pending mutations
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pendingMutation) {
        setPendingMutation(null);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [pendingMutation]);

  const renderPositionManagerOverlay = () => {
    const activePositions = positions || [];
    if (activePositions.length === 0 || !chartRef.current || !candleSeriesRef.current || !chartRect) {
      return null;
    }

    const currentMarketPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
    const config = getSymbolConfig(_symbol);
    const pillRight = 70; // leave room for price axis

    return (
      <div className={styles.posOverlayContainer}>
        {/* SVG lines and shaded areas */}
        <svg className={styles.posSvgOverlay} width={chartRect.width} height={chartRect.height}>
          {activePositions.map((pos) => {
            const slPrice = getLevelPrice(pos, 'sl');
            const tpPrice = getLevelPrice(pos, 'tp');
            const yEntry = candleSeriesRef.current!.priceToCoordinate(pos.entryPrice);
            const ySL = slPrice != null ? candleSeriesRef.current!.priceToCoordinate(slPrice) : null;
            const yTP = tpPrice != null ? candleSeriesRef.current!.priceToCoordinate(tpPrice) : null;
            const w = chartRect.width;

            return (
              <g key={pos.id}>
                {/* TP shaded area + dashed line + drag trigger */}
                {yTP !== null && yEntry !== null && (
                  <g>
                    <rect x={0} y={Math.min(yEntry, yTP)} width={w} height={Math.abs(yTP - yEntry)}
                      fill="#089981" fillOpacity={0.06} />
                    <line x1={0} y1={yTP} x2={w} y2={yTP}
                      stroke="#089981" strokeWidth={1.5} strokeDasharray="6,3" />
                    <line x1={0} y1={yTP} x2={w} y2={yTP}
                      stroke="transparent" strokeWidth={14}
                      className={styles.posLineHoverTrigger}
                      onPointerDown={(e) => handleLinePointerDown(e, pos.id, 'tp', tpPrice!)} />
                  </g>
                )}

                {/* SL shaded area + dashed line + drag trigger */}
                {ySL !== null && yEntry !== null && (
                  <g>
                    <rect x={0} y={Math.min(yEntry, ySL)} width={w} height={Math.abs(ySL - yEntry)}
                      fill="#f23645" fillOpacity={0.06} />
                    <line x1={0} y1={ySL} x2={w} y2={ySL}
                      stroke="#f23645" strokeWidth={1.5} strokeDasharray="6,3" />
                    <line x1={0} y1={ySL} x2={w} y2={ySL}
                      stroke="transparent" strokeWidth={14}
                      className={styles.posLineHoverTrigger}
                      onPointerDown={(e) => handleLinePointerDown(e, pos.id, 'sl', slPrice!)} />
                  </g>
                )}

                {/* Entry line - solid blue, NOT draggable */}
                {yEntry !== null && (
                  <line x1={0} y1={yEntry} x2={w} y2={yEntry}
                    stroke="#2962ff" strokeWidth={2} />
                )}
              </g>
            );
          })}
        </svg>

        {/* DOM Control Pills */}
        {activePositions.map((pos) => {
          const slPrice = getLevelPrice(pos, 'sl');
          const tpPrice = getLevelPrice(pos, 'tp');
          const yEntry = candleSeriesRef.current!.priceToCoordinate(pos.entryPrice);
          const ySL = slPrice != null ? candleSeriesRef.current!.priceToCoordinate(slPrice) : null;
          const yTP = tpPrice != null ? candleSeriesRef.current!.priceToCoordinate(tpPrice) : null;
          const isBuy = pos.type === 'BUY';
          const currentPnL = calculatePnL(pos.entryPrice, currentMarketPrice, pos.lotSize, pos.type, _symbol);

          return (
            <div key={`pills-${pos.id}`}>
              {/* === ENTRY PILL === */}
              {yEntry !== null && (
                <div
                  className={`${styles.posControlPill} ${styles.posControlPillEntry}`}
                  style={{ top: `${yEntry}px`, right: `${pillRight}px`, left: 'auto' }}
                >
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>{pos.lotSize.toFixed(2)}</span>

                  {pos.takeProfit == null && (
                    <button className={styles.posActionButton}
                      onClick={() => handleAddTP(pos)}
                      style={{ color: '#089981', fontWeight: 700 }} title="Add TP">TP</button>
                  )}
                  {pos.stopLoss == null && (
                    <button className={styles.posActionButton}
                      onClick={() => handleAddSL(pos)}
                      style={{ color: '#f23645', fontWeight: 700 }} title="Add SL">SL</button>
                  )}

                  <span className={styles.posPillBadge}
                    style={{ background: isBuy ? '#2962ff' : '#f23645', color: '#fff', padding: '1px 6px' }}>
                    {pos.lotSize >= 1 ? pos.lotSize.toFixed(0) : pos.lotSize.toFixed(2)}
                  </span>

                  <span style={{ color: currentPnL >= 0 ? '#10b981' : '#f43f5e', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {currentPnL >= 0 ? '+' : ''}{formatCurrency(currentPnL)}
                  </span>

                  <button className={styles.posActionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClosePosition?.(pos.id);
                    }}
                    style={{ color: '#94a3b8', fontSize: '12px' }} title="Close position">x</button>
                </div>
              )}

              {/* === TP PILL === */}
              {yTP !== null && tpPrice != null && (
                <div
                  className={`${styles.posControlPill} ${styles.posControlPillTP}`}
                  style={{ top: `${yTP}px`, right: `${pillRight}px`, left: 'auto' }}
                >
                  {pendingMutation && pendingMutation.positionId === pos.id && pendingMutation.type === 'tp' ? (
                    <>
                      <button className={styles.posActionButton} onClick={handleDiscardMutation}
                        style={{ color: '#94a3b8', fontSize: '10px' }}>Discard</button>
                      <button className={styles.posActionButton} onClick={() => handleConfirmMutation(pos, 'tp', pendingMutation.price)}
                        style={{ background: '#089981', color: '#fff', padding: '2px 10px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', border: 'none' }}>Confirm</button>
                    </>
                  ) : null}

                  <span className={styles.posPillBadge}
                    style={{ background: '#089981', color: '#fff', padding: '1px 6px' }}>
                    {pos.lotSize >= 1 ? pos.lotSize.toFixed(0) : pos.lotSize.toFixed(2)}
                  </span>

                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>
                    +{formatCurrency(calculatePnL(pos.entryPrice, tpPrice, pos.lotSize, pos.type, _symbol))}
                  </span>

                  <button className={styles.posActionButton} onClick={() => handleRemoveLevel(pos, 'tp')}
                    style={{ color: '#f23645', fontSize: '12px' }} title="Remove TP">x</button>
                </div>
              )}

              {/* === SL PILL === */}
              {ySL !== null && slPrice != null && (
                <div
                  className={`${styles.posControlPill} ${styles.posControlPillSL}`}
                  style={{ top: `${ySL}px`, right: `${pillRight}px`, left: 'auto' }}
                >
                  {pendingMutation && pendingMutation.positionId === pos.id && pendingMutation.type === 'sl' ? (
                    <>
                      <button className={styles.posActionButton} onClick={handleDiscardMutation}
                        style={{ color: '#94a3b8', fontSize: '10px' }}>Discard</button>
                      <button className={styles.posActionButton} onClick={() => handleConfirmMutation(pos, 'sl', pendingMutation.price)}
                        style={{ background: '#089981', color: '#fff', padding: '2px 10px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', border: 'none' }}>Confirm</button>
                    </>
                  ) : null}

                  <span className={styles.posPillBadge}
                    style={{ background: '#f23645', color: '#fff', padding: '1px 6px' }}>
                    {pos.lotSize >= 1 ? pos.lotSize.toFixed(0) : pos.lotSize.toFixed(2)}
                  </span>

                  <span style={{ color: '#f43f5e', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {formatCurrency(calculatePnL(pos.entryPrice, slPrice, pos.lotSize, pos.type, _symbol))}
                  </span>

                  <button className={styles.posActionButton} onClick={() => handleRemoveLevel(pos, 'sl')}
                    style={{ color: '#f23645', fontSize: '12px' }} title="Remove SL">x</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={wrapperRef} className={styles.chartWrapper}>
      <div ref={containerRef} className={styles.chartContainer} />

      {/* Drawing Overlay Components */}
      {contextMenuState && drawingManagerRef.current?.getDrawing(contextMenuState.drawingId) && (
        <DrawingContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          drawing={drawingManagerRef.current.getDrawing(contextMenuState.drawingId)}
          onClose={() => setContextMenuState(null)}
          onAction={(action) => handleDrawingAction(action, contextMenuState.drawingId)}
        />
      )}

      {selectedDrawingId && drawingManagerRef.current?.getDrawing(selectedDrawingId) && (
        <DrawingFloatingToolbar
          x={toolbarPositionState.x}
          y={toolbarPositionState.y}
          drawing={drawingManagerRef.current.getDrawing(selectedDrawingId)}
          onPositionChange={setToolbarPositionState}
          onUpdateStyle={handleUpdateStyle}
          onUpdateOptions={handleUpdateOptions}
          onAction={(action) => {
            if (action === 'context' && containerRef.current) {
              setContextMenuState({
                x: toolbarPositionState.x + 250,
                y: toolbarPositionState.y + 35,
                drawingId: selectedDrawingId
              });
            } else {
              handleDrawingAction(action, selectedDrawingId);
            }
          }}
        />
      )}

      {settingsModalId && drawingManagerRef.current?.getDrawing(settingsModalId) && (
        <DrawingSettingsModal
          isOpen={true}
          drawing={drawingManagerRef.current.getDrawing(settingsModalId)}
          onClose={() => setSettingsModalId(null)}
          onSave={handleSaveSettings}
        />
      )}

      {/* Chart-Based Position Management Tool Overlay */}
      {showTradeLevels && renderPositionManagerOverlay()}

      {/* Top-Left Trading Widget Overlay (Screenshot 1) */}
      {chartSettings?.showBuySellButtons !== false && candles.length > 0 && (
        <div className={styles.topLeftTradingWidget}>
          <div className={styles.buySellGroup}>
            <button
              className={styles.tradeBtnSell}
              onClick={() => onPlaceTrade?.('SELL')}
              title="Sell Market Order"
            >
              <span>SELL</span>
              <span style={{ fontSize: '10px', opacity: 0.9 }}>
                {formatPrice(candles[candles.length - 1].close, _symbol)}
              </span>
            </button>

            <span className={styles.spreadBadge}>
              {getSymbolConfig(_symbol).pipSize >= 0.01 ? '87' : '12'}
            </span>

            <button
              className={styles.tradeBtnBuy}
              onClick={() => onPlaceTrade?.('BUY')}
              title="Buy Market Order"
            >
              <span>BUY</span>
              <span style={{ fontSize: '10px', opacity: 0.9 }}>
                {formatPrice(candles[candles.length - 1].close, _symbol)}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Position Tool Panel */}
      {isPositionTool && renderPositionToolPanel(selectedDrawing)}
    </div>
  );
});
