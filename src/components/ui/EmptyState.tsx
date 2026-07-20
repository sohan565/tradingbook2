'use client';

import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

/** Icon + short copy + optional CTA, replacing bare "No data" text divs. */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.45rem',
        padding: '2rem 1rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '1.6rem', opacity: 0.55, lineHeight: 1 }} aria-hidden="true">
        {icon}
      </div>
      <div
        style={{
          fontSize: '0.85rem',
          fontWeight: 650,
          color: 'var(--term-text-2, var(--text-secondary))',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: '0.78rem',
            lineHeight: 1.5,
            maxWidth: 360,
            color: 'var(--term-text-3, var(--text-muted))',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {description}
        </div>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            marginTop: '0.5rem',
            minHeight: 44,
            padding: '0.45rem 1rem',
            fontSize: '0.8rem',
            fontWeight: 650,
            fontFamily: 'var(--font-sans)',
            color: 'var(--term-accent, var(--accent))',
            background: 'var(--term-accent-soft, var(--accent-glow))',
            border: '1px solid var(--term-accent-border, var(--border-active))',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
