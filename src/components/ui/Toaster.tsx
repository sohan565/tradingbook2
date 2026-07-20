'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from 'next-themes';

// App-wide toast host. Mounted once in the root layout; call `toast.success/
// error/info` from anywhere. Styled entirely with the design-system tokens so
// both themes work without per-theme overrides.
export default function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      position="bottom-right"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      gap={8}
      toastOptions={{
        style: {
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.85rem',
        },
        classNames: {
          success: 'tb-toast-success',
          error: 'tb-toast-error',
          info: 'tb-toast-info',
        },
      }}
    />
  );
}
