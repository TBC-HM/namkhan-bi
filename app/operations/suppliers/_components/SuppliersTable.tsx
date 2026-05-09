'use client';

// app/operations/suppliers/_components/SuppliersTable.tsx
// Sortable supplier table — channels-pattern parity. Rows link to the
// supplier detail page. Logo: brass initials in a circle (no logo_url
// column on gl.v_supplier_overview / gl.vendors, so initials it is).

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { fmtMoney, fmtIsoDate, EMPTY } from '@/lib/format';

export interface SupplierRow {
  name: string;
  category: string | null;
  terms: string | null;
  email: string | null;
  currency: string | null;
  grossUsd: number;
  lineCount: number;
  lastTxnDate: string | null;
  lastDays: number | null;
  activeRecent: boolean;
  openBalanceLak: number;
  openBalanceUsd: number;
  openBillCount: number;
}

type SortKey =
  | 'name' | 'category' | 'currency' | 'grossUsd'
  | 'lineCount' | 'lastTxnDate' | 'openBalanceLak' | 'status';
type SortDir = 'asc' | 'desc';

function initials(name: string): string {
  const cleaned = name
    .replace(/\s*-\s*lao kip\s*$/i, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\.com$/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function statusOf(r: SupplierRow): { tone: 'good' | 'warn' | 'bad' | 'mute'; label: string } {
  if (r.openBalanceLak > 0) return { tone: 'bad', label: `OPEN · ${r.openBillCount}` };
  if (r.lastDays == null) return { tone: 'mute', label: 'NO ACTIVITY' };
  if (r.lastDays <= 30) return { tone: 'good', label: 'ACTIVE' };
  if (r.lastDays <= 90) return { tone: 'warn', label: 'RECENT' };
  return { tone: 'mute', label: 'DORMANT' };
}

function sortValue(r: SupplierRow, k: SortKey): string | number {
  switch (k) {
    case 'name': return r.name.toLowerCase();
    case 'category': return (r.category ?? 'zzz').toLowerCase();
    case 'currency': return r.currency ?? '';
    case 'grossUsd': return r.grossUsd;
    case 'lineCount': return r.lineCount;
    case 'lastTxnDate': return r.lastTxnDate ?? '';
    case 'openBalanceLak': return r.openBalanceLak;
    case 'status': {
      const s = statusOf(r);
      // good < warn < bad < mute (most attention sorted first when desc)
      return { good: 0, warn: 1, bad: 2, mute: 3 }[s.tone];
    }
  }
}

export default function SuppliersTable({ rows }: { rows: SupplierRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('grossUsd');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  function flip(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc'); }
  }

  function caret(k: SortKey): string {
    if (k !== sortKey) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
        No suppliers in gl.v_supplier_overview. Run the QB ingest job first.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ cursor: 'pointer' }} onClick={() => flip('name')}>Supplier{caret('name')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => flip('category')}>Category{caret('category')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => flip('currency')}>Ccy{caret('currency')}</th>
            <th className="num" style={{ cursor: 'pointer' }} onClick={() => flip('grossUsd')}>Spend (USD){caret('grossUsd')}</th>
            <th className="num" style={{ cursor: 'pointer' }} onClick={() => flip('lineCount')}>Lines{caret('lineCount')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => flip('lastTxnDate')}>Last txn{caret('lastTxnDate')}</th>
            <th className="num" style={{ cursor: 'pointer' }} onClick={() => flip('openBalanceLak')}>Open balance{caret('openBalanceLak')}</th>
            <th style={{ cursor: 'pointer' }} onClick={() => flip('status')}>Status{caret('status')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const st = statusOf(r);
            const inits = initials(r.name);
            return (
              <tr key={r.name}>
                <td className="lbl">
                  <Link
                    href={`/operations/suppliers/${encodeURIComponent(r.name)}`}
                    style={{ color: 'var(--brass)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--brass)', color: 'var(--ink)',
                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, flexShrink: 0,
                      }}
                    >
                      {inits}
                    </span>
                    <strong>{r.name}</strong>
                  </Link>
                  {r.email && <div style={{ marginTop: 2, marginLeft: 30, color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.email}</div>}
                </td>
                <td className="lbl text-mute">{r.category ?? EMPTY}</td>
                <td className="lbl text-mute">{r.currency ?? EMPTY}</td>
                <td className="num">{fmtMoney(r.grossUsd, 'USD')}</td>
                <td className="num">{r.lineCount}</td>
                <td className="lbl text-mute">
                  {r.lastTxnDate ? fmtIsoDate(r.lastTxnDate) : EMPTY}
                  {r.lastDays != null && (
                    <span style={{ marginLeft: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                      {r.lastDays}d
                    </span>
                  )}
                </td>
                <td className="num">
                  {r.openBalanceLak > 0
                    ? <span style={{ color: 'var(--oxblood)' }}>₭{r.openBalanceLak.toLocaleString('en-US')}</span>
                    : EMPTY}
                </td>
                <td>
                  <span className={`pill ${st.tone === 'good' ? 'good' : st.tone === 'bad' ? 'bad' : st.tone === 'warn' ? 'warn' : 'neutral'}`}>
                    {st.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
