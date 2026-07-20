'use client';

import React from 'react';
import type { OpenPosition } from '@/types';
import styles from '@/app/backtest/backtest.module.css';

interface PartialCloseMenuProps {
  position: OpenPosition;
  partialClosePercent: number;
  onSetPartialClosePercent: (pct: number) => void;
  onClosePosition: (id: string, closePercent: number) => void;
  onDismiss: () => void;
  align?: 'left' | 'right';
}

export default function PartialCloseMenu({
  position,
  partialClosePercent,
  onSetPartialClosePercent,
  onClosePosition,
  onDismiss,
  align = 'left',
}: PartialCloseMenuProps) {
  return (
    <div
      className={styles.closeDropdown}
      style={align === 'right' ? { right: 0, top: '100%', left: 'auto' } : undefined}
    >
      <button
        type="button"
        className={styles.closeDropdownItem}
        onClick={() => {
          onClosePosition(position.id, 100);
          onDismiss();
        }}
      >
        Full Close (100%)
      </button>

      <div className={styles.partialSection}>
        <div className={styles.sliderHeader}>
          <span>Partial: {partialClosePercent}%</span>
          <span>({(position.lotSize * partialClosePercent / 100).toFixed(2)} L)</span>
        </div>
        <input
          type="range"
          min="10"
          max="90"
          step="10"
          value={partialClosePercent}
          onChange={e => onSetPartialClosePercent(parseInt(e.target.value))}
          className={styles.percentSlider}
        />
        <div className={styles.presetRow}>
          {[25, 50, 75].map(pct => (
            <button
              key={pct}
              type="button"
              className={styles.presetBtn}
              onClick={() => onSetPartialClosePercent(pct)}
            >
              {pct}%
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.confirmCloseBtn}
          onClick={() => {
            onClosePosition(position.id, partialClosePercent);
            onDismiss();
          }}
        >
          Confirm Close
        </button>
      </div>
    </div>
  );
}
