'use client';

// app/finance/ledger/_components/LedgerDrawerHost.tsx
//
// Two client sections, each wrapping its own table + the shared GuestDrawer.
// PBS-locked 2026-05-15: row click on a name → drawer slides in from the
// right with contact info + "Send reminder" + "Verify (fc@thenamkhan.com)".

import { useState } from 'react';
import AgedArTable, { type AgedRow as AgedRowBase } from './AgedArTableClient';
import GuestDrawer, { type GuestSubject } from './GuestDrawer';
import StatusPill from '@/components/ui/StatusPill';
import { fmtMoney } from '@/lib/format';

export interface AgedRowWithContact extends AgedRowBase {
  guest_email: string | null;
  guest_phone: string | null;
}

export interface HouseAccountRow {
  house_account_id: string;
  account_name: string | null;
  account_type: string | null;
  balance: number | null;
  is_active: boolean | null;
  synced_at: string | null;
}

// ── Aged AR section ─────────────────────────────────────────────────
export function AgedArSection({ rows }: { rows: AgedRowWithContact[] }) {
  const [subject, setSubject] = useState<GuestSubject | null>(null);
  return (
    <>
      <AgedArTable
        rows={rows}
        onRowClick={(r) => setSubject({
          kind: 'guest',
          display_name: r.guest_name ?? '(no name)',
          reservation_id: r.reservation_id,
          guest_email: r.guest_email,
          guest_phone: r.guest_phone,
          source_name: r.source_name,
          check_out_date: r.check_out_date,
          open_balance: r.open_balance,
          days_overdue: r.days_overdue,
          bucket: r.bucket,
        })}
      />
      <GuestDrawer subject={subject} onClose={() => setSubject(null)} />
    </>
  );
}

// ── City ledger section ─────────────────────────────────────────────
export function CityLedgerSection({ rows }: { rows: HouseAccountRow[] }) {
  const [subject, setSubject] = useState<GuestSubject | null>(null);
  if (rows.length === 0) {
    return (
      <div style={{ padding: 20, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
        No active house accounts.
      </div>
    );
  }
  return (
    <>
      <table className="tbl" style={{ width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            <th>Account</th>
            <th>Type</th>
            <th>Status</th>
            <th className="num">Balance</th>
            <th>Last sync</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.house_account_id}>
              <td className="lbl">
                <button
                  onClick={() => setSubject({
                    kind: 'house_account',
                    display_name: a.account_name ?? '(unnamed account)',
                    account_id: a.house_account_id,
                    account_type: a.account_type,
                    open_balance: a.balance,
                    guest_email: null,
                    guest_phone: null,
                  })}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', fontSize: 'inherit',
                    color: 'var(--brass)', textDecoration: 'underline',
                    fontWeight: 600,
                  }}
                >
                  {a.account_name || '—'}
                </button>
              </td>
              <td className="lbl text-mute">{a.account_type || '—'}</td>
              <td>
                <StatusPill tone={a.is_active ? 'active' : 'inactive'}>
                  {a.is_active ? 'active' : 'inactive'}
                </StatusPill>
              </td>
              <td className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {a.balance == null ? '—' : fmtMoney(Number(a.balance), 'USD')}
              </td>
              <td className="lbl text-mute">
                {a.synced_at ? new Date(a.synced_at).toISOString().slice(0, 10) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <GuestDrawer subject={subject} onClose={() => setSubject(null)} />
    </>
  );
}
