'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Accessible replacement for window.confirm(). Await the promise:
 *   const ok = await confirm({ message: 'Delete this session?', danger: true });
 * Focus is trapped in the dialog, Esc cancels, Enter confirms.
 */
export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return fn;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
    previousFocusRef.current?.focus?.();
  }, []);

  // Focus the confirm button when the dialog opens
  useEffect(() => {
    if (pending) confirmBtnRef.current?.focus();
  }, [pending]);

  // Esc cancels; trap Tab between the two buttons
  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        settle(false);
      } else if (e.key === 'Tab') {
        const dialog = document.getElementById('tb-confirm-dialog');
        if (!dialog) return;
        const focusables = dialog.querySelectorAll<HTMLElement>('button');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [pending, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-modal)' as any,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 10, 12, 0.45)',
            backdropFilter: 'blur(2px)',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) settle(false);
          }}
        >
          <div
            id="tb-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tb-confirm-title"
            aria-describedby="tb-confirm-message"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              padding: '1.25rem 1.4rem',
              width: 'min(420px, calc(100vw - 2rem))',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <h2
              id="tb-confirm-title"
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {pending.title ?? 'Are you sure?'}
            </h2>
            <p
              id="tb-confirm-message"
              style={{
                margin: '0.6rem 0 1.2rem',
                fontSize: '0.85rem',
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
              }}
            >
              {pending.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => settle(false)}
                style={{
                  minHeight: 44,
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                ref={confirmBtnRef}
                onClick={() => settle(true)}
                style={{
                  minHeight: 44,
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-sans)',
                  color: '#ffffff',
                  background: pending.danger ? 'var(--color-loss)' : 'var(--accent)',
                  border: '1px solid transparent',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
