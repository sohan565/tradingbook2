'use client';

import React from 'react';
import { formatCurrency, formatPips, formatPrice } from '@/lib/trade-math';
import styles from '@/app/backtest/backtest.module.css';
import type { OpenPosition } from '@/types';
import PartialCloseMenu from './PartialCloseMenu';
import InlinePriceEdit from './InlinePriceEdit';
import EmptyState from '@/components/ui/EmptyState';

interface PositionsSidebarProps {
  openPositions: OpenPosition[];
  symbol: string;
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

/**
 * "Active Positions" cards in the left side panel. Memoized with narrow props;
 * inline SL/TP editing keeps its `side-${id}` namespaced editing keys.
 */
const PositionsSidebar = React.memo(function PositionsSidebar({
  openPositions,
  symbol,
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
}: PositionsSidebarProps) {
  return (
    <div className={styles.panelSection} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <h3 className={styles.panelTitle}>Active Positions ({openPositions.length})</h3>
      <div className={styles.positionsList}>
        {openPositions.length === 0 ? (
          <EmptyState
            icon={<span>📈</span>}
            title="No open positions"
            description="Place an order to start trading."
          />
        ) : (
          openPositions.map(pos => (
            <div
              key={pos.id}
              className={`${styles.positionCard} ${pos.type === 'BUY' ? styles.posLong : styles.posShort}`}
            >
              <div className={styles.posHeader}>
                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: pos.type === 'BUY' ? 'var(--term-up)' : 'var(--term-down)' }}>
                  {pos.type} {pos.lotSize.toFixed(2)} Lots
                </span>

                <div style={{ position: 'relative' }}>
                  <button
                    className={styles.posCloseBtn}
                    onClick={() => onToggleCloseMenu(pos.id)}
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
                    />
                  )}
                </div>
              </div>

              <div className={styles.posDetails}>
                <span>Entry: {formatPrice(pos.entryPrice, symbol)}</span>
                <span>Price: {formatPrice(pos.currentPrice, symbol)}</span>
              </div>

              <div className={styles.posDetails}>
                <span>
                  SL:{' '}
                  <InlinePriceEdit
                    editKey={`side-${pos.id}`}
                    activeEditKey={editingSLId}
                    value={pos.stopLoss}
                    symbol={symbol}
                    tempValue={tempSL}
                    label="SL"
                    onTempChange={onSetTempSL}
                    onStartEdit={onStartEditSL}
                    onCommit={(raw) => onCommitSL(pos.id, pos.takeProfit, raw)}
                    onCancel={onCancelEditSL}
                  />
                </span>

                <span>
                  TP:{' '}
                  <InlinePriceEdit
                    editKey={`side-${pos.id}`}
                    activeEditKey={editingTPId}
                    value={pos.takeProfit}
                    symbol={symbol}
                    tempValue={tempTP}
                    label="TP"
                    onTempChange={onSetTempTP}
                    onStartEdit={onStartEditTP}
                    onCommit={(raw) => onCommitTP(pos.id, pos.stopLoss, raw)}
                    onCancel={onCancelEditTP}
                  />
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                <span className={styles.posPnl} style={{ color: pos.unrealizedPnl >= 0 ? 'var(--term-up)' : 'var(--term-down)' }}>
                  {formatCurrency(pos.unrealizedPnl)}
                </span>
                <span style={{ fontSize: '0.75rem', opacity: 0.6, fontFamily: 'monospace' }}>
                  {formatPips(pos.unrealizedPips)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default PositionsSidebar;
