'use client';

import React from 'react';
import styles from '@/app/backtest/backtest.module.css';

interface PlaybackControlsProps {
  isPlaying: boolean;
  speed: number;
  isJumpToBarActive: boolean;
  currentIndex: number;
  totalCandles: number;
  replayPercent: number;
  onReset: () => void;
  onStepBackward: () => void;
  onTogglePlay: () => void;
  onStepForwardManual: () => void;
  onToggleJumpToBar: () => void;
  onSetSpeed: (ms: number) => void;
}

const SPEED_OPTIONS = [
  { label: '1/s', ms: 1000 },
  { label: '2/s', ms: 500 },
  { label: '3/s', ms: 333 },
  { label: '4/s', ms: 250 },
  { label: '5/s', ms: 200 },
];

/**
 * Replay control cluster (reset / step / play / jump-to-bar, speed selector,
 * progress bar). Memoized so per-tick re-renders of the page do not re-render
 * this subtree unless playback state actually changed.
 */
const PlaybackControls = React.memo(function PlaybackControls({
  isPlaying,
  speed,
  isJumpToBarActive,
  currentIndex,
  totalCandles,
  replayPercent,
  onReset,
  onStepBackward,
  onTogglePlay,
  onStepForwardManual,
  onToggleJumpToBar,
  onSetSpeed,
}: PlaybackControlsProps) {
  return (
    <div className={styles.panelSection}>
      <h3 className={styles.panelTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Replay Control</span>
        <span
          title="Keyboard Shortcuts:&#10;• Space - Play/Pause replay&#10;• ArrowRight - Step forward 1 bar&#10;• R - Reset replay session&#10;• Ctrl+Z - Undo drawing&#10;• Ctrl+Y - Redo drawing&#10;• Alt+T - Trend Line tool&#10;• Alt+H - Horizontal Line tool&#10;• Alt+V - Vertical Line tool&#10;• Alt+F - Fib Retracement tool&#10;• Alt+E - Rectangle tool&#10;• Alt+R - Reset chart zoom&#10;• Alt+A - Text Annotation tool&#10;• Alt+P - Path tool&#10;• Alt+M - Measure tool&#10;• Alt+C - Clear active drawing tool"
          style={{ cursor: 'help', fontSize: '0.72rem', opacity: 0.6, fontWeight: 'normal', color: 'var(--text-secondary)' }}
        >
          ℹ️ Shortcuts
        </span>
      </h3>
      <div className={styles.replayControlsCard}>
        <div className={styles.controlButtons} style={{ display: 'flex', gap: '4px', alignItems: 'center', width: '100%' }}>
          <button
            className={styles.stepBtn}
            onClick={onReset}
            title="Reset session to Start (R)"
            style={{ flex: 1, padding: 0, justifyContent: 'center', height: '34px' }}
          >
            <span>⏮</span>
          </button>
          <button
            className={styles.stepBtn}
            onClick={onStepBackward}
            title="Step Backward 1 bar (ArrowLeft)"
            style={{ flex: 1, padding: 0, justifyContent: 'center', height: '34px' }}
          >
            <span>⏪</span>
          </button>
          <button
            className={styles.playBtn}
            onClick={onTogglePlay}
            style={{
              backgroundColor: isPlaying ? 'var(--term-accent, #7d79f2)' : 'rgba(255,255,255,0.04)',
              border: isPlaying ? '1px solid var(--term-accent, #7d79f2)' : '1px solid var(--term-border-strong, rgba(255,255,255,0.11))',
              color: isPlaying ? '#ffffff' : 'var(--term-text-2, #a9a9b3)',
              height: '34px',
              flex: 1.5,
              padding: 0,
              justifyContent: 'center'
            }}
            title={isPlaying ? "Pause Playback (Space)" : "Play Replay (Space)"}
          >
            {isPlaying ? <span>⏸</span> : <span>▶</span>}
          </button>
          <button
            className={styles.stepBtn}
            onClick={onStepForwardManual}
            title="Step Forward 1 bar (ArrowRight)"
            style={{ flex: 1, padding: 0, justifyContent: 'center', height: '34px' }}
          >
            <span>⏭</span>
          </button>
          <button
            className={styles.stepBtn}
            onClick={onToggleJumpToBar}
            title="Jump to Bar (Click a candle to jump)"
            style={{
              flex: 1,
              padding: 0,
              justifyContent: 'center',
              height: '34px',
              backgroundColor: isJumpToBarActive ? 'rgba(125, 121, 242, 0.16)' : 'rgba(255, 255, 255, 0.04)',
              border: isJumpToBarActive ? '1px solid var(--term-accent, #7d79f2)' : '1px solid var(--term-border-strong, rgba(255, 255, 255, 0.11))',
              color: isJumpToBarActive ? 'var(--term-accent-light, #8f8bf5)' : 'var(--term-text-2, #a9a9b3)',
            }}
          >
            <span>📍</span>
          </button>
        </div>

        <div className={styles.replayProgress}>
          <div className={styles.replayProgressFill} style={{ width: `${replayPercent}%` }} />
        </div>

        <div className={styles.speedControls}>
          <span className={styles.speedLabel}>Speed</span>
          <div className={styles.speedSelector}>
            {SPEED_OPTIONS.map(sp => (
              <button
                key={sp.ms}
                className={`${styles.speedBtn} ${speed === sp.ms ? styles.activeSpeed : ''}`}
                onClick={() => onSetSpeed(sp.ms)}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.candleCounter}>
          {currentIndex + 1} / {totalCandles} candles ({replayPercent}%)
        </div>
      </div>
    </div>
  );
});

export default PlaybackControls;
