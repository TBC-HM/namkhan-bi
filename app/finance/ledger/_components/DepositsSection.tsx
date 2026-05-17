'use client';

// app/finance/ledger/_components/DepositsSection.tsx
// Deposits-pipeline table with the same drawer pattern as Aged AR.

import { useMemo, useState } from 'react';
import GuestDrawer, { type GuestSubject } from './GuestDrawer';
import { fmtMoney } from '@/lib/format';
import type { DepositRow } from '@/lib/data-deposits';
import CloudbedsReservationLink from '@/components/cloudbeds/CloudbedsReservationLink';

const PAGE = 50;

export default function DepositsSection({ rows }: { rows: DepositRow[] }) {
  const [subject, setSubject] = useState<GuestSubject | null>(null);
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<'all' | 'overdue' | 'arriving_7d' | 'arriving_30d' | 'no_deposit'>('all');
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (bucket === 'overdue' && !(Number(r.balance) > 0 && (r.days_until_arrival ?? 999) <= 7)) return false;
      if (bucket === 'arriving_7d'  && (r.days_until_arrival ?? 999) > 7)  return false;
      if (bucket === 'arriving_30d' && (r.days_until_arrival ?? 999) > 30) return false;
      if (bucket === 'no_deposit'   && Number(r.paid_amount) !== 0)        return false;
      if (needle) {
        const hay = [
          r.guest_name ?? '',
          r.source_name ?? '',
          r.reservation_id,
          r.guest_email ?? '',
          r.guest_phone ?? '',
        ].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, bucket]);

  const visible = filtered.slice(0, limit);
  const sumPaid = filtered.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
  const sumDue  = filtered.reduce((s, r) => s + Number(r.balance || 0), 0);

  return (
    <>
      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
        marginBottom: 12, padding: 10,
        background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
        borderRadius: 6,
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="t-eyebrow">Bucket</span>
          <select
            value={bucket}
            onChange={(e) => { setBucket(e.target.value as typeof bucket); setLimit(PAGE); }}
            style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', minWidth: 200 }}
          >
            <option value="all">All — {rows.length}</option>
            <option value="overdue">🔴 Overdue · arrive ≤7d with balance &gt; 0</option>
            <option value="arriving_7d">Arriving ≤7d</option>
            <option value="arriving_30d">Arriving ≤30d</option>
            <option value="no_deposit">No deposit yet</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 240px' }}>
          <span className="t-eyebrow">Search · guest / source / reservation / email / phone</span>
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
            placeholder="e.g. Mary, booking.com, 5043..."
            style={{ padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: 4, font: 'inherit', width: '100%' }}
          />
        </label>
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
          <div>{filtered.length.toLocaleString()} of {rows.length.toLocaleString()} bookings</div>
          <div>held {fmtMoney(sumPaid, 'USD')} · due {fmtMoney(sumDue, 'USD')}</div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ width: '100%', fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Guest</th>
              <th style={{ textAlign: 'left' }}>Reservation #</th>
              <th style={{ textAlign: 'left' }}>Check-in</th>
              <th style={{ textAlign: 'right' }}>LOS</th>
              <th style={{ textAlign: 'right' }}>ADR</th>
              <th style={{ textAlign: 'left' }}>Rate plan</th>
              <th style={{ textAlign: 'right' }}>Days to arrive</th>
              <th style={{ textAlign: 'right' }}>Paid</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th style={{ textAlign: 'left' }}>Email</th>
              <th style={{ textAlign: 'left' }}>Phone</th>
              <th style={{ textAlign: 'left' }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const days = r.days_until_arrival ?? 0;
              const overdue = Number(r.balance) > 0 && days <= 7;
              return (
                <tr key={r.reservation_id}>
                  <td>
                    <button
                      onClick={() => setSubject({
                        kind: 'guest',
                        display_name: r.guest_name ?? '(no name)',
                        reservation_id: r.reservation_id,
                        guest_email: r.guest_email,
                        guest_phone: r.guest_phone,
                        source_name: r.source_name,
                        check_in_date: r.check_in_date,
                        check_out_date: r.check_out_date,
                        open_balance: r.balance,
                        days_overdue: -days,
                        bucket: 'pre_stay_deposit',
                      })}
                      style={{
                        background: 'none', border: 'none', padding: 0,
                        cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600,
                        color: 'var(--brass)', textDecoration: 'underline',
                      }}
                    >
                      {r.guest_name || '—'}
                    </button>
                  </td>
                  <td><CloudbedsReservationLink reservationId={r.reservation_id} /></td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{r.check_in_date ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    {r.nights ?? '—'}{r.nights ? 'n' : ''}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }} title={r.booking_total_usd != null ? `Booking total ${fmtMoney(r.booking_total_usd, 'USD')}` : undefined}>
                    {r.adr_usd != null ? fmtMoney(r.adr_usd, 'USD') : '—'}
                  </td>
                  <td style={{ color: 'var(--ink-soft)', maxWidth: 200, fontSize: 'var(--t-xs)' }}>
                    {r.rate_plan_name ?? <span style={{ color: 'var(--ink-mute)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: overdue ? 'var(--st-bad, #B23B3B)' : 'var(--ink)' }}>
                    {days}d
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoney(r.paid_amount, 'USD')}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: Number(r.balance) > 0 ? 'var(--st-warn, #C28F2C)' : 'var(--ink)' }}>
                    {fmtMoney(r.balance, 'USD')}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
                    {r.guest_email
                      ? <a href={`mailto:${r.guest_email}`} style={{ color: 'var(--brass)' }}>{r.guest_email}</a>
                      : <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>—</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
                    {r.guest_phone
                      ? <a href={`tel:${r.guest_phone}`} style={{ color: 'var(--brass)' }}>{r.guest_phone}</a>
                      : <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--ink-soft)' }}>{r.source_name ?? '—'}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={12} style={{ padding: 18, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
                No deposits match the current filters.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > limit && (
        <div style={{ textAlign: 'center', padding: 10 }}>
          <button onClick={() => setLimit(limit + PAGE)} style={{
            padding: '6px 14px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
            borderRadius: 4, cursor: 'pointer',
          }}>
            Show {Math.min(PAGE, filtered.length - limit)} more · {filtered.length - limit} left
          </button>
        </div>
      )}

      <GuestDrawer subject={subject} onClose={() => setSubject(null)} />
    </>
  );
}
