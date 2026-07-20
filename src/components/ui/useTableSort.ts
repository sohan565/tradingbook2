'use client';

import { useMemo, useState, useCallback } from 'react';

export interface SortState {
  key: string | null;
  dir: 'asc' | 'desc';
}

/**
 * Column sorting for data tables. Cycle per header click:
 * unsorted → desc → asc → unsorted. Sorting is applied over a copy;
 * `null` key returns the rows in their natural order.
 */
export function useTableSort<T>(
  rows: T[],
  accessors: Record<string, (row: T) => number | string>,
) {
  const [sort, setSort] = useState<SortState>({ key: null, dir: 'desc' });

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'asc' };
      return { key: null, dir: 'desc' };
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const accessor = accessors[sort.key];
    if (!accessor) return rows;
    const mul = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
      return String(va).localeCompare(String(vb)) * mul;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  return { sorted, sort, toggleSort };
}

/** Arrow glyph for a sortable header; empty when the column is unsorted. */
export function sortIndicator(sort: SortState, key: string): string {
  if (sort.key !== key) return '';
  return sort.dir === 'asc' ? ' ▲' : ' ▼';
}
