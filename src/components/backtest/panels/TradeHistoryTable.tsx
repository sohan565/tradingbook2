'use client';

import React from 'react';
import { formatCurrency, formatDuration, formatPips, formatPrice } from '@/lib/trade-math';
import styles from '@/app/backtest/backtest.module.css';
import type { TradeRecord } from '@/types';
import { useTableSort, sortIndicator } from '@/components/ui/useTableSort';
import EmptyState from '@/components/ui/EmptyState';

interface TradeHistoryTableProps {
  closedTrades: TradeRecord[];
}

const SORT_ACCESSORS: Record<string, (t: TradeRecord) => number | string> = {
  symbol: (t) => t.symbol,
  type: (t) => t.type,
  lots: (t) => t.lotSize,
  entry: (t) => t.entryPrice,
  exit: (t) => t.exitPrice ?? 0,
  pnl: (t) => t.pnl ?? 0,
  pips: (t) => t.pnlPips ?? 0,
  duration: (t) => (t.exitTime && t.entryTime ? t.exitTime - t.entryTime : 0),
};

/**
 * Bottom-panel "Trade History" table. Memoized — only re-renders when a trade
 * actually closes, not on every replay tick. Sortable columns cycle
 * desc → asc → natural order on header click.
 */
const TradeHistoryTable = React.memo(function TradeHistoryTable({ closedTrades }: TradeHistoryTableProps) {
  const { sorted, sort, toggleSort } = useTableSort(closedTrades, SORT_ACCESSORS);

  if (closedTrades.length === 0) {
    return (
      <EmptyState
        icon={<span>📜</span>}
        title="No closed trades yet"
        description="Close open positions or wait for SL/TP to trigger. Completed trades appear here."
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
          {th('exit', 'Exit Price', true)}
          <th className={styles.numCell}>Stop Loss</th>
          <th className={styles.numCell}>Take Profit</th>
          {th('pnl', 'P&L (USD)', true)}
          {th('pips', 'P&L (Pips)', true)}
          {th('duration', 'Duration')}
        </tr>
      </thead>
      <tbody>
        {sorted.map(trade => {
          const duration = trade.exitTime && trade.entryTime ? trade.exitTime - trade.entryTime : 0;
          return (
            <tr key={trade.id} className={styles.bottomTableRow}>
              <td>{trade.id.split('-')[1] || trade.id.slice(0, 5)}</td>
              <td>{trade.symbol}</td>
              <td style={{ color: trade.type === 'BUY' ? 'var(--term-up)' : 'var(--term-down)', fontWeight: 'bold' }}>{trade.type}</td>
              <td className={styles.numCell}>{trade.lotSize.toFixed(2)}</td>
              <td className={styles.numCell}>{formatPrice(trade.entryPrice, trade.symbol)}</td>
              <td className={styles.numCell}>{trade.exitPrice ? formatPrice(trade.exitPrice, trade.symbol) : '-'}</td>
              <td className={styles.numCell}>{trade.stopLoss ? formatPrice(trade.stopLoss, trade.symbol) : '-'}</td>
              <td className={styles.numCell}>{trade.takeProfit ? formatPrice(trade.takeProfit, trade.symbol) : '-'}</td>
              <td className={styles.numCell} style={{ color: (trade.pnl ?? 0) >= 0 ? 'var(--term-up)' : 'var(--term-down)', fontWeight: 'bold' }}>
                {formatCurrency(trade.pnl ?? 0)}
              </td>
              <td className={styles.numCell} style={{ color: (trade.pnlPips ?? 0) >= 0 ? 'var(--term-up)' : 'var(--term-down)' }}>
                {formatPips(trade.pnlPips ?? 0)}
              </td>
              <td style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {duration > 0 ? formatDuration(duration) : 'Instant'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
});

export default TradeHistoryTable;
