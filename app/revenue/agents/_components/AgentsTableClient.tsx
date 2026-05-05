'use client';

import Link from 'next/link';
import DataTable from '@/components/ui/DataTable';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';

export interface AgentRow {
  agent_id: string;
  code: string;
  name: string;
  status: string | null;
  schedule_human: string | null;
  monthly_budget_usd: number | null;
  month_to_date_cost_usd: number | null;
  last_run_at: string | null;
  last_run_status: string | null;
  settings_href: string | null;
}

const STATUS_TONE: Record<string, StatusTone> = {
  active:   'active',
  beta:     'pending',
  planned:  'inactive',
  paused:   'inactive',
  inactive: 'inactive',
};
const RUN_TONE: Record<string, StatusTone> = {
  success: 'active',
  partial: 'pending',
  failed:  'expired',
  running: 'info',
};

export default function AgentsTable({ rows }: { rows: AgentRow[] }) {
  return (
    <DataTable<AgentRow>
      rows={rows}
      rowKey={(r) => r.agent_id}
      defaultSort={{ key: 'mtdCost', dir: 'desc' }}
      emptyState="No agents registered in governance.agents."
      columns={[
        {
          key: 'name',
          header: 'Agent',
          sortValue: (r) => r.name,
          render: (r) => (
            <span>
              <strong style={{ fontWeight: 600 }}>{r.name}</strong>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                {r.code}
              </div>
            </span>
          ),
        },
        {
          key: 'status',
          header: 'Status',
          align: 'center',
          sortValue: (r) => r.status ?? '',
          render: (r) => (
            <StatusPill tone={STATUS_TONE[(r.status ?? 'inactive').toLowerCase()] ?? 'inactive'}>
              {(r.status ?? 'inactive').toUpperCase()}
            </StatusPill>
          ),
        },
        {
          key: 'schedule',
          header: 'Schedule',
          sortValue: (r) => r.schedule_human ?? '',
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>{r.schedule_human ?? EMPTY}</span>
          ),
        },
        {
          key: 'lastRun',
          header: 'Last Run',
          align: 'right',
          sortValue: (r) => r.last_run_at ?? '',
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>
              {fmtIsoDate(r.last_run_at)}
            </span>
          ),
        },
        {
          key: 'lastStatus',
          header: 'Run Status',
          align: 'center',
          sortValue: (r) => r.last_run_status ?? '',
          render: (r) =>
            r.last_run_status ? (
              <StatusPill tone={RUN_TONE[r.last_run_status.toLowerCase()] ?? 'inactive'}>
                {r.last_run_status.toUpperCase()}
              </StatusPill>
            ) : (
              EMPTY
            ),
        },
        {
          key: 'mtdCost',
          header: 'MTD Cost',
          numeric: true,
          sortValue: (r) => r.month_to_date_cost_usd ?? 0,
          render: (r) => fmtTableUsd(r.month_to_date_cost_usd),
        },
        {
          key: 'budget',
          header: 'Budget',
          numeric: true,
          sortValue: (r) => r.monthly_budget_usd ?? 0,
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>{fmtTableUsd(r.monthly_budget_usd)}</span>
          ),
        },
        {
          key: 'settings',
          header: 'Settings',
          align: 'center',
          render: (r) =>
            r.settings_href ? (
              <Link
                href={r.settings_href}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)',
                  textTransform: 'uppercase',
                  color: 'var(--brass)',
                  textDecoration: 'none',
                  borderBottom: '1px dotted var(--brass)',
                }}
              >
                Open
              </Link>
            ) : (
              EMPTY
            ),
        },
      ]}
    />
  );
}
