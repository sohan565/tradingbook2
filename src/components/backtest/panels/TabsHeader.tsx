'use client';

import React from 'react';
import styles from '@/app/backtest/backtest.module.css';

type BottomTab = 'positions' | 'trades' | 'analysis';

interface TabsHeaderProps {
  activeTab: BottomTab;
  openPositionsCount: number;
  closedTradesCount: number;
  saveStatus: string;
  isZoomLocked: boolean;
  isBottomPanelCollapsed: boolean;
  onSelectTab: (tab: BottomTab) => void;
  onToggleZoomLocked: () => void;
  onToggleBottomPanelCollapsed: () => void;
}

/**
 * Bottom panel tabs header (Open Positions / Trade History / Analytics) plus
 * save status, zoom lock, and collapse controls. Memoized so replay ticks only
 * re-render it when a count actually changes.
 */
const TabsHeader = React.memo(function TabsHeader({
  activeTab,
  openPositionsCount,
  closedTradesCount,
  saveStatus,
  isZoomLocked,
  isBottomPanelCollapsed,
  onSelectTab,
  onToggleZoomLocked,
  onToggleBottomPanelCollapsed,
}: TabsHeaderProps) {
  // Roving tabindex + arrow-key navigation (WAI-ARIA tabs pattern)
  const TABS: { id: BottomTab; label: string }[] = [
    { id: 'positions', label: `💼 Open Positions (${openPositionsCount})` },
    { id: 'trades', label: `📜 Trade History (${closedTradesCount})` },
    { id: 'analysis', label: '📊 Performance Analytics' },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TABS.length - 1;
    if (nextIdx >= 0) {
      e.preventDefault();
      onSelectTab(TABS[nextIdx].id);
      const list = e.currentTarget.parentElement;
      list?.querySelectorAll('button')[nextIdx]?.focus();
    }
  };

  return (
    <div className={styles.tabsHeader}>
      <div className={styles.tabsList} role="tablist" aria-label="Bottom panel">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTabButton : ''}`}
            onClick={() => onSelectTab(tab.id)}
            onKeyDown={handleTabKeyDown}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className={styles.saveStatusIndicator}>
          {saveStatus === 'saving' && <span>⏳ Auto-saving...</span>}
          {saveStatus === 'saved' && <span style={{ color: '#10b981' }}>✓ Changes saved</span>}
          {saveStatus === 'error' && <span style={{ color: '#ef4444' }}>❌ Save failed</span>}
        </div>

        <button
          onClick={onToggleZoomLocked}
          title={isZoomLocked ? "Zoom is Locked (Auto-scrolls to latest candle on replay)" : "Zoom is Unlocked (Allows manual zoom/pan during replay)"}
          style={{
            background: isZoomLocked ? 'rgba(125, 121, 242, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: isZoomLocked ? '1px solid var(--term-accent, #7d79f2)' : '1px solid var(--term-border, rgba(255, 255, 255, 0.08))',
            color: isZoomLocked ? 'var(--term-accent-light, #8f8bf5)' : 'var(--term-text-3, #7a7a85)',
            padding: '0.2rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.12s ease',
          }}
        >
          {isZoomLocked ? '🔒 Zoom Locked' : '🔓 Zoom Unlocked'}
        </button>

        <button
          className={styles.collapseTabBtn}
          onClick={onToggleBottomPanelCollapsed}
          title={isBottomPanelCollapsed ? 'Expand Panel' : 'Collapse Panel'}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary, #94a3b8)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            transition: 'all 0.12s'
          }}
        >
          {isBottomPanelCollapsed ? '▲ Expand' : '▼ Collapse'}
        </button>
      </div>
    </div>
  );
});

export default TabsHeader;
