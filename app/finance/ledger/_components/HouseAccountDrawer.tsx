'use client';

// app/finance/ledger/_components/HouseAccountDrawer.tsx
//
// Slides in from the right when a row in the House Accounts walk-in table is
// clicked. Fetches Poster POS receipts closed on the same calendar day from
// /api/finance/house-account-receipts and renders them.

import { useEffect, useState } from 'react';
import { fmtMoney } from '@/lib/format';
import CloudbedsReservationLink from '@/components/cloudbeds/CloudbedsReservationLink';

interface PosReceipt {
  receipt_id: number;
  open_at: string | null;
  close_at: string | null;
  table_label: string | null;
  waiter: string | null;
  client: string | null;
  payment_method: string | null;
  order_total: number;
  paid: number;
  cash: number;
  card: number;
  cb_reservation_id: string | null;
  customers_count: number | null;
}

export interface HouseAccountSubject {
  house_account_id: string;
  account_name: string;
  date: string;            // YYYY-MM-DD
  receipts_n: number;
  order_usd: number;
  cash_usd: number;
  card_usd: number;
  top_method: string | null;
}

export default function HouseAccountDrawer({
  subject, onClose, propertyId,
}: {
  subject: HouseAccountSubject | null;
  onClose: () => void;
  propertyId: number;
}) {
  const [rows, setRows]   = useState<PosReceipt[] | null>(null);
  const [err, setErr]     = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);

  // Close on ESC
  useEffect(() => {
    if (!subject) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [subject, onClose]);

  // Fetch receipts when a subject is set
  useEffect(() => {
    if (!subject) { setRows(null); setErr(null); return; }
    setBusy(true); setErr(null); setRows(null);
    fetch(`/api/finance/house-account-receipts?date=${subject.date}&property_id=${propertyId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<{ receipts: PosReceipt[] }>;
      })
      .then((j) => setRows(j.receipts))
      .catch((e) => setErr(String(e?.message || e)))
      .finally(() => setBusy(false));
  }, [subject, propertyId]);

  if (!subject) return null;

  // Roll-up by payment method for the drawer header
  const methodTotals: Record<string, { n: number; usd: number }> = {};
  for (const r of rows ?? []) {
    const m = r.payment_method ?? '—';
    if (!methodTotals[m]) methodTotals[m] = { n: 0, usd: 0 };
    methodTotals[m].n += 1;
    methodTotals[m].usd += Number(r.order_total ?? 0);
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50 }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(640px, 95vw)',
          background: 'var(--paper-warm)',
          borderLeft: '1px solid var(--paper-deep)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
          zIndex: 51,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--paper-deep)',
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
              color: 'var(--brass)', fontWeight: 700,
            }}>
              House account · POS drilldown
            </div>
            <h3 style={{ margin: '4px 0 0', fontFamily: 'var(--serif)', fontSize: 'var(--t-lg)', fontWeight: 500 }}>
              {subject.account_name}
            </h3>
            <div style={{ marginTop: 2, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
              {subject.date} · ID {subject.house_account_id} · {subject.receipts_n} matched receipt{subject.receipts_n === 1 ? '' : 's'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--ink-mute)' }}
          >×</button>
        </div>

        {/* Summary block */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--paper-deep)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <KV label="Order $"  value={fmtMoney(subject.order_usd, 'USD')} highlight />
            <KV label="Cash"     value={fmtMoney(subject.cash_usd,  'USD')} />
            <KV label="Card"     value={fmtMoney(subject.card_usd,  'USD')} />
          </div>
          {Object.keys(methodTotals).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                color: 'var(--ink-mute)', marginBottom: 4,
              }}>
                Per payment method (today)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 'var(--t-xs)' }}>
                {Object.entries(methodTotals)
                  .sort(([, a], [, b]) => b.usd - a.usd)
                  .map(([m, t]) => (
                    <span key={m} style={{
                      padding: '2px 8px', borderRadius: 3,
                      background: 'var(--paper)', border: '1px solid var(--paper-deep)',
                      fontFamily: 'var(--mono)',
                    }}>
                      {m} · {t.n} · {fmtMoney(t.usd, 'USD')}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Receipts list */}
        <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
          {busy && <div style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>Loading receipts…</div>}
          {err  && <div style={{ color: 'var(--st-bad, #B23B3B)' }}>Error: {err}</div>}
          {rows && rows.length === 0 && (
            <div style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              No Poster receipts closed on this date.
            </div>
          )}
          {rows && rows.length > 0 && (
            <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-xs)' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Time</th>
                  <th style={{ textAlign: 'left' }}>Method</th>
                  <th style={{ textAlign: 'right' }}>Order</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'left' }}>Waiter</th>
                  <th style={{ textAlign: 'left' }}>Table</th>
                  <th style={{ textAlign: 'left' }}>Resv</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.receipt_id}>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>
                      {r.close_at ? r.close_at.slice(11, 16) : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{r.payment_method ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {fmtMoney(Number(r.order_total) || 0, 'USD')}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {fmtMoney(Number(r.paid) || 0, 'USD')}
                    </td>
                    <td style={{ color: 'var(--ink-soft)' }}>{r.waiter ?? '—'}</td>
                    <td style={{ color: 'var(--ink-soft)' }}>{r.table_label ?? '—'}</td>
                    <td>
                      {r.cb_reservation_id
                        ? <CloudbedsReservationLink reservationId={r.cb_reservation_id} truncate={10} />
                        : <span style={{ color: 'var(--ink-mute)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </aside>
    </>
  );
}

function KV({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
        color: 'var(--ink-mute)',
      }}>{label}</div>
      <div style={{
        fontSize: highlight ? 'var(--t-md)' : 'var(--t-sm)',
        fontWeight: highlight ? 600 : 400,
        fontFamily: 'var(--mono)',
        color: highlight ? 'var(--brass)' : 'var(--ink)',
        marginTop: 2,
      }}>{value}</div>
    </div>
  );
}
