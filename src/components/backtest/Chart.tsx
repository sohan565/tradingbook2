'use client';

import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
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
} from 'lightweight-charts';
import type { CandleData, ChartMarker, OpenPosition, OHLCDisplay } from '@/types';
import styles from './Chart.module.css';
import { computeHeikinAshi } from '@/lib/heikin-ashi';

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
}

export interface ChartRef {
  takeScreenshot: () => string | null;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;
  toggleFullscreen: () => void;
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
}: ChartProps, ref) {
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; drawingId: string } | null>(null);
  const [settingsModalId, setSettingsModalId] = useState<string | null>(null);
  const [toolbarPositionState, setToolbarPositionState] = useState<{ x: number; y: number }>({ x: 120, y: 15 });
  const [_renderTrigger, setRenderTrigger] = useState(0);
  const copiedDrawingRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markerPrimitiveRef = useRef<any>(null);
  // Track candle data identity: first timestamp + last timestamp + count
  const dataSignatureRef = useRef<string>('');
  const activeToolRef = useRef<string | null>(activeTool);
  const pendingAnchorsRef = useRef<Anchor[]>([]);
  const prevSessionKeyRef = useRef<string | undefined>(sessionKey);

  // References for Drawing Manager
  const drawingManagerRef = useRef<DrawingManager | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>[]>>(new Map());

  // Keep track of active price lines to clean them up properly
  // Map of positionId -> { entryLine, slLine?, tpLine? }
  const priceLinesRef = useRef<Map<string, { entry: any; sl?: any; tp?: any }>>(new Map());

  const isMagnetModeRef = useRef<boolean>(isMagnetMode);
  const previewDrawingRef = useRef<any>(null);
  const isJumpToBarActiveRef = useRef<boolean>(isJumpToBarActive);
  const onJumpToBarRef = useRef<((timestamp: number) => void) | undefined>(onJumpToBar);
  const onSelectToolRef = useRef<((tool: string | null) => void) | undefined>(onSelectTool);

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
      if (containerRef.current) {
        if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
          });
        } else {
          document.exitFullscreen();
        }
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
        background: { color: '#07080a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#0f121a' },
        horzLines: { color: '#0f121a' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#334155',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: '#334155',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: '#141722',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#141722',
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
        upColor: '#00e676',
        downColor: '#ff3d00',
      });
    } else {
      candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00e676',
        downColor: '#ff3d00',
        borderUpColor: '#00e676',
        borderDownColor: '#ff3d00',
        wickUpColor: '#00e676',
        wickDownColor: '#ff3d00',
      });
    }
    candleSeriesRef.current = candleSeries;

    // Initialize markers primitive for this series
    markerPrimitiveRef.current = createSeriesMarkers(candleSeries);

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
      if (!toolType || !param.point || param.time === undefined) {
        return;
      }

      let price = candleSeries.coordinateToPrice(param.point.y);
      if (price === null) return;
      const time = param.time;

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

    // Subscribe to drawing events
    const handleDrawingEvent = () => {
      if (onDrawingChange) {
        // Filter out the temporary preview drawing from output
        const all = drawingManager.exportDrawings().filter(d => d.id !== 'preview');
        onDrawingChange(all);
      }
    };

    const unsubs: (() => void)[] = [
      drawingManager.on('drawing:added', handleDrawingEvent),
      drawingManager.on('drawing:updated', () => {
        handleDrawingEvent();
        // Keep selected drawing in sync if it is updated (e.g. by dragging anchors)
        const selected = drawingManager.getSelectedDrawing();
        if (selected) {
          setSelectedDrawingId(selected.id);
        }
      }),
      drawingManager.on('drawing:removed', () => {
        handleDrawingEvent();
        const selected = drawingManager.getSelectedDrawing();
        if (!selected) {
          setSelectedDrawingId(null);
        }
      }),
      drawingManager.on('drawing:cleared', () => {
        handleDrawingEvent();
        setSelectedDrawingId(null);
      }),
      drawingManager.on('drawing:selected', () => {
        const selected = drawingManager.getSelectedDrawing();
        if (selected) {
          setSelectedDrawingId(selected.id);
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
      }),
    ].filter((unsub): unsub is () => void => unsub !== undefined);

    // Crosshair Move Handling (includes OHLC and drawing preview)
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
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

    const timeScale = chart.timeScale();

    const timeToLogical = (t: number): any => {
      const coord = timeScale.timeToCoordinate(t as any);
      if (coord === null) return null;
      return timeScale.coordinateToLogical(coord);
    };

    const logicalToTime = (l: any): any => {
      const coord = timeScale.logicalToCoordinate(l as any);
      if (coord === null) return null;
      return timeScale.coordinateToTime(coord);
    };

    const handleBodyMouseDown = (e: MouseEvent) => {
      // Only drag with left click and when no tool is active
      if (e.button !== 0 || activeToolRef.current) return;
      if (!drawingManager || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const pt = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      // Check if we hit an anchor of the currently selected drawing.
      // If yes, let the DrawingManager handle it.
      const selected = drawingManager.getSelectedDrawing();
      if (selected) {
        const anchorIndex = drawingManager.hitTestAnchor(pt);
        if (anchorIndex !== null) {
          return; // Let library handle anchor dragging
        }
      }

      // Check if we hit the body of any drawing
      const hit = drawingManager.hitTest(pt);
      if (hit && !hit.options.locked) {
        let drawingToDrag = hit;

        // If Ctrl is pressed, clone the drawing! (Ctrl + Drag shortcut)
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

        // Stop chart from panning
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const handleBodyMouseMove = (e: MouseEvent) => {
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

    const handleBodyMouseUp = (e: MouseEvent) => {
      if (isDraggingBody) {
        isDraggingBody = false;
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
    };

    const handleMouseMoveHover = (e: MouseEvent) => {
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

    // Register event listeners
    container.addEventListener('mousedown', handleBodyMouseDown, true);
    container.addEventListener('mousemove', handleMouseMoveHover, true);
    container.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('mousemove', handleBodyMouseMove, true);
    window.addEventListener('mouseup', handleBodyMouseUp, true);

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
      if (container) {
        container.removeEventListener('mousedown', handleBodyMouseDown, true);
        container.removeEventListener('mousemove', handleMouseMoveHover, true);
        container.removeEventListener('contextmenu', handleContextMenu, true);
        container.removeEventListener('dblclick', handleDblClick);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleBodyMouseMove, true);
      window.removeEventListener('mouseup', handleBodyMouseUp, true);
      resizeObserver.disconnect();
      unsubs.forEach((unsub) => unsub());
      chart.unsubscribeClick(handleDrawingClick);
      drawingManager.detach();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markerPrimitiveRef.current = null;
      drawingManagerRef.current = null;
    };
  }, [onCrosshairMove, chartType]);

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
    const propsDrawingsJson = JSON.stringify(drawings || []);
    const managerDrawingsJson = JSON.stringify(managerDrawings);

    if (propsDrawingsJson !== managerDrawingsJson) {
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
      return;
    }

    // Convert CandleData to series format
    let chartCandles: any[];
    if (chartType === 'HeikinAshi') {
      const haData = computeHeikinAshi(candles);
      chartCandles = haData.map((c: any) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    } else if (chartType === 'Line' || chartType === 'Area') {
      chartCandles = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.close,
      }));
    } else {
      chartCandles = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    }

    const volumeData = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.volume || 0,
      color: c.close >= c.open ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 61, 0, 0.25)',
    }));

    candleSeries.setData(chartCandles);
    volumeSeries.setData(volumeData);

    // Build a compact signature: firstTime_lastTime_count
    const newSignature = `${candles[0].time}_${candles[candles.length - 1].time}_${candles.length}`;
    const sessionChanged = sessionKey !== undefined && sessionKey !== prevSessionKeyRef.current;
    const dataChanged = newSignature !== dataSignatureRef.current;

    if (dataChanged || sessionChanged) {
      // New data or new session — always fit the viewport so CSV data is visible
      chartRef.current?.timeScale().fitContent();
      dataSignatureRef.current = newSignature;
      prevSessionKeyRef.current = sessionKey;
    }

    // Apply markers if any
    if (markers && markers.length > 0) {
      // Ensure markers are sorted by time
      const sortedMarkers = [...markers]
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
  }, [candles, markers, chartType, sessionKey]);

  // Sync Technical Indicators
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;

    const currentSeriesMap = indicatorSeriesRef.current;
    const activeIds = new Set((activeIndicators || []).map((ind) => ind.id));

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
        seriesList[0].setData(getPlotData(res.plots, 'plot0'));
      } else if (['BollingerBands', 'DonchianChannels'].includes(indicator.type)) {
        seriesList[0].setData(getPlotData(res.plots, 'plot0')); // Basis
        seriesList[1].setData(getPlotData(res.plots, 'plot1')); // Upper
        seriesList[2].setData(getPlotData(res.plots, 'plot2')); // Lower
      } else if (indicator.type === 'KeltnerChannels') {
        seriesList[0].setData(getPlotData(res.plots, 'plot0')); // Upper
        seriesList[1].setData(getPlotData(res.plots, 'plot1')); // Basis
        seriesList[2].setData(getPlotData(res.plots, 'plot2')); // Lower
      } else if (indicator.type === 'MACD') {
        const rawHist = res.plots.plot0 || [];
        const histData = rawHist.map((p: any) => ({
          time: p.time as UTCTimestamp,
          value: typeof p.value === 'number' && !isNaN(p.value) ? p.value : 0,
          color: p.color || '#26A69A',
        }));
        seriesList[0].setData(histData); // Histogram
        seriesList[1].setData(getPlotData(res.plots, 'plot1')); // MACD
        seriesList[2].setData(getPlotData(res.plots, 'plot2')); // Signal
      } else if (['Stochastic', 'Supertrend', 'Aroon'].includes(indicator.type)) {
        seriesList[0].setData(getPlotData(res.plots, 'plot0'));
        seriesList[1].setData(getPlotData(res.plots, 'plot1'));
      } else if (indicator.type === 'IchimokuCloud') {
        seriesList[0].setData(getPlotData(res.plots, 'plot0')); // Conversion Line
        seriesList[1].setData(getPlotData(res.plots, 'plot1')); // Base Line
        seriesList[2].setData(getPlotData(res.plots, 'plot2')); // Lagging Span
        seriesList[3].setData(getPlotData(res.plots, 'plot3')); // Leading Span A
        seriesList[4].setData(getPlotData(res.plots, 'plot4')); // Leading Span B
      }
    }
  }, [candles, activeIndicators]);

  // Sync Position Lines (Entry, SL, TP)
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    const currentLinesMap = priceLinesRef.current;

    // Identify position IDs that are no longer active
    const activePositionIds = new Set(positions.map((p) => p.id));
    for (const [posId, lines] of currentLinesMap.entries()) {
      if (!activePositionIds.has(posId)) {
        // Remove lines from series
        try {
          if (lines.entry) candleSeries.removePriceLine(lines.entry);
          if (lines.sl) candleSeries.removePriceLine(lines.sl);
          if (lines.tp) candleSeries.removePriceLine(lines.tp);
        } catch (e) {
          console.error('Failed to remove price line:', e);
        }
        currentLinesMap.delete(posId);
      }
    }

    // Add or update lines for current positions
    for (const position of positions) {
      const existingLines = currentLinesMap.get(position.id);

      // If they exist, let's clean them up first and recreate to ensure they reflect current SL/TP updates
      if (existingLines) {
        try {
          if (existingLines.entry) candleSeries.removePriceLine(existingLines.entry);
          if (existingLines.sl) candleSeries.removePriceLine(existingLines.sl);
          if (existingLines.tp) candleSeries.removePriceLine(existingLines.tp);
        } catch (e) {
          // ignore if already deleted
        }
        currentLinesMap.delete(position.id);
      }

      // Create entry line (lineWidth must be an integer: 1, 2, 3, or 4)
      const entryLine = candleSeries.createPriceLine({
        price: position.entryPrice,
        color: position.type === 'BUY' ? '#10b981' : '#f43f5e',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${position.type} ${position.lotSize} Lot @ ${position.entryPrice}`,
      });

      // Create SL line if set
      let slLine;
      if (position.stopLoss) {
        slLine = candleSeries.createPriceLine({
          price: position.stopLoss,
          color: 'rgba(244, 63, 94, 0.8)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `SL: ${position.stopLoss}`,
        });
      }

      // Create TP line if set
      let tpLine;
      if (position.takeProfit) {
        tpLine = candleSeries.createPriceLine({
          price: position.takeProfit,
          color: 'rgba(16, 185, 129, 0.8)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `TP: ${position.takeProfit}`,
        });
      }

      currentLinesMap.set(position.id, {
        entry: entryLine,
        sl: slLine,
        tp: tpLine,
      });
    }
  }, [positions]);

  return (
    <div className={styles.chartWrapper}>
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
    </div>
  );
});
