'use client';

import React, { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  /** Target numeric value */
  value: number;
  /** Renders the animated number into display text (formatting, prefixes) */
  format: (n: number) => string;
  durationMs?: number;
}

/**
 * Animates the displayed number toward `value` whenever it changes.
 * Respects prefers-reduced-motion by snapping instantly.
 */
export function CountUp({ value, format, durationMs = 600 }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const snap = reduceMotion || from === value || !Number.isFinite(value) || !Number.isFinite(from);
    const start = performance.now();
    // All state updates run inside rAF callbacks — never synchronously in the
    // effect body — so a value change can't trigger a cascading render.
    const tick = (now: number) => {
      if (snap) {
        fromRef.current = value;
        setDisplay(value);
        return;
      }
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, durationMs]);

  return <>{format(display)}</>;
}

interface SparklineProps {
  /** Data points, plotted left to right */
  data: number[];
  width?: number;
  height?: number;
  /** Stroke color; defaults to the accent token */
  color?: string;
}

/** Minimal inline SVG sparkline for stat cards. */
export function Sparkline({ data, width = 96, height = 28, color = 'var(--accent)' }: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const step = (width - pad * 2) / (data.length - 1);
  const points = data
    .map((v, i) => `${(pad + i * step).toFixed(1)},${(height - pad - ((v - min) / range) * (height - pad * 2)).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: 'block', opacity: 0.85 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
