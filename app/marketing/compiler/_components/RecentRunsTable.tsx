'use client';

// app/marketing/compiler/_components/RecentRunsTable.tsx
// Recent runs as a tight DataTable. Replaces the big card grid.

import Link from 'next/link';
import DataTable from '@/components/ui/DataTable';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtIsoDate, fmtKpi, EMPTY } from '@/lib/format';

const STATUS_TONE: Record<string, StatusTone> = {
  draft: 'pending',
  compiling: 'pending',
  ready: 'info',
  rendering: 'pending',
  deployed: 'active',
  halted: 'expired',
};

export interface RunRow {
  id: string;
  prompt: string;
  status: string;
  cost_eur: number | null;
  created_at: string;
  variants: { count: number }[] | null;
}

export default function RecentRunsTable({ rows }: { rows: RunRow[] }) {
  return (
    <DataTable<RunRow>
      rowKey={r => r.id}
      rows={rows}
      defaultSort={{ key: 'created_at', dir: 'desc' }}
      emptyState={
        <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
          No runs yet. Type a prompt above to compile your first retreat.
        </span>
      }
      columns={[
        {
          key: 'prompt',
          header: 'Prompt',
          align: 'left',
          render: r => (
            <Link href={`/marketing/compiler/${r.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                {r.prompt}
              </div>
              <div style={{ fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
                {r.id.slice(0, 8)}
              </div>
            </Link>
          ),
          sortValue: r => r.prompt.toLowerCase(),
        },
        {
          key: 'variants',
          header: 'Variants',
          align: 'right',
          numeric: true,
          width: '90px',
          render: r => {
            const c = Array.isArray(r.variants) ? (r.variants[0]?.count ?? 0) : 0;
            return c > 0 ? c : EMPTY;
          },
          sortValue: r => Array.isArray(r.variants) ? (r.variants[0]?.count ?? 0) : 0,
        },
        {
          key: 'cost_eur',
          header: 'Cost',
          align: 'right',
          numeric: true,
          width: '100px',
          render: r => fmtKpi(r.cost_eur ?? 0, 'usd'),
          sortValue: r => r.cost_eur ?? 0,
        },
        {
          key: 'status',
          header: 'Status',
          align: 'center',
          width: '120px',
          render: r => <StatusPill tone={STATUS_TONE[r.status] ?? 'info'}>{r.status}</StatusPill>,
          sortValue: r => r.status,
        },
        {
          key: 'created_at',
          header: 'Created',
          align: 'right',
          width: '130px',
          render: r => fmtIsoDate(r.created_at),
          sortValue: r => r.created_at,
        },
      ]}
    />
  );
}
