'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import styles from './page.module.css';

interface RecordItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  totalTrades: number;
  winRate: number;
  netR: number;
  netPips: number;
  avgRR: number;
  profitFactor: number;
}

export default function BacktestJournalPage() {
  const confirm = useConfirm();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/backtest-journal/records');
      const data = await res.json();
      if (data.success) {
        setRecords(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch records:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setFormName('');
    setFormDesc('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: RecordItem) => {
    setModalMode('edit');
    setEditingId(record.id);
    setFormName(record.name);
    setFormDesc(record.description || '');
    setIsModalOpen(true);
    setActiveDropdown(null);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      if (modalMode === 'create') {
        const res = await fetch('/api/backtest-journal/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, description: formDesc }),
        });
        const data = await res.json();
        if (data.success) {
          fetchRecords();
        }
      } else if (modalMode === 'edit' && editingId) {
        const res = await fetch(`/api/backtest-journal/records/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, description: formDesc }),
        });
        const data = await res.json();
        if (data.success) {
          fetchRecords();
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to submit modal:', err);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    const ok = await confirm({
      title: 'Delete backtest record?',
      message: 'All associated trade entries will be permanently deleted.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/backtest-journal/records/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setRecords(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete record:', err);
    }
    setActiveDropdown(null);
  };

  const handleDuplicateRecord = async (id: string) => {
    try {
      const res = await fetch(`/api/backtest-journal/records/${id}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        fetchRecords();
      }
    } catch (err) {
      console.error('Failed to duplicate record:', err);
    }
    setActiveDropdown(null);
  };

  const handleExportRecord = (id: string) => {
    window.open(`/api/backtest-journal/export?recordId=${id}`);
    setActiveDropdown(null);
  };

  const toggleDropdown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Backtesting Journal</h1>
          <p className={styles.subtitle}>
            Organize backtest sessions, upload TradingView screenshots, and leverage Gemini AI to log trades instantly.
          </p>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingSpinner} />
      ) : records.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
            <path d="M6 6h10M6 10h10M6 14h10"/>
          </svg>
          <div className={styles.emptyTitle}>No Backtest Records Yet</div>
          <p className={styles.emptyDesc}>
            Create your first backtest folder/project to start cataloging strategy screenshots and run coach metrics.
          </p>
          <button className={styles.emptyBtn} onClick={handleOpenCreateModal}>
            + Create New Record
          </button>
        </div>
      ) : (
        <div className={styles.recordsGrid}>
          {records.map(record => (
            <div key={record.id} className={styles.recordCard}>
              <div>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleSection}>
                    <h2 className={styles.recordName}>{record.name}</h2>
                    <p className={styles.recordDesc}>{record.description || 'No description provided.'}</p>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button
                      className={styles.actionsTrigger}
                      onClick={(e) => toggleDropdown(e, record.id)}
                      aria-label="Actions menu"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                      </svg>
                    </button>
                    {activeDropdown === record.id && (
                      <div className={styles.dropdownMenu} ref={dropdownRef}>
                        <button className={styles.dropdownItem} onClick={() => handleOpenEditModal(record)}>
                          Rename
                        </button>
                        <button className={styles.dropdownItem} onClick={() => handleDuplicateRecord(record.id)}>
                          Duplicate
                        </button>
                        <button className={styles.dropdownItem} onClick={() => handleExportRecord(record.id)}>
                          Export CSV
                        </button>
                        <button className={`${styles.dropdownItem} styles.dropdownDelete`} onClick={() => handleDeleteRecord(record.id)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.statsRow}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Trades</span>
                    <span className={styles.statVal}>{record.totalTrades}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Win Rate</span>
                    <span className={styles.statVal}>{record.winRate}%</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Net R</span>
                    <span className={`${styles.statVal} ${record.netR >= 0 ? styles.statValPositive : styles.statValNegative}`}>
                      {record.netR >= 0 ? '+' : ''}{record.netR}R
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.updatedText}>
                  Updated {new Date(record.updatedAt).toLocaleDateString()}
                </span>
                <Link href={`/backtest-journal/${record.id}`}>
                  <button className={styles.openBtn}>Open Record</button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Create Button */}
      {records.length > 0 && (
        <button className={styles.floatingBtn} onClick={handleOpenCreateModal}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Backtest Record
        </button>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={handleModalSubmit}>
            <h2 className={styles.modalTitle}>
              {modalMode === 'create' ? 'New Backtest Record' : 'Rename Backtest Record'}
            </h2>
            <div className={styles.formGroup}>
              <label htmlFor="recordName">Strategy / Record Name</label>
              <input
                id="recordName"
                type="text"
                placeholder="e.g. ICT Silver Bullet"
                className={styles.input}
                value={formName}
                onChange={e => setFormName(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="recordDesc">Description (Optional)</label>
              <textarea
                id="recordDesc"
                placeholder="Brief summary of setup rules, session restrictions or notes..."
                className={styles.textarea}
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn}>
                {modalMode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
