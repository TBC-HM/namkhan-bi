// app/revenue/compset/_components/AgentRunHistoryTable.tsx
// Last 10 agent runs across compset_agent + comp_discovery_agent.

'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';
import type { AgentRunSummaryRow } from './types';

const STATUS_TONE: Record<string, StatusTone> = {
  success: 'active',
  partial: 'pending',
  failed: 'expired',
  running: 'info',
};

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return EMPTY;
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function fmtStarted(iso: string | null): string {
  if (!iso) return EMPTY;
  // YYYY-MM-DD HH:MM (UTC truncated)
  const date = fmtIsoDate(iso);
  const time = iso.length >= 16 ? iso.slice(11, 16) : '';
  return time ? `${date} ${time}` : date;
}

interface Props {
  rows: AgentRunSummaryRow[];
}

export default function AgentRunHistoryTable({ rows }: Props) {
  const columns: Column<AgentRunSummaryRow>[] = [
    {
      key: 'started_at',
      header: 'STARTED',
      sortValue: (r) => r.started_at ?? '',
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            color: 'var(--ink-soft)',
          }}
        >
          {fmtStarted(r.started_at)}
        </span>
      ),
    },
    {
      key: 'agent',
      header: 'AGENT',
      sortValue: (r) => r.agent_code,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            color: 'var(--ink-soft)',
          }}
        >
          {r.agent_code}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      align: 'center',
      sortValue: (r) => r.status ?? '',
      render: (r) => {
        const status = (r.status ?? 'running').toLowerCase();
        const tone: StatusTone = STATUS_TONE[status] ?? 'inactive';
        return <StatusPill tone={tone}>{status.toUpperCase()}</StatusPill>;
      },
    },
    {
      key: 'duration',
      header: 'DURATION',
      numeric: true,
      sortValue: (r) => Number(r.duration_ms ?? 0),
      render: (r) => fmtDuration(r.duration_ms),
    },
    {
      key: 'cost',
      header: 'COST',
      numeric: true,
      sortValue: (r) => Number(r.cost_usd ?? 0),
      render: (r) => fmtTableUsd(r.cost_usd),
    },
    {
      key: 'obs',
      header: 'OBS',
      numeric: true,
      sortValue: (r) => Number(r.proposals_created ?? 0),
      render: (r) => r.proposals_created ?? EMPTY,
    },
    {
      key: 'trigger',
      header: 'TRIGGER',
      render: (r) =>
        r.minutes_ago != null ? (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              color: 'var(--ink-mute)',
            }}
          >
            {Math.round(r.minutes_ago)}m ago
          </span>
        ) : (
          EMPTY
        ),
    },
    {
      key: 'run_id',
      header: 'RUN ID',
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            color: 'var(--ink-faint)',
          }}
        >
          {r.run_id.slice(0, 8)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.run_id}
      defaultSort={{ key: 'started_at', dir: 'desc' }}
      emptyState={
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
            No agent runs yet.
          </div>
          <div style={{ color: 'var(--ink-faint)', fontSize: 'var(--t-xs)' }}>
            Trigger a run to start logging history.
          </div>
        </div>
      }
    />
  );
}
