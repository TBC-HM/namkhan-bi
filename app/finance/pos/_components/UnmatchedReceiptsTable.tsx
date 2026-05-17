'use client';

// app/finance/pos/_components/UnmatchedReceiptsTable.tsx
//
// Controller drill for Charge-to-room reconciliation.
// Filters: month dropdown · client / waiter / receipt-id search · bucket toggle.
//
// PBS 2026-05-15 root cause callout: the "Match exists but amount differs"
// bucket is NOT typically a service-charge / tax issue — Poster posts
// `order_total` with `service_charge` and `taxes` columns BOTH zero. The
// match algorithm pairs by Poster.client (room-type alias) + close date,
// so when 2+ guests share a room type on the same day, multiple Poster
// receipts collapse onto the same Cloudbeds room total → wild deltas.
// True fix lives in the upstream reconcile pipeline (join by
// cb_reservation_id, not room-type-alias). This UI surfaces the mess.

import { useMemo, useState } from 'react';
import type { PosUnmatchedReceipt } from '@/lib/data-pos-unmatched';
import { fmtMoney } from '@/lib/format';
import CloudbedsReservationLink from '@/components/cloudbeds/CloudbedsReservationLink';

interface Props {
  rows: PosUnmatchedReceipt[];
}

const PAGE = 100;

export default function UnmatchedReceiptsTable({ rows }: Props) {
  const [month, setMonth]   = useState<string>('all');
  const [bucket, setBucket] = useState<'all' | 'no_cb_match' | 'amount_mismatch'>('all');
  const [q, setQ]           = useState('');
  const [limit, setLimit]   = useState(PAGE);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.month_yyyymm) set.add(r.month_yyyymm);
    return Array.from(set).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (month !== 'all' && r.month_yyyymm !== month) return false;
      if (bucket !== 'all' && r.bucket !== bucket) return false;
      if (needle) {
        const hay = [
          r.poster_client ?? '',
          r.waiter ?? '',
          r.table_label ?? '',
          r.cb_reservation_id ?? '',
          String(r.receipt_id),
        ].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, month, bucket, q]);

  const visible = filtered.slice(0, limit);
  const totalDelta = filtered.reduce((s, r) => s + (Number(r.cb_match_delta) || 0), 0);
  const totalOrder = filtered.reduce((s, r) => s + (Number(r.order_total) || 0), 0);

  return (
    <div style={{ padding: 12 }}>
      {/* Root-cause banner */}
      <div
        style={{
          marginBottom: 12,
          padding: '10px 12px',
          fontSize: 'var(--t-sm)',
          color: 'var(--ink-soft)',
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderLeft: '3px solid var(--st-warn, #C28F2C)',
          borderRadius: 6,
        }}
      >
        <strong style={{ color: 'var(--st-warn, #C28F2C)' }}>What "amount differs" means here:</strong>{' '}
        not service charge, not tax. Poster posts <code>order_total</code> with
        <code> service_charge=0</code> and <code>taxes=0</code> on every receipt.
        The reconcile pipeline matches by <em>room-type alias + close date</em>,
        so when two or more guests share a room type that day, several Poster
        receipts collapse onto the same PMS room total — that's where the
        wild deltas come from. <strong>Real fix:</strong> change the upstream
        match to join on <code>cb_reservation_id</code>, not on the
        room-type-alias bucket. This drill surfaces every affected receipt so
        you can clean up manually until the pipeline is rewritten.
      </div>

      {/* Filter row */}
      <div
        style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
          marginBottom: 12, padding: 10,
          background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
          borderRadius: 6,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="t-eyebrow">Month</span>
          <select
            value={month}
            onChange={(e) => { setMonth(e.target.value); setLimit(PAGE); }}
            style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', minWidth: 130 }}
          >
            <option value="all">All months</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="t-eyebrow">Bucket</span>
          <select
            value={bucket}
            onChange={(e) => { setBucket(e.target.value as typeof bucket); setLimit(PAGE); }}
            style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', minWidth: 200 }}
          >
            <option value="all">All — no-match + amount-mismatch</option>
            <option value="no_cb_match">🔴 No PMS match</option>
            <option value="amount_mismatch">🟡 Amount differs</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 240px' }}>
          <span className="t-eyebrow">Search · client / waiter / table / receipt #</span>
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
            placeholder="e.g. River Suite, John, table 4, 12358…"
            style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', width: '100%' }}
          />
        </label>

        <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
          <div>{filtered.length.toLocaleString()} of {rows.length.toLocaleString()} receipts</div>
          <div>order ${totalOrder.toFixed(0)} · net Δ ${totalDelta.toFixed(0)}</div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Close date</th>
              <th style={{ textAlign: 'left' }}>Receipt #</th>
              <th style={{ textAlign: 'left' }}>Poster client (room alias)</th>
              <th style={{ textAlign: 'left' }}>Waiter</th>
              <th style={{ textAlign: 'left' }}>Table</th>
              <th style={{ textAlign: 'right' }}>Poster $</th>
              <th style={{ textAlign: 'right' }}>PMS $</th>
              <th style={{ textAlign: 'right' }}>Δ</th>
              <th style={{ textAlign: 'left' }}>Bucket</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const delta = Number(r.cb_match_delta || 0);
              const deltaTone = r.bucket === 'no_cb_match'
                ? 'var(--st-bad, #B23B3B)'
                : delta === 0 ? 'var(--ink-mute)' : 'var(--st-warn, #C28F2C)';
              return (
                <tr key={r.receipt_id}>
                  <td style={{ fontFamily: 'var(--mono)' }}>{r.close_date ?? '—'}</td>
                  <td>
                    <div style={{ fontFamily: 'var(--mono)' }}>{r.receipt_id}</div>
                    {r.cb_reservation_id && (
                      <div style={{ marginTop: 2 }}>
                        <CloudbedsReservationLink reservationId={r.cb_reservation_id} truncate={10} />
                      </div>
                    )}
                  </td>
                  <td>{r.poster_client ?? '—'}</td>
                  <td style={{ color: 'var(--ink-soft)' }}>{r.waiter ?? '—'}</td>
                  <td style={{ color: 'var(--ink-soft)' }}>{r.table_label ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoney(r.order_total, 'USD')}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    {r.bucket === 'no_cb_match' ? '—' : fmtMoney(r.cb_match_amount, 'USD')}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: deltaTone }}>
                    {r.bucket === 'no_cb_match'
                      ? <span title="No PMS counterpart at all — investigate whether Poster posted in error or PMS dropped the line">missing</span>
                      : <span title="Amount differs vs PMS. Likely caused by multiple guests sharing a room type on this date (the matcher collapses them).">{delta >= 0 ? '+' : ''}{fmtMoney(delta, 'USD')}</span>}
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '1px 6px', borderRadius: 3,
                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        background: r.bucket === 'no_cb_match' ? 'var(--st-bad-soft, rgba(178,59,59,0.15))' : 'var(--st-warn-soft, rgba(194,143,44,0.15))',
                        color: r.bucket === 'no_cb_match' ? 'var(--st-bad, #B23B3B)' : 'var(--st-warn, #C28F2C)',
                      }}
                    >
                      {r.bucket === 'no_cb_match' ? '🔴 no match' : '🟡 Δ amount'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 18, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
                No receipts match the current filters.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > limit && (
        <div style={{ textAlign: 'center', padding: 10 }}>
          <button
            onClick={() => setLimit(limit + PAGE)}
            className="btn"
            style={{
              padding: '6px 14px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
              background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
              borderRadius: 4, cursor: 'pointer',
            }}
          >
            Show {Math.min(PAGE, filtered.length - limit)} more · {filtered.length - limit} left
          </button>
        </div>
      )}
    </div>
  );
}
