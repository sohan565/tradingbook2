'use client';

import React from 'react';
import styles from './DrawingToolbar.module.css';

interface DrawingToolbarProps {
  activeTool: string | null;
  onSelectTool: (tool: string | null) => void;
  onClearDrawings: () => void;
  isMagnetMode?: boolean;
  onToggleMagnetMode?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

interface ToolItem {
  id: string | null;
  name: string;
  icon: React.ReactNode;
  shortcut?: string;
}

export default function DrawingToolbar({
  activeTool,
  onSelectTool,
  onClearDrawings,
  isMagnetMode = false,
  onToggleMagnetMode,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: DrawingToolbarProps) {
  const tools: ToolItem[] = [
    {
      id: null,
      name: 'Cursor',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          <path d="M13 13l6 6" />
        </svg>
      ),
    },
    {
      id: 'trend-line',
      name: 'Trend Line',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="19" r="2" fill="currentColor" />
          <circle cx="19" cy="5" r="2" fill="currentColor" />
          <line x1="7" y1="17" x2="17" y2="7" />
        </svg>
      ),
      shortcut: 'Alt+T',
    },
    {
      id: 'horizontal-line',
      name: 'Horizontal Line',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      ),
      shortcut: 'Alt+H',
    },
    {
      id: 'vertical-line',
      name: 'Vertical Line',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      ),
      shortcut: 'Alt+V',
    },
    {
      id: 'fib-retracement',
      name: 'Fib Retracement',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="10" x2="20" y2="10" />
          <line x1="4" y1="14" x2="20" y2="14" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <line x1="8" y1="6" x2="16" y2="18" strokeDasharray="3 3" />
        </svg>
      ),
      shortcut: 'Alt+F',
    },
    {
      id: 'rectangle',
      name: 'Rectangle',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      ),
      shortcut: 'Alt+E',
    },
    {
      id: 'triangle',
      name: 'Triangle',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l9 16H3L12 3z" />
        </svg>
      ),
    },
    {
      id: 'brush',
      name: 'Brush',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="M7.5 10.5c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5z" />
          <path d="M11.5 7.5c.828 0 1.5-.672 1.5-1.5S12.328 4.5 11.5 4.5s-1.5.672-1.5 1.5.672 1.5 1.5 1.5z" />
          <path d="M16.5 9.5c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5z" />
          <path d="M6 14c0-2 2-3 4-3 2.5 0 4.5 1.5 4.5 3.5S12.5 18 10 18s-4-2-4-4z" strokeDasharray="1 1" />
        </svg>
      ),
    },
    {
      id: 'text-annotation',
      name: 'Text Annotation',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      ),
      shortcut: 'Alt+A',
    },
    {
      id: 'path',
      name: 'Path',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18l4-10 6 4 6-8" />
          <circle cx="4" cy="18" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="14" cy="12" r="1.5" fill="currentColor" />
          <circle cx="20" cy="4" r="1.5" fill="currentColor" />
        </svg>
      ),
      shortcut: 'Alt+P',
    },
    {
      id: 'date-price-range',
      name: 'Measure',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
        </svg>
      ),
      shortcut: 'Alt+M',
    },
    {
      id: 'long-position',
      name: 'Long Position',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18" strokeDasharray="3 3" />
          <path d="M3 12h18" strokeDasharray="3 3" />
          <rect x="5" y="4" width="14" height="8" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" />
          <rect x="5" y="12" width="14" height="8" fill="rgba(244, 63, 94, 0.15)" stroke="#f43f5e" />
        </svg>
      ),
      shortcut: 'Alt+L',
    },
    {
      id: 'short-position',
      name: 'Short Position',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18" strokeDasharray="3 3" />
          <path d="M3 12h18" strokeDasharray="3 3" />
          <rect x="5" y="4" width="14" height="8" fill="rgba(244, 63, 94, 0.15)" stroke="#f43f5e" />
          <rect x="5" y="12" width="14" height="8" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" />
        </svg>
      ),
      shortcut: 'Alt+S',
    },
  ];

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 't') {
        e.preventDefault();
        onSelectTool('trend-line');
      } else if (key === 'h') {
        e.preventDefault();
        onSelectTool('horizontal-line');
      } else if (key === 'v') {
        e.preventDefault();
        onSelectTool('vertical-line');
      } else if (key === 'f') {
        e.preventDefault();
        onSelectTool('fib-retracement');
      } else if (key === 'e') {
        e.preventDefault();
        onSelectTool('rectangle');
      } else if (key === 'a') {
        e.preventDefault();
        onSelectTool('text-annotation');
      } else if (key === 'p') {
        e.preventDefault();
        onSelectTool('path');
      } else if (key === 'm') {
        e.preventDefault();
        onSelectTool('date-price-range');
      } else if (key === 'l') {
        e.preventDefault();
        onSelectTool('long-position');
      } else if (key === 's') {
        e.preventDefault();
        onSelectTool('short-position');
      } else if (key === 'c') {
        e.preventDefault();
        onSelectTool(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectTool]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolsGroup}>
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id ?? 'pointer'}
              className={`${styles.toolButton} ${isActive ? styles.activeTool : ''}`}
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.name} ${tool.shortcut ? `(${tool.shortcut})` : ''}`}
            >
              {tool.icon}
            </button>
          );
        })}
      </div>

      <div className={styles.divider} />

      <button
        className={`${styles.toolButton} ${isMagnetMode ? styles.activeMagnet : ''}`}
        onClick={onToggleMagnetMode}
        title="Magnet Mode (Snap to OHLC)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 19.5c0 .28-.22.5-.5.5H15c-.28 0-.5-.22-.5-.5V11c0-.55-.45-1-1-1h-3c-.55 0-1 .45-1 1v8.5c0 .28-.22.5-.5.5H7.5c-.28 0-.5-.22-.5-.5V11a5 5 0 0 1 10 0v8.5z" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </button>

      <div className={styles.divider} />

      <button
        className={styles.historyButton}
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        style={{ opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      </button>

      <button
        className={styles.historyButton}
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        style={{ opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
        </svg>
      </button>

      <div className={styles.divider} />

      <button
        className={styles.clearButton}
        onClick={onClearDrawings}
        title="Clear All Drawings"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
    </div>
  );
}
