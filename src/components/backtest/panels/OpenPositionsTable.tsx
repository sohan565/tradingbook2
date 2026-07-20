'use client';

import React from 'react';
import { formatCurrency, formatPips, formatPrice } from '@/lib/trade-math';
import styles from '@/app/backtest/backtest.module.css';
import type { OpenPosition } from '@/types';
import PartialCloseMenu from './PartialCloseMenu';
import InlinePriceEdit from './InlinePriceEdit';
import { useTableSort, sortIndicator } from '@/components/ui/useTableSort';
import EmptyState from '@/components/ui/EmptyState';

interface OpenPositionsTableProps {
  openPositions: OpenPosition[];
  activeCloseMenuId: string | null;
  partialClosePercent: number;
  editingSLId: string | null;
  editingTPId: string | null;
  tempSL: string;
  tempTP: string;
  onToggleCloseMenu: (id: string) => void;
  onSetPartialClosePercent: (pct: number) => void;
  onClosePosition: (id: string, closePercent: number) => void;
  onDismissCloseMenu: () => void;
  onSetTempSL: (v: string) => void;
  onSetTempTP: (v: string) => void;
  onStartEditSL: (editKey: string, current: number | undefined) => void;
  onStartEditTP: (editKey: string, current: number | undefined) => void;
  onCommitSL: (positionId: string, takeProfit: number | undefined, raw: string) => void;
  onCommitTP: (positionId: string, stopLoss: number | undefined, raw: string) => void;
  onCancelEditSL: () => void;
  onCancelEditTP: () => void;
}

const SORT_ACCESSORS: Record<string, (p: OpenPosition) => number | string> = {
  symbol: (p) => p.symbol,
  type: (p) => p.type,
  lots: (p) => p.lotSize,
  entry: (p) => p.entryPrice,
  current: (p) => p.currentPrice,
  pnl: (p) => p.unrealizedPnl,
  pips: (p) => p.unrealizedPips,
};

/**
 * Bottom-panel "Open Positions" table. Memoized; inline SL/TP editing keeps
 * its `table-${id}` namespaced editing keys and the partial-close dropdown.
 * Sortable columns cycle desc → asc → natural order on header click.
 */
const OpenPositionsTable = React.memo(function OpenPositionsTable({
  openPositions,
  activeCloseMenuId,
  partialClosePercent,
  editingSLId,
  editingTPId,
  tempSL,
  tempTP,
  onToggleCloseMenu,
  onSetPartialClosePercent,
  onClosePosition,
  onDismissCloseMenu,
  onSetTempSL,
  onSetTempTP,
  onStartEditSL,
  onStartEditTP,
  onCommitSL,
  onCommitTP,
  onCancelEditSL,
  onCancelEditTP,
}: OpenPositionsTableProps) {
  const { sorted, sort, toggleSort } = useTableSort(openPositions, SORT_ACCESSORS);

  if (openPositions.length === 0) {
    return (
      <EmptyState
        icon={<span>💼</span>}
        title="No open positions"
        description="Place a buy or sell order from the side panel to start trading."
      />
    );
  }

  const th = (key: string, label: string, numeric = false) => (
    <th
      className={`${styles.sortableTh}${numeric ? ` ${styles.numCell}` : ''}`}
      onClick={() => toggleSort(key)}
      aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}{sortIndicator(sort, key)}
    </th>
  );

  return (
    <table className={styles.bottomTable}>
      <thead>
        <tr>
          <th>ID</th>
          {th('symbol', 'Symbol')}
          {th('type', 'Type')}
          {th('lots', 'Lots', true)}
          {th('entry', 'Entry Price', true)}
          {th('current', 'Current Price', true)}
          <th className={styles.numCell}>Stop Loss</th>
          <th className={styles.numCell}>Take Profit</th>
          {th('pnl', 'P&L (USD)', true)}
          {th('pips', 'Pips', true)}
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(pos => (
          <tr key={pos.id} className={styles.bottomTableRow}>
            <td>{pos.id.split('-')[1] || pos.id.slice(0, 5)}</td>
            <td>{pos.symbol}</td>
            <td style={{ color: pos.type === 'BUY' ? 'var(--term-up)' : 'var(--term-down)', fontWeight: 'bold' }}>{pos.type}</td>
            <td className={styles.numCell}>{pos.lotSize.toFixed(2)}</td>
            <td className={styles.numCell}>{formatPrice(pos.entryPrice, pos.symbol)}</td>
            <td className={styles.numCell}>{formatPrice(pos.currentPrice, pos.symbol)}</td>

            <td className={styles.numCell}>
              <InlinePriceEdit
                editKey={`table-${pos.id}`}
                activeEditKey={editingSLId}
                value={pos.stopLoss}
                symbol={pos.symbol}
                tempValue={tempSL}
                label="SL"
                onTempChange={onSetTempSL}
                onStartEdit={onStartEditSL}
                onCommit={(raw) => onCommitSL(pos.id, pos.takeProfit, raw)}
                onCancel={onCancelEditSL}
              />
            </td>

            <td className={styles.numCell}>
              <InlinePriceEdit
                editKey={`table-${pos.id}`}
                activeEditKey={editingTPId}
                value={pos.takeProfit}
                symbol={pos.symbol}
                tempValue={tempTP}
                label="TP"
                onTempChange={onSetTempTP}
                onStartEdit={onStartEditTP}
                onCommit={(raw) => onCommitTP(pos.id, pos.stopLoss, raw)}
                onCancel={onCancelEditTP}
              />
            </td>

            <td className={styles.numCell} style={{ color: pos.unrealizedPnl >= 0 ? 'var(--term-up)' : 'var(--term-down)', fontWeight: 'bold' }}>
              {formatCurrency(pos.unrealizedPnl)}
            </td>
            <td className={styles.numCell} style={{ color: pos.unrealizedPips >= 0 ? 'var(--term-up)' : 'var(--term-down)' }}>
              {formatPips(pos.unrealizedPips)}
            </td>
            <td style={{ position: 'relative', overflow: 'visible' }}>
              <button
                className={styles.posCloseBtn}
                onClick={() => onToggleCloseMenu(pos.id)}
                style={{ margin: 0, padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              >
                CLOSE
              </button>

              {activeCloseMenuId === pos.id && (
                <PartialCloseMenu
                  position={pos}
                  partialClosePercent={partialClosePercent}
                  onSetPartialClosePercent={onSetPartialClosePercent}
                  onClosePosition={onClosePosition}
                  onDismiss={onDismissCloseMenu}
                  align="right"
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

export default OpenPositionsTable;
