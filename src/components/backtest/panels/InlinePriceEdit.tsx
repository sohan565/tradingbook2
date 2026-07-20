'use client';

import React from 'react';
import { formatPrice } from '@/lib/trade-math';
import styles from '@/app/backtest/backtest.module.css';

interface InlinePriceEditProps {
  /** Namespaced editing key, e.g. `side-${id}` or `table-${id}` */
  editKey: string;
  /** Currently active editing key (editingSLId / editingTPId) or null */
  activeEditKey: string | null;
  value: number | undefined;
  symbol: string;
  tempValue: string;
  label: 'SL' | 'TP';
  onTempChange: (v: string) => void;
  onStartEdit: (editKey: string, currentValue: number | undefined) => void;
  onCommit: (raw: string) => void;
  onCancel: () => void;
}

/**
 * Inline-editable SL/TP price cell used in both the side panel position cards
 * and the bottom Open Positions table. Preserves the namespaced editing-state
 * behavior (`side-${id}` / `table-${id}`) and stopPropagation on input clicks.
 */
export default function InlinePriceEdit({
  editKey,
  activeEditKey,
  value,
  symbol,
  tempValue,
  label,
  onTempChange,
  onStartEdit,
  onCommit,
  onCancel,
}: InlinePriceEditProps) {
  if (activeEditKey === editKey) {
    return (
      <input
        type="number"
        step="any"
        value={tempValue}
        onChange={e => onTempChange(e.target.value)}
        onBlur={() => onCommit(tempValue)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            onCommit(tempValue);
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        className={styles.smallPriceInput}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        autoFocus
      />
    );
  }

  return (
    <span
      className={styles.editableField}
      onClick={(e) => {
        e.stopPropagation();
        onStartEdit(editKey, value);
      }}
      title={`Click to edit ${label}`}
    >
      {value ? formatPrice(value, symbol) : 'None'} ✎
    </span>
  );
}
