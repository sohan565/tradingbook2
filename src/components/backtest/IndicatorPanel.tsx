'use client';

import React, { useState } from 'react';
import styles from './IndicatorPanel.module.css';
import { INDICATORS_REGISTRY, type ActiveIndicator } from './indicator-registry';

// Re-export for backward compatibility with existing importers
export { INDICATORS_REGISTRY };
export type { ActiveIndicator };

interface IndicatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (type: string) => void;
  onRemoveIndicator: (id: string) => void;
  onUpdateIndicator: (id: string, updates: Partial<ActiveIndicator>) => void;
}



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
