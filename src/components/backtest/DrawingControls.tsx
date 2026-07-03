'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { IDrawing, Anchor } from 'lightweight-charts-drawing';
import styles from './DrawingControls.module.css';

// Pre-defined color palette matching TradingBook dark neon theme
const COLOR_PALETTE = [
  '#00e5ff', // Cyan (Accent)
  '#00e676', // Neon Green (Profit/Long)
  '#ff3d00', // Neon Red (Loss/Short)
  '#ffeb3b', // Yellow
  '#2962ff', // Blue
  '#d500f9', // Purple
  '#ff9100', // Orange
  '#f1f5f9', // White
  '#94a3b8', // Gray
  '#475569', // Dark Gray
];

// LINE STYLE UTILS
// Convert lineDash back and forth
const getLineStyleLabel = (dash: number[] | undefined) => {
  if (!dash || dash.length === 0) return 'Solid';
  if (dash[0] === 5) return 'Dashed';
  return 'Dotted';
};

const getLineDash = (style: string) => {
  if (style === 'Dashed') return [5, 5];
  if (style === 'Dotted') return [2, 2];
  return undefined; // Solid
};

// ============================================================================
// 1. CONTEXT MENU
// ============================================================================
interface ContextMenuProps {
  x: number;
  y: number;
  drawing: any;
  onClose: () => void;
  onAction: (action: string, payload?: any) => void;
}

export const DrawingContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  drawing,
  onClose,
  onAction,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  const isLocked = !!drawing.options?.locked;
  const isHidden = drawing.options?.visible === false;

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={styles.menuItem} onClick={() => onAction('clone')}>
        <div className={styles.menuItemLabel}>
          <span className={styles.menuItemIcon}>📋</span>
          <span>Clone</span>
        </div>
        <span className={styles.menuItemShortcut}>Ctrl + Drag</span>
      </div>
      <div className={styles.menuItem} onClick={() => onAction('copy')}>
        <div className={styles.menuItemLabel}>
          <span className={styles.menuItemIcon}>🖨️</span>
          <span>Copy</span>
        </div>
        <span className={styles.menuItemShortcut}>Ctrl + C</span>
      </div>

      <div className={styles.menuDivider} />

      <div className={`${styles.menuItem} ${styles.menuItemWithSub}`}>
        <div className={styles.menuItemLabel}>
          <span className={styles.menuItemIcon}>🥞</span>
          <span>Visual order</span>
        </div>
        <span>›</span>
        <div className={styles.submenu}>
          <div className={styles.menuItem} onClick={() => onAction('bring-to-front')}>
            Bring to Front
          </div>
          <div className={styles.menuItem} onClick={() => onAction('send-to-back')}>
            Send to Back
          </div>
        </div>
      </div>

      <div className={styles.menuDivider} />

      <div className={styles.menuItem} onClick={() => onAction('toggle-lock')}>
        <div className={styles.menuItemLabel}>
          <span className={styles.menuItemIcon}>{isLocked ? '🔓' : '🔒'}</span>
          <span>{isLocked ? 'Unlock' : 'Lock'}</span>
        </div>
      </div>

      <div className={styles.menuItem} onClick={() => onAction('toggle-hide')}>
        <div className={styles.menuItemLabel}>
          <span className={styles.menuItemIcon}>{isHidden ? '👁️' : '🕶️'}</span>
          <span>{isHidden ? 'Show' : 'Hide'}</span>
        </div>
      </div>

      <div className={styles.menuItem} onClick={() => onAction('delete')}>
        <div className={styles.menuItemLabel}>
          <span className={styles.menuItemIcon}>🗑️</span>
          <span style={{ color: '#ef4444' }}>Remove</span>
        </div>
        <span className={styles.menuItemShortcut}>Del</span>
      </div>

      <div className={styles.menuDivider} />

      <div className={styles.menuItem} onClick={() => onAction('settings')}>
        <div className={styles.menuItemLabel}>
          <span className={styles.menuItemIcon}>⚙️</span>
          <span>Settings...</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. FLOATING STYLING TOOLBAR
// ============================================================================
interface FloatingToolbarProps {
  x: number;
  y: number;
  drawing: any;
  onPositionChange: (pos: { x: number; y: number }) => void;
  onUpdateStyle: (style: any) => void;
  onUpdateOptions: (options: any) => void;
  onAction: (action: string) => void;
}

export const DrawingFloatingToolbar: React.FC<FloatingToolbarProps> = ({
  x,
  y,
  drawing,
  onPositionChange,
  onUpdateStyle,
  onUpdateOptions,
  onAction,
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<'color' | 'width' | 'style' | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const toolbarStartRef = useRef({ x: 0, y: 0 });

  // Handle outside click to close active style dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    toolbarStartRef.current = { x, y };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      onPositionChange({
        x: toolbarStartRef.current.x + dx,
        y: toolbarStartRef.current.y + dy,
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const strokeColor = drawing.style?.lineColor || '#00e5ff';
  const strokeWidth = drawing.style?.lineWidth || 1;
  const strokeStyle = getLineStyleLabel(drawing.style?.lineDash);
  const isLocked = !!drawing.options?.locked;

  const toggleDropdown = (dropdown: 'color' | 'width' | 'style') => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  return (
    <div
      ref={toolbarRef}
      className={styles.floatingToolbar}
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Drag handle */}
      <div className={styles.dragHandle} onMouseDown={handleMouseDown} title="Drag to move toolbar">
        ⋮⋮
      </div>

      <div className={styles.toolbarDivider} />

      {/* Color Swatch Button */}
      <div className={styles.dropdownWrapper}>
        <button
          className={styles.toolbarBtn}
          onClick={() => toggleDropdown('color')}
          title="Line Color"
        >
          <div className={styles.colorSwatch} style={{ backgroundColor: strokeColor }} />
        </button>
        {activeDropdown === 'color' && (
          <div className={styles.dropdownMenu}>
            <div className={styles.colorPalette}>
              {COLOR_PALETTE.map((color) => (
                <div
                  key={color}
                  className={styles.paletteColor}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    onUpdateStyle({ lineColor: color });
                    setActiveDropdown(null);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Thickness Selector */}
      <div className={styles.dropdownWrapper}>
        <button
          className={`${styles.toolbarBtn} ${activeDropdown === 'width' ? styles.toolbarBtnActive : ''}`}
          onClick={() => toggleDropdown('width')}
          title="Line Thickness"
        >
          {strokeWidth}px
        </button>
        {activeDropdown === 'width' && (
          <div className={styles.dropdownMenu}>
            {[1, 2, 3, 4].map((w) => (
              <div
                key={w}
                className={`${styles.widthOption} ${strokeWidth === w ? styles.widthOptionActive : ''}`}
                onClick={() => {
                  onUpdateStyle({ lineWidth: w });
                  setActiveDropdown(null);
                }}
              >
                {w}px
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Line Style Selector */}
      <div className={styles.dropdownWrapper}>
        <button
          className={`${styles.toolbarBtn} ${activeDropdown === 'style' ? styles.toolbarBtnActive : ''}`}
          onClick={() => toggleDropdown('style')}
          title="Line Style"
        >
          {strokeStyle === 'Solid' ? '─' : strokeStyle === 'Dashed' ? '---' : '...'}
        </button>
        {activeDropdown === 'style' && (
          <div className={styles.dropdownMenu}>
            {['Solid', 'Dashed', 'Dotted'].map((s) => (
              <div
                key={s}
                className={styles.styleOption}
                onClick={() => {
                  onUpdateStyle({ lineDash: getLineDash(s) });
                  setActiveDropdown(null);
                }}
              >
                <span>{s === 'Solid' ? '─────' : s === 'Dashed' ? '- - - -' : '· · · ·'}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.toolbarDivider} />

      {/* Lock Button */}
      <button
        className={`${styles.toolbarBtn} ${isLocked ? styles.toolbarBtnActive : ''}`}
        onClick={() => onUpdateOptions({ locked: !isLocked })}
        title={isLocked ? 'Unlock Drawing' : 'Lock Drawing'}
      >
        {isLocked ? '🔒' : '🔓'}
      </button>

      {/* Delete Button */}
      <button
        className={styles.toolbarBtn}
        onClick={() => onAction('delete')}
        title="Remove"
        style={{ color: '#ef4444' }}
      >
        🗑️
      </button>

      {/* Settings Button */}
      <button
        className={styles.toolbarBtn}
        onClick={() => onAction('settings')}
        title="Settings"
      >
        ⚙️
      </button>

      {/* Context Menu Button */}
      <button
        className={styles.toolbarBtn}
        onClick={() => onAction('context')}
        title="More"
      >
        •••
      </button>
    </div>
  );
};

// ============================================================================
// 3. SETTINGS MODAL DIALOG
// ============================================================================
interface SettingsModalProps {
  isOpen: boolean;
  drawing: any;
  onClose: () => void;
  onSave: (style: any, options: any) => void;
}

export const DrawingSettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  drawing,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'style' | 'visibility'>('style');

  // Form styles state
  const [lineColor, setLineColor] = useState(drawing.style?.lineColor || '#00e5ff');
  const [lineWidth, setLineWidth] = useState(drawing.style?.lineWidth || 1);
  const [lineStyle, setLineStyle] = useState(getLineStyleLabel(drawing.style?.lineDash));
  const [fillColor, setFillColor] = useState(drawing.style?.fillColor || '#00e5ff');
  const [fillOpacity, setFillOpacity] = useState(drawing.style?.fillOpacity !== undefined ? drawing.style.fillOpacity : 0.2);
  const [showLabels, setShowLabels] = useState(!!drawing.style?.showLabels);
  
  // Annotation styles
  const [textVal, setTextVal] = useState(drawing.options?.text || drawing.style?.text || '');
  const [fontSize, setFontSize] = useState(drawing.options?.fontSize || 12);
  const [fontWeight, setFontWeight] = useState(drawing.options?.fontWeight || 'normal');

  // Form options state
  const [locked, setLocked] = useState(!!drawing.options?.locked);
  const [visible, setVisible] = useState(drawing.options?.visible !== false);

  // Timeframe visibility list
  const allTimeframes = ['1m', '5m', '15m', '30m', '1H', '4H', '1D'];
  const [visibleTimeframes, setVisibleTimeframes] = useState<string[]>(
    drawing.options?.visibleTimeframes || allTimeframes
  );

  // Sync state values when drawing changes
  useEffect(() => {
    if (drawing) {
      setLineColor(drawing.style?.lineColor || '#00e5ff');
      setLineWidth(drawing.style?.lineWidth || 1);
      setLineStyle(getLineStyleLabel(drawing.style?.lineDash));
      setFillColor(drawing.style?.fillColor || '#00e5ff');
      setFillOpacity(drawing.style?.fillOpacity !== undefined ? drawing.style.fillOpacity : 0.2);
      setShowLabels(!!drawing.style?.showLabels);
      setTextVal(drawing.options?.text || drawing.style?.text || '');
      setFontSize(drawing.options?.fontSize || 12);
      setFontWeight(drawing.options?.fontWeight || 'normal');
      setLocked(!!drawing.options?.locked);
      setVisible(drawing.options?.visible !== false);
      setVisibleTimeframes(drawing.options?.visibleTimeframes || allTimeframes);
    }
  }, [drawing]);

  if (!isOpen) return null;

  const handleSave = () => {
    const styleUpdates: any = {
      lineColor,
      lineWidth,
      lineDash: getLineDash(lineStyle),
      showLabels,
    };

    if (drawing.type === 'rectangle' || drawing.type === 'triangle' || drawing.type === 'brush' || drawing.type === 'path') {
      styleUpdates.fillColor = fillColor;
      styleUpdates.fillOpacity = fillOpacity;
    }

    const optionUpdates: any = {
      locked,
      visible,
      visibleTimeframes,
    };

    if (drawing.type === 'text-annotation') {
      optionUpdates.text = textVal;
      optionUpdates.fontSize = Number(fontSize);
      optionUpdates.fontWeight = fontWeight;
      // also mirror on style for compatibility
      styleUpdates.text = textVal;
    }

    onSave(styleUpdates, optionUpdates);
    onClose();
  };

  const handleToggleTimeframe = (tf: string) => {
    if (visibleTimeframes.includes(tf)) {
      setVisibleTimeframes(visibleTimeframes.filter((t) => t !== tf));
    } else {
      setVisibleTimeframes([...visibleTimeframes, tf]);
    }
  };

  // Capitalize Drawing Type Label
  const typeLabel = drawing.type
    ? drawing.type
        .split('-')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Drawing';

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTitle}>
            <span>⚙️</span>
            <span>{typeLabel} Settings</span>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tab Controls */}
        <div className={styles.modalTabs}>
          <button
            className={`${styles.modalTab} ${activeTab === 'style' ? styles.modalTabActive : ''}`}
            onClick={() => setActiveTab('style')}
          >
            Style
          </button>
          <button
            className={`${styles.modalTab} ${activeTab === 'visibility' ? styles.modalTabActive : ''}`}
            onClick={() => setActiveTab('visibility')}
          >
            Visibility
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.modalBody}>
          {activeTab === 'style' ? (
            <div className={styles.settingsGroup}>
              {/* Text Option (TextAnnotation specific) */}
              {drawing.type === 'text-annotation' && (
                <>
                  <div className={styles.settingsRow}>
                    <label className={styles.settingsLabel}>Text Label</label>
                    <input
                      type="text"
                      className={styles.modalInput}
                      value={textVal}
                      onChange={(e) => setTextVal(e.target.value)}
                      style={{ maxWidth: '240px' }}
                    />
                  </div>
                  <div className={styles.settingsRow}>
                    <label className={styles.settingsLabel}>Font Size</label>
                    <select
                      className={styles.modalSelect}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                    >
                      {[10, 12, 14, 16, 18, 20, 24].map((size) => (
                        <option key={size} value={size}>
                          {size}px
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.settingsRow}>
                    <label className={styles.settingsLabel}>Font Weight</label>
                    <select
                      className={styles.modalSelect}
                      value={fontWeight}
                      onChange={(e) => setFontWeight(e.target.value)}
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </>
              )}

              {/* Line Color row */}
              <div className={styles.settingsRow}>
                <label className={styles.settingsLabel}>Line Color</label>
                <div className={styles.settingsControls}>
                  <div className={styles.colorSwatch} style={{ backgroundColor: lineColor }} />
                  <select
                    className={styles.modalSelect}
                    value={lineColor}
                    onChange={(e) => setLineColor(e.target.value)}
                  >
                    {COLOR_PALETTE.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line Thickness row */}
              <div className={styles.settingsRow}>
                <label className={styles.settingsLabel}>Line Thickness</label>
                <select
                  className={styles.modalSelect}
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((w) => (
                    <option key={w} value={w}>
                      {w}px
                    </option>
                  ))}
                </select>
              </div>

              {/* Line Style row */}
              <div className={styles.settingsRow}>
                <label className={styles.settingsLabel}>Line Style</label>
                <select
                  className={styles.modalSelect}
                  value={lineStyle}
                  onChange={(e) => setLineStyle(e.target.value)}
                >
                  <option value="Solid">Solid</option>
                  <option value="Dashed">Dashed</option>
                  <option value="Dotted">Dotted</option>
                </select>
              </div>

              {/* Fill Options (Rectangle/Triangle/Path specific) */}
              {(drawing.type === 'rectangle' || drawing.type === 'triangle' || drawing.type === 'brush' || drawing.type === 'path') && (
                <>
                  <div className={styles.settingsRow}>
                    <label className={styles.settingsLabel}>Fill Color</label>
                    <div className={styles.settingsControls}>
                      <div className={styles.colorSwatch} style={{ backgroundColor: fillColor }} />
                      <select
                        className={styles.modalSelect}
                        value={fillColor}
                        onChange={(e) => setFillColor(e.target.value)}
                      >
                        {COLOR_PALETTE.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.settingsRow}>
                    <label className={styles.settingsLabel}>Fill Opacity</label>
                    <div className={styles.settingsControls}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(fillOpacity * 100)}
                        onChange={(e) => setFillOpacity(Number(e.target.value) / 100)}
                        style={{ width: '120px', accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', width: '32px', textAlign: 'right' }}>
                        {Math.round(fillOpacity * 100)}%
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Label Toggle */}
              {drawing.style?.showLabels !== undefined && (
                <div className={styles.settingsRow}>
                  <label className={styles.settingsLabel}>Show Labels</label>
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                </div>
              )}

              <div className={styles.menuDivider} style={{ margin: '10px 0' }} />

              {/* Basic Options */}
              <div className={styles.settingsRow}>
                <label className={styles.settingsLabel}>Locked</label>
                <input
                  type="checkbox"
                  checked={locked}
                  onChange={(e) => setLocked(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
              </div>

              <div className={styles.settingsRow}>
                <label className={styles.settingsLabel}>Visible</label>
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
              </div>
            </div>
          ) : (
            <div className={styles.settingsGroup}>
              <p className={styles.settingsLabel} style={{ marginBottom: '8px' }}>
                Show drawing on active timeframes:
              </p>
              <div className={styles.visibilityGrid}>
                {allTimeframes.map((tf) => (
                  <label key={tf} className={styles.visibilityItem}>
                    <input
                      type="checkbox"
                      checked={visibleTimeframes.includes(tf)}
                      onChange={() => handleToggleTimeframe(tf)}
                    />
                    <span>{tf.toUpperCase()} chart</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={`${styles.modalBtn} ${styles.cancelBtn}`} onClick={onClose}>
            Cancel
          </button>
          <button className={`${styles.modalBtn} ${styles.saveBtn}`} onClick={handleSave}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
