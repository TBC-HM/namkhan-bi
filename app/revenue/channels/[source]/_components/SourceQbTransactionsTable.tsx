'use client';

// app/revenue/channels/[source]/_components/SourceQbTransactionsTable.tsx
// Wired to public.v_source_qb_transactions (gl.transactions, filtered to party_name).
// Newest first. Used on every channel landing page below the booking list.
// PBS 2026-06-30: default to 10 rows · expand toggle reveals the full list.

import { useState } from 'react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd } from '@/lib/format';

const INITIAL_LIMIT = 10;

export interface QbTxnRow {
  txn_id: number;
  txn_date: string | null;
  txn_type: string | null;
  txn_number: string | null;
  party_name: string | null;
  section_account: string | null;
  line_account: string | null;
  class: string | null;
  description: string | null;
  amount_native: number | null;
  currency_native: string | null;
  amount_usd: number | null;
}

function shortDate(s: string | null): string {
  if (!s) return '—';
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function SourceQbTransactionsTable({ rows }: { rows: QbTxnRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, INITIAL_LIMIT);
  const hidden = rows.length - visible.length;

  if (rows.length === 0) {
    return (
      <div style={{
        padding: '24px 20px',
        background: '#FFFFFF',
        border: '1px solid #E6DFCC',
        borderRadius: 6,
        textAlign: 'center',
        color: '#5A5A5A',
        fontSize: 13,
      }}>
        No QuickBooks transactions matched to this source yet.
        Match by editing the party_name in QuickBooks to align with the partner name on this contract.
      </div>
    );
  }

  const columns: Column<QbTxnRow>[] = [
    {
      key: 'txn_date',
      header: 'Date',
      sortValue: (r) => r.txn_date ?? '',
      render: (r) => <span style={{ fontFamily: 'var(--mono, monospace)' }}>{shortDate(r.txn_date)}</span>,
    },
    {
      key: 'txn_type',
      header: 'Type',
      sortValue: (r) => r.txn_type ?? '',
      render: (r) => r.txn_type ?? '—',
    },
    {
      key: 'txn_number',
      header: 'Ref #',
      sortValue: (r) => r.txn_number ?? '',
      render: (r) => <code style={{ fontFamily: 'var(--mono, monospace)', fontSize: 12 }}>{r.txn_number ?? '—'}</code>,
    },
    {
      key: 'line_account',
      header: 'Account',
      sortValue: (r) => r.line_account ?? '',
      render: (r) => r.line_account ?? '—',
    },
    {
      key: 'class',
      header: 'Class',
      sortValue: (r) => r.class ?? '',
      render: (r) => r.class ?? '—',
    },
    {
      key: 'description',
      header: 'Description',
      sortValue: (r) => r.description ?? '',
      render: (r) => (r.description ?? '').slice(0, 80),
    },
    {
      key: 'amount_usd',
      header: 'USD',
      numeric: true,
      sortValue: (r) => r.amount_usd ?? 0,
      render: (r) => (r.amount_usd != null ? fmtTableUsd(r.amount_usd) : '—'),
    },
  ];

  return (
    <div>
      <DataTable<QbTxnRow>
        columns={columns}
        rows={visible}
        rowKey={(r) => String(r.txn_id)}
        defaultSort={{ key: 'txn_date', dir: 'desc' }}
      />
      {rows.length > INITIAL_LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: '#FFFFFF',
              color: '#1B1B1B',
              border: '1px solid #E6DFCC',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {expanded
              ? `Show first ${INITIAL_LIMIT}`
              : `Show all ${rows.length} (+${hidden} hidden)`}
          </button>
        </div>
      )}
    </div>
  );
}
