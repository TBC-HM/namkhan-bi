// ListContainer — peek N rows + drawer with sortable / searchable full table.
// Spec: design_system v5 §3.5. Generic over T.

'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { ListContainerProps, ListContainerColumn } from '../types';
import Container from './Container';
import Drawer from '../overlay/Drawer';
import '../internal/tokens.css';

export default function ListContainer<T>(props: ListContainerProps<T>) {
  const {
    title, subtitle, data, preview = 5, renderRow, rowKey, drawerColumns, drawerSearchKeys,
    drawerDefaultSort, showAllLabel, onRowClick, loading, empty, status, action,
  } = props;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: keyof T & string; direction: 'asc' | 'desc' } | undefined>(drawerDefaultSort);

  const cap = Math.min(10, preview);
  const peek = data.slice(0, cap);
  const overflow = Math.max(0, data.length - cap);

  const searchable = useMemo<(keyof T & string)[]>(() => {
    if (drawerSearchKeys && drawerSearchKeys.length > 0) return drawerSearchKeys;
    return drawerColumns.filter((c) => c.searchable !== false).map((c) => c.key);
  }, [drawerSearchKeys, drawerColumns]);

  const filtered = useMemo<T[]>(() => {
    const needle = search.trim().toLowerCase();
    let rows = data;
    if (needle) {
      rows = rows.filter((r) => searchable.some((k) => {
        const v = (r as Record<string, unknown>)[k as string];
        return v !== null && v !== undefined && String(v).toLowerCase().includes(needle);
      }));
    }
    if (sort) {
      rows = [...rows].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sort.key];
        const bv = (b as Record<string, unknown>)[sort.key];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return sort.direction === 'asc' ? av - bv : bv - av;
        const cmp = String(av).localeCompare(String(bv));
        return sort.direction === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, search, sort, searchable]);

  const showAllAction = data.length > cap ? (
    <button type="button" onClick={() => setDrawerOpen(true)} style={S.linkBtn}>
      {showAllLabel ?? `Show all ${data.length}`}
    </button>
  ) : null;

  const actionNode: ReactNode = (action || showAllAction)
    ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {action}
        {showAllAction}
      </div>
    )
    : null;

  return (
    <Container title={title} subtitle={subtitle} action={actionNode} loading={loading} status={status}>
      {!loading && peek.length === 0 && (
        <div style={S.empty}>
          <div style={S.emptyTitle}>{empty?.title ?? 'No items'}</div>
          {empty?.hint && <div style={S.emptyHint}>{empty.hint}</div>}
        </div>
      )}
      {peek.length > 0 && (
        <div style={S.peek}>
          {peek.map((row) => (
            <div
              key={rowKey(row)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : -1}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(e) => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(row); } }}
              style={{ ...S.peekRow, cursor: onRowClick ? 'pointer' : 'default' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg, #F4EFE2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {renderRow(row)}
            </div>
          ))}
        </div>
      )}
      {overflow > 0 && (
        <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>
          {overflow} more — click "Show all" to expand.
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={title}
        subtitle={`${filtered.length} of ${data.length} items`}
        width="lg"
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={S.search}
          aria-label="Search list"
        />
        <table style={S.table}>
          <thead>
            <tr>
              {drawerColumns.map((c) => (
                <th
                  key={c.key as string}
                  style={{ ...S.th, textAlign: c.align ?? 'left', cursor: c.sortable !== false ? 'pointer' : 'default', width: c.width }}
                  onClick={() => {
                    if (c.sortable === false) return;
                    setSort((prev) =>
                      prev?.key === c.key
                        ? { key: c.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                        : { key: c.key, direction: 'asc' },
                    );
                  }}
                >
                  {c.label}{sort?.key === c.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={rowKey(row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg, #F4EFE2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => onRowClick?.(row)}
              >
                {drawerColumns.map((c: ListContainerColumn<T>) => (
                  <td
                    key={c.key as string}
                    style={{ ...S.td, textAlign: c.align ?? 'left' }}
                  >
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key as string] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={drawerColumns.length} style={{ ...S.td, textAlign: 'center', color: 'var(--ink-soft, #5A5A5A)' }}>
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Drawer>
    </Container>
  );
}

const S: Record<string, CSSProperties> = {
  peek: { display: 'flex', flexDirection: 'column' },
  peekRow: { padding: '8px 4px', borderBottom: '1px solid var(--hairline, #E6DFCC)', transition: 'background 80ms ease' },
  linkBtn: { background: 'transparent', border: 'none', color: 'var(--primary, #1F3A2E)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, fontFamily: 'inherit' },
  empty: { padding: '24px 8px', textAlign: 'center', border: '1px dashed var(--hairline, #E6DFCC)', borderRadius: 6, color: 'var(--ink-soft, #5A5A5A)' },
  emptyTitle: { fontSize: 13, fontWeight: 600 },
  emptyHint: { fontSize: 11, marginTop: 4 },
  search: { width: '100%', padding: '8px 12px', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4, fontSize: 13, marginBottom: 12, background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)', fontFamily: 'inherit' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '8px 12px', borderBottom: '1px solid var(--hairline, #E6DFCC)', color: 'var(--ink-soft, #5A5A5A)', fontWeight: 500, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em', userSelect: 'none' },
  td: { padding: '8px 12px', borderBottom: '1px solid var(--hairline, #E6DFCC)', fontVariantNumeric: 'tabular-nums' },
};
