'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { MTAccount } from '@/types';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import styles from './accounts.module.css';

export default function AccountsPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const confirm = useConfirm();
  const [accounts, setAccounts] = useState<MTAccount[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Inputs
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [broker, setBroker] = useState<string>('');
  const [serverName, setServerName] = useState<string>('');



  // Fetch linked accounts
  const fetchAccounts = async () => {
    setIsFetching(true);
    try {
      const res = await fetch('/api/accounts');
      const json = await res.json();
      if (json.success) {
        setAccounts(json.data);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAccounts();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Register Account
  const handleRegisterAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNumber || !broker) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber,
          broker,
          serverName: serverName || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('MT5 Account linked successfully!');
        setAccountNumber('');
        setBroker('');
        setServerName('');
        fetchAccounts();
      } else {
        toast.error('Failed to register: ' + (json.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error registering account:', err);
      toast.error('Network error while registering account.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async (id: string) => {
    const ok = await confirm({
      title: 'Unlink MT5 account?',
      message: 'Saved trades will not be deleted, but no further syncs will occur.',
      confirmLabel: 'Unlink',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/accounts?id=${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Account unlinked successfully.');
        fetchAccounts();
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  // Toggle Account Active status
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(!currentStatus ? 'Account activated.' : 'Account deactivated.');
        fetchAccounts();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Copy API Key to Clipboard
  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API Key copied to clipboard!');
  };

  if (!mounted) {
    return (
      <div style={{ display: 'flex', flex: 1, backgroundColor: '#080b12', color: '#94a3b8', alignItems: 'center', justifyContent: 'center' }} suppressHydrationWarning>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }} suppressHydrationWarning>
          <div className="spinner" suppressHydrationWarning />
          <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Loading accounts console...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.accountsContainer}>
      <div className={styles.contentArea}>
        {/* Topbar Header */}
        <header className={styles.topBar}>
          <div className={styles.titleArea}>
            <span className={styles.titleText}>MetaTrader 5 Account Sync</span>
            {isFetching && (
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Refreshing status...</span>
            )}
          </div>
        </header>

        {/* Dashboard Workspace grid */}
        <main className={styles.workspace}>
          {/* Left Column: Register Form */}
          <div className={styles.leftColumn}>
            <div className={styles.card}>
              <h4 className={styles.cardTitle}>Link MT5 Account</h4>
              <form onSubmit={handleRegisterAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>MT5 Account Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50928341"
                    className={styles.inputField}
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Broker Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FTMO, FTUK, IC Markets"
                    className={styles.inputField}
                    value={broker}
                    onChange={e => setBroker(e.target.value)}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Server Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. FTMO-Demo"
                    className={styles.inputField}
                    value={serverName}
                    onChange={e => setServerName(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className={styles.registerBtn}
                  disabled={isSaving}
                >
                  {isSaving ? 'Linking...' : 'Generate API Connection'}
                </button>
              </form>
            </div>

            {/* Step-by-Step EA Setup Guidelines */}
            <div className={styles.card} style={{ flex: 1 }}>
              <h4 className={styles.cardTitle}>EA Installation Guide</h4>
              <div className={styles.stepList}>
                <div className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepText}>
                    Open the file [TradingBookSync.mq5](file:///c:/Users/sohan/OneDrive/Desktop/Tradingbook/TradingBookSync.mq5) located in your workspace, and copy the entire code.
                  </div>
                </div>

                <div className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepText}>
                    In your MetaTrader 5 Terminal, open **MetaEditor** (press **F4**), create a new **Expert Advisor (template)** named `TradingBookSync`, replace its contents with the copied code, and click **Compile** (F7).
                  </div>
                </div>

                <div className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepText}>
                    In MT5 terminal settings, navigate to Tools &rarr; Options &rarr; Expert Advisors. Check &quot;Allow WebRequest for listed URL&quot; and add: <br />
                    <code>http://localhost:3000</code>
                  </div>
                </div>

                <div className={styles.stepItem}>
                  <span className={styles.stepNum}>4</span>
                  <div className={styles.stepText}>
                    Drag the compiled EA onto any active chart. In the inputs tab, enter your unique **API Key** generated for your account number on the right.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Registered Accounts List */}
          <div className={styles.rightColumn}>
            <div className={styles.card} style={{ flex: 1, minHeight: 0 }}>
              <h4 className={styles.cardTitle}>Registered Accounts ({accounts.length})</h4>
              
              <div className={styles.accountsList} style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
                {accounts.length === 0 ? (
                  <div className={styles.emptyState}>
                    No MT5 account links registered yet. Enter your account details on the left to generate a connection sync.
                  </div>
                ) : (
                  accounts.map(acc => (
                    <div key={acc.id} className={styles.accountCard}>
                      {/* Account details */}
                      <div className={styles.accountHeader}>
                        <div className={styles.accountInfo}>
                          <div className={styles.accountNum}>
                            <span>{acc.accountNumber}</span>
                            <span className={styles.platformPill}>{acc.platform}</span>
                          </div>
                          <span className={styles.brokerName}>
                            {acc.broker} {acc.serverName ? `(${acc.serverName})` : ''}
                          </span>
                        </div>

                        <div className={styles.syncIndicator}>
                          <span className={acc.isActive ? styles.activeDot : styles.inactiveDot} />
                          <span>
                            {acc.isActive ? 'Ready for Webhook' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      {/* Secure API Key display */}
                      <div className={styles.apiKeyBox}>
                        <span className={styles.apiKeyLabel}>API KEY:</span>
                        <span className={styles.apiKeyVal}>{acc.apiKey}</span>
                        <button
                          className={styles.copyBtn}
                          onClick={() => handleCopyKey(acc.apiKey)}
                        >
                          COPY KEY
                        </button>
                      </div>

                      {/* Actions footer */}
                      <div className={styles.accountActions}>
                        <label className={styles.toggleSwitch}>
                          <input
                            type="checkbox"
                            className={styles.checkboxHidden}
                            checked={acc.isActive}
                            onChange={() => handleToggleActive(acc.id, acc.isActive)}
                          />
                          <span style={{
                            background: acc.isActive ? '#6366f1' : '#334155',
                            width: '36px',
                            height: '20px',
                            borderRadius: '10px',
                            display: 'inline-block',
                            position: 'relative',
                            transition: 'background 0.2s ease',
                          }}>
                            <span style={{
                              width: '14px',
                              height: '14px',
                              background: '#fff',
                              borderRadius: '50%',
                              display: 'block',
                              position: 'absolute',
                              top: '3px',
                              left: acc.isActive ? '19px' : '3px',
                              transition: 'left 0.2s ease',
                            }} />
                          </span>
                          <span>{acc.isActive ? 'Enabled' : 'Disabled'}</span>
                        </label>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {acc.lastSyncAt && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)' }}>
                              Last Sync: {new Date(acc.lastSyncAt).toLocaleTimeString()}
                            </span>
                          )}
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteAccount(acc.id)}
                          >
                            Unlink Account
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

    </div>
  );
}
