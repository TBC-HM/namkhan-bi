'use client';

// components/pl/FnbRawTransactions.tsx
//
// Searchable raw POS transactions list for /operations/restaurant.
// Loads up to 2000 most-recent F&B charges server-side, then filters
// client-side by item / reservation / poster / date / subdept.
// Used to spot-check Cloudbeds POS data and to reconcile against
// PosterPOS imports when those start landing.

import { useMemo, useState, type CSSProperties } from 'react';
import type { FnbRawTxn } from '@/lib/data';

interface Props {
  data: FnbRawTxn[];
  /** How many rows to render at once (default 200). User can click "Show more". */
  pageSize?: number;
}

export default function FnbRawTransactions({ data, pageSize = 200 }: Props) {
  const [q, setQ]               = useState('');
  const [subdept, setSubdept]   = useState<'all' | 'Food' | 'Beverage'>('all');
  const [pageEnd, setPageEnd]   = useState(pageSize);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter((t) => {
      if (subdept !== 'all' && t.usali_subdept !== subdept) return false;
      if (!needle) return true;
      return (
        t.description.toLowerCase().includes(needle)         ||
        (t.reservation_id     ?? '').toLowerCase().includes(needle) ||
        (t.user_name          ?? '').toLowerCase().includes(needle) ||
        (t.item_category_name ?? '').toLowerCase().includes(needle) ||
        t.transaction_date.includes(needle)
      );
    });
  }, [data, q, subdept]);

  const visible = filtered.slice(0, pageEnd);
  const totalAmount = filtered.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
  const refundsAmount = filtered.reduce((s, t) => s + (t.amount < 0 ? t.amount : 0), 0);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    return d.toLocaleString('en-GB', {
      year: '2-digit', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  };
  const fmtAmt = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}k`;
    return `${sign}$${abs.toFixed(2)}`;
  };

  const cell: CSSProperties = {
    padding: '5px 10px',
    borderBottom: '1px solid var(--rule, #e3dfd3)',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    fontSize: 'var(--t-sm)',
  };
  const cellL: CSSProperties = { ...cell, textAlign: 'left' };
  const inputStyle: CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-sm)',
    padding: '6px 10px',
    border: '1px solid var(--paper-deep)',
    borderRadius: 4,
    background: 'var(--paper-warm)',
    color: 'var(--ink)',
    minWidth: 240,
  };
  const selStyle: CSSProperties = { ...inputStyle, minWidth: 120 };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search item / reservation / poster / date…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPageEnd(pageSize); }}
          style={inputStyle}
        />
        <select
          value={subdept}
          onChange={(e) => { setSubdept(e.target.value as any); setPageEnd(pageSize); }}
          style={selStyle}
        >
          <option value="all">All subdept</option>
          <option value="Food">Food only</option>
          <option value="Beverage">Beverage only</option>
        </select>
        <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
          {filtered.length.toLocaleString()} rows · {fmtAmt(totalAmount)} charges{refundsAmount < 0 ? ` · ${fmtAmt(refundsAmount)} refunds` : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto', border: '1px solid var(--paper-deep)', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-warm)', zIndex: 1 }}>
            <tr>
              {[
                { l: 'Date', a: 'left' as const },
                { l: 'Item', a: 'left' as const },
                { l: 'Subdept', a: 'left' as const },
                { l: 'Reservation', a: 'left' as const },
                { l: 'Poster', a: 'left' as const },
                { l: 'Amount', a: 'right' as const },
              ].map((c, i) => (
                <th key={i} style={{
                  textAlign: c.a,
                  padding: '8px 10px',
                  borderBottom: '2px solid var(--rule, #e3dfd3)',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)',
                  textTransform: 'uppercase',
                  color: 'var(--brass)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}>{c.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: 'var(--ink-soft)', fontStyle: 'italic', textAlign: 'center' }}>
                  No rows match the filter.
                </td>
              </tr>
            ) : visible.map((t) => (
              <tr key={t.transaction_id}>
                <td style={{ ...cellL, whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>{fmtDate(t.transaction_date)}</td>
                <td style={cellL}>{t.description}</td>
                <td style={{ ...cellL, color: 'var(--ink-soft)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{t.usali_subdept ?? '—'}</td>
                <td style={{ ...cellL, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{t.reservation_id ?? '—'}</td>
                <td style={{ ...cellL, color: 'var(--ink-soft)', fontSize: 'var(--t-xs)' }}>{t.user_name ?? '—'}</td>
                <td style={{ ...cell, color: t.amount < 0 ? 'var(--bad, #b53a2a)' : 'var(--ink)' }}>
                  {fmtAmt(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show more */}
      {filtered.length > pageEnd && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setPageEnd((p) => p + pageSize)}
            style={{
              background: 'transparent',
              border: 0,
              padding: '6px 10px',
              cursor: 'pointer',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--brass)',
            }}
          >
            Show next {pageSize} ▾  ({filtered.length - pageEnd} more)
          </button>
        </div>
      )}
    </div>
  );
}
