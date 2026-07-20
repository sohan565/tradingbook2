'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  disabled?: boolean;
  /** 'sm' fits dense toolbars; 'md' (default) meets the 44px touch target */
  size?: 'sm' | 'md';
  /** Extra styles merged onto the wrapper (width, margins, ...) */
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Token-themed replacement for native <select>. Native dropdown panels ignore
 * [data-theme], so this renders its own listbox using the design-system
 * variables. Keyboard support: Enter/Space/ArrowDown open, Arrow keys move,
 * Home/End jump, type-ahead by first letter, Enter selects, Esc closes.
 */
export default function Select({
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
  size = 'md',
  style,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Panel placement, decided on open from available viewport space
  const [placement, setPlacement] = useState<{ up: boolean; right: boolean }>({ up: false, right: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // Flip the panel up / right-align it when it would clip the viewport edge
  const openPanel = useCallback((initialIndex: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const panelHeight = 288; // maxHeight 280 + gap
      setPlacement({
        up: window.innerHeight - rect.bottom < panelHeight && rect.top > panelHeight,
        right: rect.left + Math.max(rect.width, 180) > window.innerWidth - 8,
      });
    }
    setOpen(true);
    setActiveIndex(initialIndex);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  // Keep the active option scrolled into view
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const moveActive = (delta: number) => {
    setActiveIndex((prev) => {
      const start = prev < 0 ? selectedIndex : prev;
      let next = start;
      for (let i = 0; i < options.length; i++) {
        next = (next + delta + options.length) % options.length;
        if (!options[next]?.disabled) break;
      }
      return next;
    });
  };

  const commit = (index: number) => {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) {
          openPanel(selectedIndex);
        } else {
          commit(activeIndex >= 0 ? activeIndex : selectedIndex);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          openPanel(selectedIndex);
        } else {
          moveActive(1);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) moveActive(-1);
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          setActiveIndex(options.findIndex((o) => !o.disabled));
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          for (let i = options.length - 1; i >= 0; i--) {
            if (!options[i].disabled) {
              setActiveIndex(i);
              break;
            }
          }
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case 'Tab':
        close();
        break;
      default: {
        // Type-ahead: jump to the next option starting with the pressed key
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const char = e.key.toLowerCase();
          const start = (activeIndex >= 0 ? activeIndex : selectedIndex) + 1;
          for (let i = 0; i < options.length; i++) {
            const idx = (start + i) % options.length;
            if (!options[idx].disabled && options[idx].label.toLowerCase().startsWith(char)) {
              if (open) setActiveIndex(idx);
              else onChange(options[idx].value);
              break;
            }
          }
        }
      }
    }
  };

  return (
    <div ref={rootRef} className={className} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (open) close();
          else openPanel(selectedIndex);
        }}
        onKeyDown={onKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          width: '100%',
          minHeight: size === 'sm' ? 28 : 44,
          padding: size === 'sm' ? '0.2rem 0.5rem' : '0.45rem 0.7rem',
          fontSize: size === 'sm' ? '0.78rem' : '0.85rem',
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          textAlign: 'left',
          color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color var(--t-fast)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? ''}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--t-fast)',
          }}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          id={listboxId}
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute',
            ...(placement.up
              ? { bottom: 'calc(100% + 4px)' }
              : { top: 'calc(100% + 4px)' }),
            ...(placement.right ? { right: 0 } : { left: 0 }),
            zIndex: 'var(--z-overlay)' as any,
            minWidth: '100%',
            maxHeight: 280,
            overflowY: 'auto',
            margin: 0,
            padding: '0.3rem',
            listStyle: 'none',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === activeIndex;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                data-index={i}
                onPointerMove={() => setActiveIndex(i)}
                onClick={() => commit(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  padding: '0.45rem 0.6rem',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-sans)',
                  color: opt.disabled
                    ? 'var(--text-disabled)'
                    : isSelected
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                  fontWeight: isSelected ? 650 : 450,
                  background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <path d="M2 6.5L4.5 9L10 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
