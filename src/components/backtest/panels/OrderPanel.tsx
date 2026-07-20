'use client';

import React from 'react';
import { formatCurrency } from '@/lib/trade-math';
import styles from '@/app/backtest/backtest.module.css';
import type { TradeType } from '@/types';

export interface LiveRiskReward {
  isBuy: boolean;
  riskUSD: number;
  riskPercent: number;
  rewardUSD: number;
  rewardPercent: number;
  rrRatio: string;
}

interface OrderPanelProps {
  symbol: string;
  lotSize: number;
  stopLossInput: string;
  takeProfitInput: string;
  liveRiskReward: LiveRiskReward | null;
  onPlaceOrder: (type: TradeType) => void;
  onSetLotSize: (v: number) => void;
  onSetStopLossInput: (v: string) => void;
  onSetTakeProfitInput: (v: string) => void;
  onQuickSLTP: (pipsSL: number, pipsTP: number) => void;
}

/**
 * Place Order panel (buy/sell, lots, SL/TP inputs, live R:R preview).
 * Memoized: candle ticks don't touch these props unless SL/TP inputs are set,
 * so typing in inputs stays isolated from replay re-renders.
 */
const OrderPanel = React.memo(function OrderPanel({
  symbol,
  lotSize,
  stopLossInput,
  takeProfitInput,
  liveRiskReward,
  onPlaceOrder,
  onSetLotSize,
  onSetStopLossInput,
  onSetTakeProfitInput,
  onQuickSLTP,
}: OrderPanelProps) {
  return (
    <div className={styles.panelSection}>
      <h3 className={styles.panelTitle}>Place Order</h3>

      <div className={styles.tradeCard}>
        <div className={styles.tradeActions}>
          <button className={styles.buyBtn} onClick={() => onPlaceOrder('BUY')}>BUY / Long</button>
          <button className={styles.sellBtn} onClick={() => onPlaceOrder('SELL')}>SELL / Short</button>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>
            <span>Lots</span>
            <span>1 Lot = {symbol === 'XAUUSD' ? '100 oz' : '100,000 units'}</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className={styles.inputField}
            value={lotSize}
            onChange={e => onSetLotSize(parseFloat(e.target.value) || 0.01)}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Stop Loss Price</label>
          <input
            type="text"
            placeholder="No Stop Loss"
            className={styles.inputField}
            value={stopLossInput}
            onChange={e => onSetStopLossInput(e.target.value)}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Take Profit Price</label>
          <input
            type="text"
            placeholder="No Take Profit"
            className={styles.inputField}
            value={takeProfitInput}
            onChange={e => onSetTakeProfitInput(e.target.value)}
          />
        </div>

        {liveRiskReward && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '6px',
            padding: '0.5rem',
            marginTop: '0.25rem',
            marginBottom: '0.25rem',
            fontSize: '0.72rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem'
          }}>
            <div style={{ color: 'var(--accent, #00e5ff)', fontWeight: 'bold' }}>
              Setup Direction: <span style={{ color: liveRiskReward.isBuy ? '#10b981' : '#ef4444' }}>{liveRiskReward.isBuy ? 'BUY / Long' : 'SELL / Short'}</span>
            </div>
            {liveRiskReward.riskUSD > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Risk (Loss):</span>
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>-{formatCurrency(liveRiskReward.riskUSD)} ({liveRiskReward.riskPercent.toFixed(2)}%)</span>
              </div>
            )}
            {liveRiskReward.rewardUSD > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Reward (Profit):</span>
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>+{formatCurrency(liveRiskReward.rewardUSD)} ({liveRiskReward.rewardPercent.toFixed(2)}%)</span>
              </div>
            )}
            {liveRiskReward.rrRatio && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '0.2rem', marginTop: '0.2rem' }}>
                <span style={{ color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>Risk/Reward Ratio:</span>
                <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>{liveRiskReward.rrRatio}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={() => onQuickSLTP(50, 100)}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
              padding: '0.35rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            Quick 1:2 (50/100p)
          </button>
          <button
            type="button"
            onClick={() => onQuickSLTP(100, 200)}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
              padding: '0.35rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            Quick 1:2 (100/200p)
          </button>
        </div>
      </div>
    </div>
  );
});

export default OrderPanel;
