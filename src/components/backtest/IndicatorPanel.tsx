'use client';

import React, { useState } from 'react';
import styles from './IndicatorPanel.module.css';

export interface ActiveIndicator {
  id: string;
  type: string;
  name: string;
  inputs: Record<string, any>;
  color: string;
}

interface IndicatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (type: string) => void;
  onRemoveIndicator: (id: string) => void;
  onUpdateIndicator: (id: string, updates: Partial<ActiveIndicator>) => void;
}

export const INDICATORS_REGISTRY = [
  { type: 'SMA', name: 'Simple Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#3b82f6', inputLabels: { len: 'Length' } },
  { type: 'EMA', name: 'Exponential Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#10b981', inputLabels: { len: 'Length' } },
  { type: 'WMA', name: 'Weighted Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#a855f7', inputLabels: { len: 'Length' } },
  { type: 'HMA', name: 'Hull Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#fb923c', inputLabels: { len: 'Length' } },
  { type: 'ALMA', name: 'Arnaud Legoux Moving Average', category: 'Trend', defaultInputs: { len: 9, offset: 0.85, sigma: 6 }, defaultColor: '#14b8a6', inputLabels: { len: 'Length', offset: 'Offset', sigma: 'Sigma' } },
  { type: 'DEMA', name: 'Double Exponential Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#ec4899', inputLabels: { len: 'Length' } },
  { type: 'TEMA', name: 'Triple Exponential Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#f43f5e', inputLabels: { len: 'Length' } },
  { type: 'LSMA', name: 'Least Squares Moving Average', category: 'Trend', defaultInputs: { len: 25 }, defaultColor: '#84cc16', inputLabels: { len: 'Length' } },
  { type: 'VWMA', name: 'Volume Weighted Moving Average', category: 'Trend', defaultInputs: { len: 20 }, defaultColor: '#f59e0b', inputLabels: { len: 'Length' } },
  { type: 'BollingerBands', name: 'Bollinger Bands', category: 'Trend', defaultInputs: { length: 20, mult: 2 }, defaultColor: '#eab308', inputLabels: { length: 'Length', mult: 'Multiplier' } },
  { type: 'IchimokuCloud', name: 'Ichimoku Cloud', category: 'Trend', defaultInputs: { conversionPeriod: 9, basePeriod: 26, laggingSpan2Period: 52, displacement: 26 }, defaultColor: '#6366f1', inputLabels: { conversionPeriod: 'Conversion Line', basePeriod: 'Base Line', laggingSpan2Period: 'Lagging Span', displacement: 'Displacement' } },
  { type: 'DonchianChannels', name: 'Donchian Channels', category: 'Trend', defaultInputs: { length: 20 }, defaultColor: '#00f0ff', inputLabels: { length: 'Length' } },
  { type: 'KeltnerChannels', name: 'Keltner Channels', category: 'Trend', defaultInputs: { length: 20, mult: 1 }, defaultColor: '#60a5fa', inputLabels: { length: 'Length', mult: 'Multiplier' } },
  { type: 'ParabolicSAR', name: 'Parabolic SAR', category: 'Trend', defaultInputs: { start: 0.02, increment: 0.02, maximum: 0.2 }, defaultColor: '#4caf50', inputLabels: { start: 'Start', increment: 'Increment', maximum: 'Maximum' } },
  { type: 'Supertrend', name: 'Supertrend', category: 'Trend', defaultInputs: { factor: 3, pd: 10 }, defaultColor: '#089981', inputLabels: { factor: 'Multiplier', pd: 'ATR Period' } },
  { type: 'RSI', name: 'Relative Strength Index', category: 'Momentum', defaultInputs: { len: 14 }, defaultColor: '#8b5cf6', inputLabels: { len: 'Length' } },
  { type: 'MACD', name: 'MACD (Moving Average Convergence Divergence)', category: 'Momentum', defaultInputs: { fastLength: 12, slowLength: 26, signalLength: 9 }, defaultColor: '#3b82f6', inputLabels: { fastLength: 'Fast Length', slowLength: 'Slow Length', signalLength: 'Signal Length' } },
  { type: 'Stochastic', name: 'Stochastic Oscillator', category: 'Momentum', defaultInputs: { periodK: 14, smoothK: 1, periodD: 3 }, defaultColor: '#f97316', inputLabels: { periodK: '%K Period', smoothK: '%K Smooth', periodD: '%D Period' } },
  { type: 'CCI', name: 'Commodity Channel Index', category: 'Momentum', defaultInputs: { len: 20 }, defaultColor: '#eab308', inputLabels: { len: 'Length' } },
  { type: 'WilliamsPercentRange', name: 'Williams %R', category: 'Momentum', defaultInputs: { len: 14 }, defaultColor: '#ec4899', inputLabels: { len: 'Length' } },
  { type: 'Momentum', name: 'Momentum', category: 'Momentum', defaultInputs: { len: 10 }, defaultColor: '#06b6d4', inputLabels: { len: 'Length' } },
  { type: 'ROC', name: 'Rate of Change (ROC)', category: 'Momentum', defaultInputs: { len: 9 }, defaultColor: '#3b82f6', inputLabels: { len: 'Length' } },
  { type: 'Aroon', name: 'Aroon', category: 'Momentum', defaultInputs: { length: 14 }, defaultColor: '#f97316', inputLabels: { length: 'Length' } },
  { type: 'ATR', name: 'Average True Range (ATR)', category: 'Volatility', defaultInputs: { len: 14 }, defaultColor: '#ef4444', inputLabels: { len: 'Length' } },
  { type: 'OBV', name: 'On Balance Volume (OBV)', category: 'Volume', defaultInputs: {}, defaultColor: '#10b981', inputLabels: {} },
  { type: 'MFI', name: 'Money Flow Index (MFI)', category: 'Volume', defaultInputs: { len: 14 }, defaultColor: '#14b8a6', inputLabels: { len: 'Length' } },
  { type: 'ADX', name: 'Average Directional Index (ADX)', category: 'Trend', defaultInputs: { len: 14 }, defaultColor: '#f43f5e', inputLabels: { len: 'Length' } },
  { type: 'ChaikinMF', name: 'Chaikin Money Flow (CMF)', category: 'Volume', defaultInputs: { length: 20 }, defaultColor: '#22c55e', inputLabels: { length: 'Length' } },
];

export default function IndicatorPanel({
  isOpen,
  onClose,
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onUpdateIndicator,
}: IndicatorPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter registry based on search query
  const filteredIndicators = INDICATORS_REGISTRY.filter((ind) =>
    ind.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ind.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ind.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group filtered indicators by category
  const categories = Array.from(new Set(filteredIndicators.map((ind) => ind.category)));

  const handleInputChange = (id: string, key: string, value: any) => {
    const active = activeIndicators.find((a) => a.id === id);
    if (!active) return;
    const parsedValue = typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : value;
    onUpdateIndicator(id, {
      inputs: {
        ...active.inputs,
        [key]: parsedValue,
      },
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Technical Indicators</h2>
          <button className={styles.modalClose} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Main Layout Grid */}
          <div className={styles.modalGrid}>
            
            {/* Left Side: Search and Add Indicators */}
            <div className={styles.searchSection}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search indicators (e.g. SMA, RSI, Bollinger)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />

              <div className={styles.indicatorsListContainer}>
                {categories.map((category) => (
                  <div key={category} className={styles.categoryGroup}>
                    <h3 className={styles.categoryTitle}>{category}</h3>
                    <div className={styles.categoryGrid}>
                      {filteredIndicators
                        .filter((ind) => ind.category === category)
                        .map((ind) => (
                          <button
                            key={ind.type}
                            className={styles.indicatorCard}
                            onClick={() => onAddIndicator(ind.type)}
                          >
                            <span className={styles.indicatorCardName}>{ind.name}</span>
                            <span className={styles.indicatorCardType}>{ind.type}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
                {filteredIndicators.length === 0 && (
                  <div className={styles.noResults}>No indicators match your search.</div>
                )}
              </div>
            </div>

            {/* Right Side: Active Indicators & Configurations */}
            <div className={styles.activeSection}>
              <h3 className={styles.activeTitle}>Active Indicators ({activeIndicators.length})</h3>

              <div className={styles.activeList}>
                {activeIndicators.length === 0 ? (
                  <div className={styles.emptyActive}>
                    No active indicators. Click on the left list to add overlays or panels.
                  </div>
                ) : (
                  activeIndicators.map((indicator) => {
                    const registryInfo = INDICATORS_REGISTRY.find((r) => r.type === indicator.type);
                    const isEditing = editingId === indicator.id;

                    return (
                      <div key={indicator.id} className={styles.activeCard}>
                        <div className={styles.activeCardHeader}>
                          <div className={styles.activeCardTitleBlock}>
                            <span className={styles.activeColorBadge} style={{ backgroundColor: indicator.color }} />
                            <div>
                              <div className={styles.activeCardName}>{indicator.name}</div>
                              <div className={styles.activeCardMeta}>
                                {Object.entries(indicator.inputs)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(', ')}
                              </div>
                            </div>
                          </div>

                          <div className={styles.activeCardActions}>
                            <button
                              className={styles.actionBtn}
                              onClick={() => setEditingId(isEditing ? null : indicator.id)}
                              title="Configure inputs"
                            >
                              ⚙️
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.deleteBtn}`}
                              onClick={() => onRemoveIndicator(indicator.id)}
                              title="Remove indicator"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Editing Inputs panel */}
                        {isEditing && registryInfo && (
                          <div className={styles.configPanel}>
                            <h4 className={styles.configTitle}>Configuration</h4>
                            
                            {/* Input Fields */}
                            <div className={styles.configGrid}>
                              {Object.entries(registryInfo.defaultInputs).map(([key, defaultValue]) => {
                                const label = registryInfo.inputLabels[key as keyof typeof registryInfo.inputLabels] || key;
                                const currentValue = indicator.inputs[key] !== undefined ? indicator.inputs[key] : defaultValue;

                                return (
                                  <div key={key} className={styles.configInputGroup}>
                                    <label className={styles.configLabel}>{label}</label>
                                    <input
                                      type="number"
                                      step={typeof defaultValue === 'number' && defaultValue < 1 ? '0.01' : '1'}
                                      className={styles.configInput}
                                      value={currentValue}
                                      onChange={(e) => handleInputChange(indicator.id, key, e.target.value)}
                                    />
                                  </div>
                                );
                              })}

                              {/* Color Picker */}
                              <div className={styles.configInputGroup}>
                                <label className={styles.configLabel}>Line Color</label>
                                <div className={styles.colorPickerRow}>
                                  <input
                                    type="color"
                                    className={styles.colorPicker}
                                    value={indicator.color}
                                    onChange={(e) => onUpdateIndicator(indicator.id, { color: e.target.value })}
                                  />
                                  <input
                                    type="text"
                                    className={styles.colorText}
                                    value={indicator.color.toUpperCase()}
                                    onChange={(e) => onUpdateIndicator(indicator.id, { color: e.target.value })}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
