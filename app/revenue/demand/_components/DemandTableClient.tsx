'use client';

import DataTable from '@/components/ui/DataTable';
import { fmtMoney } from '@/lib/format';

export interface DemandRow {
  ci_month: string;
  otb_roomnights: number;
  stly_roomnights: number;
  roomnights_delta: number;
  otb_revenue: number;
  stly_revenue: number;
  revenue_delta: number;
}

export default function DemandTable({ rows }: { rows: DemandRow[] }) {
  return (
    <DataTable<DemandRow>
      rows={rows}
      rowKey={(r) => r.ci_month}
      defaultSort={{ key: 'month', dir: 'asc' }}
      emptyState="No pace rows in selected window."
      columns={[
        {
          key: 'month',
          header: 'Month',
          sortValue: (r) => r.ci_month,
          render: (r) => <strong style={{ fontWeight: 600 }}>{String(r.ci_month).slice(0, 7)}</strong>,
        },
        {
          key: 'otbRn',
          header: 'OTB Rn',
          numeric: true,
          sortValue: (r) => r.otb_roomnights,
          render: (r) => r.otb_roomnights,
        },
        {
          key: 'stlyRn',
          header: 'STLY Rn',
          numeric: true,
          sortValue: (r) => r.stly_roomnights,
          render: (r) => <span style={{ color: 'var(--ink-mute)' }}>{r.stly_roomnights}</span>,
        },
        {
          key: 'dRn',
          header: 'Δ Rn',
          numeric: true,
          sortValue: (r) => r.roomnights_delta,
          render: (r) => {
            const d = r.roomnights_delta;
            const color = d >= 0 ? 'var(--moss-glow)' : 'var(--st-bad)';
            return <span style={{ color, fontWeight: 600 }}>{d >= 0 ? '+' : ''}{d}</span>;
          },
        },
        {
          key: 'otbRev',
          header: 'OTB Rev',
          numeric: true,
          sortValue: (r) => r.otb_revenue,
          render: (r) => fmtMoney(r.otb_revenue, 'USD'),
        },
        {
          key: 'stlyRev',
          header: 'STLY Rev',
          numeric: true,
          sortValue: (r) => r.stly_revenue,
          render: (r) => <span style={{ color: 'var(--ink-mute)' }}>{fmtMoney(r.stly_revenue, 'USD')}</span>,
        },
        {
          key: 'dRev',
          header: 'Δ Rev',
          numeric: true,
          sortValue: (r) => r.revenue_delta,
          render: (r) => {
            const d = r.revenue_delta;
            const color = d >= 0 ? 'var(--moss-glow)' : 'var(--st-bad)';
            return (
              <span style={{ color, fontWeight: 600 }}>
                {d >= 0 ? '+' : ''}{fmtMoney(d, 'USD')}
              </span>
            );
          },
        },
      ]}
    />
  );
}
