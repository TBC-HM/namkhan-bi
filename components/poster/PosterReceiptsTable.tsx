'use client';

// components/poster/PosterReceiptsTable.tsx
// Searchable raw Poster receipts list — same UX pattern as FnbRawTransactions.

import { useMemo, useState, type CSSProperties } from 'react';
import type { PosterReceipt } from '@/lib/data-poster';

interface Props {
  data: PosterReceipt[];
  pageSize?: number;
}

const PAYMENT_METHODS = [
  'all',
  'Charge Room / to Folio',
  'Card',
  'Cash',
  'Bank Transfer',
  'Without payment',
  'Internal  (Bfast,Mgmt/Staff,IMekong)',
  'Payment through Office',
  'House Acccount Charge',
  'Free Breakfast',
  'Combined',
  'Gift card',
] as const;
const STATUSES = ['all', 'Close', 'Open', 'Delete', 'Canceled'] as const;

export default function PosterReceiptsTable({ data, pageSize = 200 }: Props) {
  const [q, setQ]               = useState('');
  const [pm, setPm]             = useState<string>('all');
  const [status, setStatus]     = useState<string>('all');
  const [pageEnd, setPageEnd]   = useState(pageSize);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter((r) => {
      if (pm !== 'all' && r.payment_method !== pm) return false;
      if (status !== 'all' && r.status !== status) return false;
      if (!needle) return true;
      return (
        String(r.receipt_id).includes(needle) ||
        (r.client       ?? '').toLowerCase().includes(needle) ||
        (r.waiter       ?? '').toLowerCase().includes(needle) ||
        (r.table_label  ?? '').toLowerCase().includes(needle) ||
        (r.order_source ?? '').toLowerCase().includes(needle) ||
        (r.open_at      ?? '').toLowerCase().includes(needle)
      );
    });
  }, [data, q, pm, status]);

  const visible = filtered.slice(0, pageEnd);
  const orderSum = filtered.reduce((s, r) => s + Number(r.order_total ?? 0), 0);
  const paidSum  = filtered.reduce((s, r) => s + Number(r.paid ?? 0), 0);

  const fmtAmt = (n: number | null) => {
    if (n == null) return '—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs === 0) return '—';
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}k`;
    return `${sign}$${abs.toFixed(2)}`;
  };
  const fmtDt = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    return d.toLocaleString('en-GB', { year: '2-digit', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
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
    minWidth: 200,
  };
  const selStyle: CSSProperties = { ...inputStyle, minWidth: 120 };

  const statusColor = (s: string | null) => {
    if (s === 'Close')    return 'var(--good, #2c7a4b)';
    if (s === 'Open')     return 'var(--brass)';
    if (s === 'Delete')   return 'var(--bad, #b53a2a)';
    if (s === 'Canceled') return 'var(--ink-soft)';
    return 'var(--ink-soft)';
  };

  const reconBadge = (r: PosterReceipt): { label: string; color: string; title: string } => {
    if (r.payment_method !== 'Charge Room / to Folio') return { label: '·', color: 'var(--ink-soft)', title: 'Not a charge-to-room receipt' };
    const w = r.reconciled_with;
    if (w === 'cloudbeds_match')   return { label: '✓',  color: 'var(--good, #2c7a4b)', title: `Exact match on Cloudbeds folio${r.cb_match_amount ? ` ($${r.cb_match_amount.toFixed(2)})` : ''}` };
    if (w === 'amount_close')      return { label: '⚠',  color: 'var(--brass)',         title: `Amount close to CB folio (±5%) — delta $${r.cb_match_delta?.toFixed(2) ?? '?'}` };
    if (w === 'amount_mismatch')   return { label: '✗',  color: 'var(--bad, #b53a2a)',  title: `CB folio total ≠ Poster · delta $${r.cb_match_delta?.toFixed(2) ?? '?'}` };
    if (w === 'no_cb_lines')       return { label: '✗',  color: 'var(--bad)',           title: 'Reservation found but no F&B charge on Cloudbeds folio' };
    if (w === 'ambiguous_room')    return { label: '?',  color: 'var(--ink-soft)',      title: 'Multiple guests in same room type that day — needs manual match' };
    if (w === 'no_match')          return { label: '?',  color: 'var(--ink-soft)',      title: 'Could not resolve client → reservation (Poster name unrecognized)' };
    return { label: '·', color: 'var(--ink-soft)', title: 'Not yet reconciled' };
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search receipt # / client / waiter / table / date…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPageEnd(pageSize); }}
          style={inputStyle}
        />
        <select value={pm} onChange={(e) => { setPm(e.target.value); setPageEnd(pageSize); }} style={selStyle}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m === 'all' ? 'All payment' : m}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPageEnd(pageSize); }} style={selStyle}>
          {STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All status' : s}</option>)}
        </select>
        <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
          {filtered.length.toLocaleString()} rows · order ${Math.round(orderSum).toLocaleString()} · paid ${Math.round(paidSum).toLocaleString()}
        </span>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto', border: '1px solid var(--paper-deep)', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-warm)', zIndex: 1 }}>
            <tr>
              {[
                { l: 'Open',    a: 'left'  as const },
                { l: '# ',      a: 'right' as const },
                { l: 'Source',  a: 'left'  as const },
                { l: 'Client',  a: 'left'  as const },
                { l: 'Pax',     a: 'right' as const },
                { l: 'Order',   a: 'right' as const },
                { l: 'Paid',    a: 'right' as const },
                { l: 'Method',  a: 'left'  as const },
                { l: 'Status',  a: 'left'  as const },
                { l: 'Recon',   a: 'left'  as const },
                { l: 'Waiter',  a: 'left'  as const },
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
              <tr><td colSpan={10} style={{ padding: 16, color: 'var(--ink-soft)', fontStyle: 'italic', textAlign: 'center' }}>
                No rows match the filter.
              </td></tr>
            ) : visible.map((r) => (
              <tr key={r.receipt_id}>
                <td style={{ ...cellL, whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>{fmtDt(r.open_at)}</td>
                <td style={{ ...cell, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.receipt_id}</td>
                <td style={{ ...cellL, color: 'var(--ink-soft)', fontSize: 'var(--t-xs)' }}>{r.order_source ?? '—'}</td>
                <td style={cellL}>{r.client ?? '—'}</td>
                <td style={cell}>{r.customers_count ?? '—'}</td>
                <td style={cell}>{fmtAmt(r.order_total)}</td>
                <td style={{ ...cell, color: (r.paid ?? 0) === 0 && (r.order_total ?? 0) > 0 ? 'var(--brass)' : 'var(--ink)' }}>{fmtAmt(r.paid)}</td>
                <td style={{ ...cellL, color: 'var(--ink-soft)', fontSize: 'var(--t-xs)' }}>{r.payment_method ?? '—'}</td>
                <td style={{ ...cellL, color: statusColor(r.status), fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.status ?? '—'}</td>
                <td style={{ ...cellL, fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' }}>
                  {(() => { const b = reconBadge(r); return <span title={b.title} style={{ color: b.color, fontWeight: 600 }}>{b.label}</span>; })()}
                </td>
                <td style={{ ...cellL, color: 'var(--ink-soft)', fontSize: 'var(--t-xs)' }}>{r.waiter ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > pageEnd && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setPageEnd((p) => p + pageSize)}
            style={{
              background: 'transparent', border: 0, padding: '6px 10px', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase', color: 'var(--brass)',
            }}
          >Show next {pageSize} ▾  ({filtered.length - pageEnd} more)</button>
        </div>
      )}
    </div>
  );
}
