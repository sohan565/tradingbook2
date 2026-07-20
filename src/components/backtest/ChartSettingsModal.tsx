'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { ChartSettings } from '@/types';
import styles from './ChartSettingsModal.module.css';

interface ChartSettingsModalProps {
  isOpen: boolean;
  settings: ChartSettings;
  onClose: () => void;
  onSave: (newSettings: ChartSettings) => void;
  onReset?: () => void;
}

type TabType = 'symbol' | 'status' | 'scales' | 'canvas' | 'trading' | 'alerts' | 'events';

// TradingView Color Palette Grid (matching Screenshot 3)
const COLOR_PALETTE = [
  '#ffffff', '#e0e3eb', '#d1d4dc', '#b2b5be', '#9598a1', '#787b86', '#5d606b', '#434651', '#131722',
  '#ff5252', '#ff9800', '#ffeb3b', '#4caf50', '#00bcd4', '#2196f3', '#3f51b5', '#9c27b0', '#e91e63',
  '#ffcdd2', '#ffe0b2', '#fff9c4', '#c8e6c9', '#b2ebf2', '#bbdefb', '#c5cae9', '#e1bee7', '#f8bbd0',
  '#ef5350', '#ffb74d', '#fff176', '#81c784', '#4dd0e1', '#64b5f6', '#7986cb', '#ba68c8', '#f06292',
  '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#3949ab', '#8e24aa', '#d81b60',
  '#c62828', '#ef6c00', '#f9a825', '#2e7d32', '#00838f', '#1565c0', '#283593', '#6a1b9a', '#ad1457',
  '#b71c1c', '#e65100', '#f57f17', '#1b5e20', '#006064', '#0d47a1', '#1a237e', '#4a148c', '#880e4f',
];

export const ChartSettingsModal: React.FC<ChartSettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
  onReset,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('canvas');
  const [localSettings, setLocalSettings] = useState<ChartSettings>(settings);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  const updateSetting = <K extends keyof ChartSettings>(key: K, value: ChartSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onSave(localSettings);
    onClose();
  };

  // Helper Color Picker Component
  const renderColorPicker = (settingKey: keyof ChartSettings, currentColor: string) => {
    const isPopoverOpen = activeColorPicker === settingKey;
    return (
      <div style={{ position: 'relative' }}>
        <button
          className={styles.colorPickerBtn}
          style={{ backgroundColor: currentColor }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveColorPicker(isPopoverOpen ? null : (settingKey as string));
          }}
          title="Change Color"
        />
        {isPopoverOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
              onClick={() => setActiveColorPicker(null)}
            />
            <div className={styles.colorPopover} onClick={e => e.stopPropagation()}>
              <div className={styles.colorGrid}>
                {COLOR_PALETTE.map((color, idx) => (
                  <div
                    key={idx}
                    className={styles.colorSwatch}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      updateSetting(settingKey, color);
                      setActiveColorPicker(null);
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.title}>Settings</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Main Layout */}
        <div className={styles.container}>
          {/* Sidebar */}
          <div className={styles.sidebar}>
            <button
              className={`${styles.navTab} ${activeTab === 'symbol' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('symbol')}
            >
              <span className={styles.tabIcon}>📊</span>
              <span>Symbol</span>
            </button>

            <button
              className={`${styles.navTab} ${activeTab === 'status' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('status')}
            >
              <span className={styles.tabIcon}>≡</span>
              <span>Status line</span>
            </button>

            <button
              className={`${styles.navTab} ${activeTab === 'scales' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('scales')}
            >
              <span className={styles.tabIcon}>↕</span>
              <span>Scales and lines</span>
            </button>

            <button
              className={`${styles.navTab} ${activeTab === 'canvas' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('canvas')}
            >
              <span className={styles.tabIcon}>✏️</span>
              <span>Canvas</span>
            </button>

            <button
              className={`${styles.navTab} ${activeTab === 'trading' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('trading')}
            >
              <span className={styles.tabIcon}>📈</span>
              <span>Trading</span>
            </button>

            <button
              className={`${styles.navTab} ${activeTab === 'alerts' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              <span className={styles.tabIcon}>⏰</span>
              <span>Alerts</span>
            </button>

            <button
              className={`${styles.navTab} ${activeTab === 'events' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('events')}
            >
              <span className={styles.tabIcon}>📅</span>
              <span>Events</span>
            </button>
          </div>

          {/* Body Content */}
          <div className={styles.content}>
            {/* CANVAS TAB */}
            {activeTab === 'canvas' && (
              <>
                <div className={styles.sectionHeader}>CHART BASIC STYLES</div>

                {/* Background */}
                <div className={styles.settingRow}>
                  <div className={styles.settingLabel}>Background</div>
                  <div className={styles.settingControlGroup}>
                    <select
                      className={styles.select}
                      value={localSettings.backgroundType}
                      onChange={e => updateSetting('backgroundType', e.target.value as any)}
                    >
                      <option value="solid">Solid</option>
                      <option value="gradient">Gradient</option>
                    </select>
                    {renderColorPicker('backgroundColor', localSettings.backgroundColor)}
                  </div>
                </div>

                {/* Vertical Grid Lines */}
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showVertGridLines}
                      onChange={e => updateSetting('showVertGridLines', e.target.checked)}
                    />
                    <span>Vertical grid lines</span>
                  </label>
                  <div className={styles.settingControlGroup}>
                    {renderColorPicker('vertGridColor', localSettings.vertGridColor)}
                    <select
                      className={styles.select}
                      value={localSettings.vertGridStyle}
                      onChange={e => updateSetting('vertGridStyle', e.target.value as any)}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </div>
                </div>

                {/* Horizontal Grid Lines */}
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showHorzGridLines}
                      onChange={e => updateSetting('showHorzGridLines', e.target.checked)}
                    />
                    <span>Horizontal grid lines</span>
                  </label>
                  <div className={styles.settingControlGroup}>
                    {renderColorPicker('horzGridColor', localSettings.horzGridColor)}
                    <select
                      className={styles.select}
                      value={localSettings.horzGridStyle}
                      onChange={e => updateSetting('horzGridStyle', e.target.value as any)}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </div>
                </div>

                {/* Crosshair */}
                <div className={styles.settingRow}>
                  <div className={styles.settingLabel}>Crosshair</div>
                  <div className={styles.settingControlGroup}>
                    {renderColorPicker('crosshairColor', localSettings.crosshairColor)}
                    <select
                      className={styles.select}
                      value={localSettings.crosshairStyle}
                      onChange={e => updateSetting('crosshairStyle', e.target.value as any)}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </div>
                </div>

                {/* Watermark */}
                <div className={styles.settingRow}>
                  <div className={styles.settingLabel}>Watermark</div>
                  <div className={styles.settingControlGroup}>
                    <select
                      className={styles.select}
                      value={localSettings.watermarkVisibility}
                      onChange={e => updateSetting('watermarkVisibility', e.target.value as any)}
                    >
                      <option value="hidden">Hidden</option>
                      <option value="ticker">Ticker</option>
                      <option value="interval">Interval</option>
                      <option value="description">Description</option>
                      <option value="replay">Replay mode</option>
                    </select>
                    {renderColorPicker('watermarkColor', localSettings.watermarkColor)}
                  </div>
                </div>

                <div className={styles.sectionHeader} style={{ marginTop: '12px' }}>SCALES</div>

                {/* Text */}
                <div className={styles.settingRow}>
                  <div className={styles.settingLabel}>Text</div>
                  <div className={styles.settingControlGroup}>
                    {renderColorPicker('scalesTextColor', localSettings.scalesTextColor)}
                    <select
                      className={styles.select}
                      value={localSettings.scalesFontSize}
                      onChange={e => updateSetting('scalesFontSize', parseInt(e.target.value))}
                    >
                      <option value={10}>10</option>
                      <option value={11}>11</option>
                      <option value={12}>12</option>
                      <option value={14}>14</option>
                      <option value={16}>16</option>
                    </select>
                  </div>
                </div>

                {/* Lines */}
                <div className={styles.settingRow}>
                  <div className={styles.settingLabel}>Lines</div>
                  <div className={styles.settingControlGroup}>
                    {renderColorPicker('scalesLinesColor', localSettings.scalesLinesColor)}
                  </div>
                </div>

                <div className={styles.sectionHeader} style={{ marginTop: '12px' }}>BUTTONS</div>

                {/* Navigation */}
                <div className={styles.settingRow}>
                  <div className={styles.settingLabel}>Navigation</div>
                  <select
                    className={styles.select}
                    value={localSettings.navigationButtons}
                    onChange={e => updateSetting('navigationButtons', e.target.value as any)}
                  >
                    <option value="mouseover">Visible on mouse over</option>
                    <option value="always">Always visible</option>
                    <option value="never">Always invisible</option>
                  </select>
                </div>

                {/* Pane */}
                <div className={styles.settingRow}>
                  <div className={styles.settingLabel}>Pane</div>
                  <select
                    className={styles.select}
                    value={localSettings.paneButtons}
                    onChange={e => updateSetting('paneButtons', e.target.value as any)}
                  >
                    <option value="mouseover">Visible on mouse over</option>
                    <option value="always">Always visible</option>
                    <option value="never">Always invisible</option>
                  </select>
                </div>
              </>
            )}

            {/* SYMBOL TAB */}
            {activeTab === 'symbol' && (
              <>
                <div className={styles.sectionHeader}>CANDLESTICK STYLES</div>

                <div className={styles.settingRow}>
                  <div className={styles.settingLabel}>Body</div>
                  <div className={styles.settingControlGroup}>
                    <span style={{ fontSize: '12px', color: '#787b86' }}>Up:</span>
                    {renderColorPicker('candleUpColor', localSettings.candleUpColor)}
                    <span style={{ fontSize: '12px', color: '#787b86', marginLeft: '8px' }}>Down:</span>
                    {renderColorPicker('candleDownColor', localSettings.candleDownColor)}
                  </div>
                </div>

                <div className={styles.settingRow}>
                  <div className={styles.settingLabel}>Borders</div>
                  <div className={styles.settingControlGroup}>
                    <span style={{ fontSize: '12px', color: '#787b86' }}>Up:</span>
                    {renderColorPicker('borderUpColor', localSettings.borderUpColor)}
                    <span style={{ fontSize: '12px', color: '#787b86', marginLeft: '8px' }}>Down:</span>
                    {renderColorPicker('borderDownColor', localSettings.borderDownColor)}
                  </div>
                </div>

                <div className={styles.settingRow}>
                  <div className={styles.settingLabel}>Wicks</div>
                  <div className={styles.settingControlGroup}>
                    <span style={{ fontSize: '12px', color: '#787b86' }}>Up:</span>
                    {renderColorPicker('wickUpColor', localSettings.wickUpColor)}
                    <span style={{ fontSize: '12px', color: '#787b86', marginLeft: '8px' }}>Down:</span>
                    {renderColorPicker('wickDownColor', localSettings.wickDownColor)}
                  </div>
                </div>

                <div className={styles.sectionHeader} style={{ marginTop: '12px' }}>PRICE LINES</div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showLastPriceLine}
                      onChange={e => updateSetting('showLastPriceLine', e.target.checked)}
                    />
                    <span>Last price line</span>
                  </label>
                  {renderColorPicker('lastPriceLineColor', localSettings.lastPriceLineColor)}
                </div>
              </>
            )}

            {/* STATUS LINE TAB */}
            {activeTab === 'status' && (
              <>
                <div className={styles.sectionHeader}>STATUS LINE ELEMENTS</div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showSymbolNameLabel}
                      onChange={e => updateSetting('showSymbolNameLabel', e.target.checked)}
                    />
                    <span>Symbol name</span>
                  </label>
                </div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showOpenMarketStatus}
                      onChange={e => updateSetting('showOpenMarketStatus', e.target.checked)}
                    />
                    <span>Open market status</span>
                  </label>
                </div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showOHLC}
                      onChange={e => updateSetting('showOHLC', e.target.checked)}
                    />
                    <span>OHLC values</span>
                  </label>
                </div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showBarChange}
                      onChange={e => updateSetting('showBarChange', e.target.checked)}
                    />
                    <span>Bar change values</span>
                  </label>
                </div>
              </>
            )}

            {/* SCALES AND LINES TAB */}
            {activeTab === 'scales' && (
              <>
                <div className={styles.sectionHeader}>SCALES LABELS</div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showSymbolLastPriceLabel}
                      onChange={e => updateSetting('showSymbolLastPriceLabel', e.target.checked)}
                    />
                    <span>Symbol last price label</span>
                  </label>
                </div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showHighLowPriceLabels}
                      onChange={e => updateSetting('showHighLowPriceLabels', e.target.checked)}
                    />
                    <span>High and low price labels</span>
                  </label>
                </div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showCountdownToBarClose}
                      onChange={e => updateSetting('showCountdownToBarClose', e.target.checked)}
                    />
                    <span>Countdown to bar close</span>
                  </label>
                </div>
              </>
            )}

            {/* TRADING TAB */}
            {activeTab === 'trading' && (
              <>
                <div className={styles.sectionHeader}>TRADING OVERLAYS</div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showTradeHistory}
                      onChange={e => updateSetting('showTradeHistory', e.target.checked)}
                    />
                    <span>Show trade history on chart</span>
                  </label>
                </div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showTradeLevels}
                      onChange={e => updateSetting('showTradeLevels', e.target.checked)}
                    />
                    <span>Show trade levels (Entry / TP / SL)</span>
                  </label>
                </div>

                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={localSettings.showBuySellButtons}
                      onChange={e => updateSetting('showBuySellButtons', e.target.checked)}
                    />
                    <span>Show top Buy/Sell buttons</span>
                  </label>
                </div>
              </>
            )}

            {/* ALERTS & EVENTS TABS */}
            {(activeTab === 'alerts' || activeTab === 'events') && (
              <div style={{ color: '#787b86', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                No configurable options for {activeTab} in backtest mode.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <select className={styles.templateDropdown} defaultValue="Template">
            <option disabled value="Template">Template</option>
            <option value="default">Default</option>
            <option value="light">Light Theme</option>
            <option value="dark">Dark Theme</option>
          </select>

          <div className={styles.footerActions}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.okBtn} onClick={handleApply}>Ok</button>
          </div>
        </div>
      </div>
    </div>
  );
};
