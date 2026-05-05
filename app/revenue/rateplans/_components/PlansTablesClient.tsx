// app/revenue/rateplans/_components/PlansTablesClient.tsx
//
// Client-side wrapper around the 3 DataTables on /revenue/rateplans.
// DataTable is 'use client' — function props (render, sortValue, rowKey)
// can't cross the server→client boundary, so column config + render fns
// live in this file.

'use client';

import DataTable from '@/components/ui/DataTable';
import { fmtMoney, fmtIsoDate, EMPTY } from '@/lib/format';

export interface PlanRow {
  name: string;
  type: string;
  isConfigured: boolean;
  bookings: number;
  cancellations: number;
  nights: number;
  revenue: number;
  adr: number;
  cancelPct: number;
  avgLead: number;
  lastBooked: string | null;
  mixPct: number;
}
export interface SleepingRow {
  rate_name: string;
  rate_type: string | null;
  last_booked: string | null;
  days_since: number;
}
export interface OrphanRow {
  rate_plan: string;
  bookings_lifetime: number;
  revenue_lifetime: number;
  last_booked: string | null;
}

export function PlansTable({ rows }: { rows: PlanRow[] }) {
  return (
    <DataTable<PlanRow>
      rows={rows}
      rowKey={(r) => r.name}
      defaultSort={{ key: 'revenue', dir: 'desc' }}
      emptyState="No rate plan usage in selected window."
      columns={[
        {
          key: 'name',
          header: 'Rate Plan',
          align: 'left',
          sortValue: (r) => r.name,
          render: (r) => (
            <span>
              <strong style={{ fontWeight: 600 }}>{r.name}</strong>
              {!r.isConfigured && (
                <span
                  style={{
                    marginLeft: 8,
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--t-xs)',
                    letterSpacing: 'var(--ls-extra)',
                    textTransform: 'uppercase',
                    color: 'var(--brass)',
                  }}
                >
                  ORPHAN
                </span>
              )}
            </span>
          ),
        },
        {
          key: 'type',
          header: 'Type',
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>{r.type ?? EMPTY}</span>
          ),
          sortValue: (r) => r.type ?? '',
        },
        {
          key: 'bookings',
          header: 'Bkgs',
          numeric: true,
          sortValue: (r) => r.bookings,
          render: (r) => r.bookings,
        },
        {
          key: 'nights',
          header: 'RNs',
          numeric: true,
          sortValue: (r) => r.nights,
          render: (r) => r.nights,
        },
        {
          key: 'revenue',
          header: 'Revenue',
          numeric: true,
          sortValue: (r) => r.revenue,
          render: (r) => fmtMoney(r.revenue, 'USD'),
        },
        {
          key: 'adr',
          header: 'ADR',
          numeric: true,
          sortValue: (r) => r.adr,
          render: (r) => `$${r.adr.toFixed(0)}`,
        },
        {
          key: 'mix',
          header: '% Mix',
          numeric: true,
          sortValue: (r) => r.mixPct,
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>{r.mixPct.toFixed(0)}%</span>
          ),
        },
        {
          key: 'cancel',
          header: 'Cancel %',
          numeric: true,
          sortValue: (r) => r.cancelPct,
          render: (r) => (
            <span
              style={{
                color:
                  r.cancelPct >= 40
                    ? 'var(--st-bad)'
                    : r.cancelPct >= 20
                    ? 'var(--brass)'
                    : 'inherit',
              }}
            >
              {r.cancelPct.toFixed(0)}%
            </span>
          ),
        },
        {
          key: 'lead',
          header: 'Avg Lead',
          numeric: true,
          sortValue: (r) => r.avgLead,
          render: (r) => `${r.avgLead.toFixed(0)}d`,
        },
        {
          key: 'last',
          header: 'Last Booked',
          numeric: true,
          sortValue: (r) => r.lastBooked ?? '',
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>{fmtIsoDate(r.lastBooked)}</span>
          ),
        },
      ]}
    />
  );
}

export function SleepingTable({ rows }: { rows: SleepingRow[] }) {
  return (
    <DataTable<SleepingRow>
      rows={rows}
      rowKey={(r) => r.rate_name}
      emptyState="All configured plans have a booking in the last 90 days."
      columns={[
        {
          key: 'name',
          header: 'Rate Plan',
          sortValue: (r) => r.rate_name,
          render: (r) => r.rate_name,
        },
        {
          key: 'type',
          header: 'Type',
          sortValue: (r) => r.rate_type ?? '',
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>{r.rate_type ?? EMPTY}</span>
          ),
        },
        {
          key: 'last_booked',
          header: 'Last Booked',
          numeric: true,
          sortValue: (r) => r.last_booked ?? '',
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>{r.last_booked ?? 'never'}</span>
          ),
        },
        {
          key: 'days',
          header: 'Idle',
          numeric: true,
          sortValue: (r) => r.days_since,
          render: (r) => (r.days_since >= 9999 ? '∞' : `${r.days_since}d`),
        },
      ]}
    />
  );
}

export function OrphansTable({ rows }: { rows: OrphanRow[] }) {
  return (
    <DataTable<OrphanRow>
      rows={rows}
      rowKey={(r) => r.rate_plan}
      emptyState="No orphan plans — every booked plan has a master record."
      columns={[
        {
          key: 'rate_plan',
          header: 'Rate Plan (as booked)',
          sortValue: (r) => r.rate_plan,
          render: (r) => r.rate_plan,
        },
        {
          key: 'bookings',
          header: 'Lifetime Bkgs',
          numeric: true,
          sortValue: (r) => r.bookings_lifetime,
          render: (r) => r.bookings_lifetime,
        },
        {
          key: 'revenue',
          header: 'Lifetime Rev',
          numeric: true,
          sortValue: (r) => r.revenue_lifetime,
          render: (r) => fmtMoney(r.revenue_lifetime, 'USD'),
        },
        {
          key: 'last',
          header: 'Last',
          numeric: true,
          sortValue: (r) => r.last_booked ?? '',
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>{r.last_booked ?? EMPTY}</span>
          ),
        },
      ]}
    />
  );
}
