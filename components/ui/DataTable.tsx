// components/ui/DataTable.tsx
//
// THE canonical table for every list view. Locked spec per user 2026-05-03 +
// docs/11_BRAND_AND_UI_STANDARDS.md.
//
// - Header: bold mono uppercase letterspaced, brass/olive tone, subtle bottom divider
// - Numeric columns right-aligned, status columns centered, text columns left-aligned
// - Body: sans regular, tabular-nums for numeric cols, no full-grid lines
// - Hover row: subtle paper-deep tint
// - Empty cell: em-dash via fmtEmpty
// - Sortable headers (when sortable={true})

'use client';

import { ReactNode, useState, useMemo } from 'react';

export type Align = 'left' | 'right' | 'center';

export interface Column<T> {
  key: string;
  /** Header label — automatically uppercased. */
  header: string;
  /** Default 'left'. Use 'right' for currency/numeric, 'center' for status pills. */
  align?: Align;
  /** Width hint (CSS value). */
  width?: string;
  /** Render the cell. Receives the row and optional helpers. */
  render: (row: T, ctx: { rowIndex: number }) => ReactNode;
  /** Sort key extractor. If omitted column is not sortable. */
  sortValue?: (row: T) => string | number;
  /** Mark this column as numeric (forces tabular-nums even if render returns JSX). */
  numeric?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  /** Function returning a stable row key. */
  rowKey: (row: T, i: number) => string;
  /** Initial sort. */
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  /** Per-row className computed from data (e.g. unmatched rows). */
  rowClassName?: (row: T, i: number) => string | undefined;
  /** What to show when rows is empty. */
  emptyState?: ReactNode;
  /** Optional footer row (renders below tbody). */
  footer?: ReactNode;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  defaultSort,
  rowClassName,
  emptyState = 'No data.',
  footer,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | undefined>(defaultSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const out = [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return out;
  }, [rows, columns, sort]);

  const toggleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortValue) return;
    setSort((cur) =>
      cur?.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  };

  if (rows.length === 0) {
    return (
      <div className="data-table-empty">{emptyState}</div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => {
              const align = c.align ?? (c.numeric ? 'right' : 'left');
              const sortable = !!c.sortValue;
              const active = sort?.key === c.key;
              const arrow = active ? (sort?.dir === 'asc' ? ' ▲' : ' ▼') : '';
              return (
                <th
                  key={c.key}
                  className={`data-table-th align-${align}${sortable ? ' sortable' : ''}${active ? ' active' : ''}`}
                  style={c.width ? { width: c.width } : undefined}
                  onClick={sortable ? () => toggleSort(c.key) : undefined}
                >
                  {c.header}{arrow}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const rowCls = rowClassName?.(row, i);
            return (
              <tr key={rowKey(row, i)} className={`data-table-row${rowCls ? ' ' + rowCls : ''}`}>
                {columns.map((c) => {
                  const align = c.align ?? (c.numeric ? 'right' : 'left');
                  return (
                    <td
                      key={c.key}
                      className={`data-table-td align-${align}${c.numeric ? ' tabular' : ''}`}
                    >
                      {c.render(row, { rowIndex: i })}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        {footer && <tfoot><tr>{footer}</tr></tfoot>}
      </table>
    </div>
  );
}
