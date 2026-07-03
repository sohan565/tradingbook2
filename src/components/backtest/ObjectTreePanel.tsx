'use client';

import React from 'react';
import styles from './ObjectTreePanel.module.css';
import type { SerializedDrawing } from 'lightweight-charts-drawing';

interface ObjectTreePanelProps {
  isOpen: boolean;
  onClose: () => void;
  drawings: SerializedDrawing[];
  onDelete: (id: string) => void;
  onUpdateDrawing: (id: string, updates: Partial<SerializedDrawing>) => void;
}

export default function ObjectTreePanel({ isOpen, onClose, drawings, onDelete, onUpdateDrawing }: ObjectTreePanelProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Object Tree</h3>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className={styles.content}>
        {drawings.length === 0 ? (
          <div className={styles.emptyState}>No objects on chart</div>
        ) : (
          drawings.map(d => {
            const isVisible = d.options?.visible !== false;
            const isLocked = d.options?.locked === true;

            return (
              <div key={d.id} className={styles.drawingItem}>
                <div className={styles.drawingInfo}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span className={styles.drawingName} title={d.type}>{d.type.replace('-', ' ')}</span>
                </div>
                
                <div className={styles.actionButtons}>
                  {/* Visibility Button */}
                  <button
                    className={`${styles.actionBtn} ${!isVisible ? styles.inactiveBtn : ''}`}
                    onClick={() => onUpdateDrawing(d.id, { options: { ...d.options, visible: !isVisible } })}
                    title={isVisible ? 'Hide object' : 'Show object'}
                  >
                    {isVisible ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>

                  {/* Lock Button */}
                  <button
                    className={`${styles.actionBtn} ${isLocked ? styles.activeLock : ''}`}
                    onClick={() => onUpdateDrawing(d.id, { options: { ...d.options, locked: !isLocked } })}
                    title={isLocked ? 'Unlock object' : 'Lock object'}
                  >
                    {isLocked ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )}
                  </button>

                  {/* Delete Button */}
                  <button 
                    className={styles.deleteBtn}
                    onClick={() => onDelete(d.id)}
                    title="Delete object"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
