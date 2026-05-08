'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type LogRow = {
  id: number;
  created_at: string;
  agent: string | null;
  action: string | null;
  target: string | null;
  ticket_id: number | null;
  success: boolean | null;
  reasoning: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd_milli: number | null;
  duration_ms: number | null;
};

export default function ItLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('cockpit_audit_log')
        .select(
          'id, created_at, agent, action, target, ticket_id, success, reasoning, input_tokens, output_tokens, cost_usd_milli, duration_ms'
        )
        .order('created_at', { ascending: false })
        .limit(100);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const totalCostUsd =
    rows.reduce((acc, r) => acc + (r.cost_usd_milli ?? 0), 0) / 1000;
  const successCount = rows.filter((r) => r.success === true).length;
  const failCount = rows.filter((r) => r.success === false).length;
  const avgDurationMs =
    rows.length > 0
      ? rows.reduce((acc, r) => acc + (r.duration_ms ?? 0), 0) / rows.length
      : 0;

  const columns: { key: keyof LogRow | 'status_pill'; header: string }[] = [
    { key: 'created_at', header: 'Timestamp' },
    { key: 'agent', header: 'Agent' },
    { key: 'action', header: 'Action' },
    { key: 'target', header: 'Target' },
    { key: 'ticket_id', header: 'Ticket' },
    { key: 'status_pill', header: 'Status' },
    { key: 'input_tokens', header: 'In Tokens' },
    { key: 'output_tokens', header: 'Out Tokens' },
    { key: 'cost_usd_milli', header: 'Cost (m¢)' },
    { key: 'duration_ms', header: 'Duration (ms)' },
    { key: 'reasoning', header: 'Reasoning' },
  ];

  const tableRows = rows.map((r) => ({
    ...r,
    created_at: r.created_at
      ? new Date(r.created_at).toLocaleString('en-GB', {
          dateStyle: 'short',
          timeStyle: 'medium',
        })
      : '—',
    agent: r.agent ?? '—',
    action: r.action ?? '—',
    target: r.target ?? '—',
    ticket_id: r.ticket_id != null ? String(r.ticket_id) : '—',
    status_pill: (
      <StatusPill
        status={r.success === true ? 'ok' : r.success === false ? 'error' : 'unknown'}
        label={r.success === true ? 'OK' : r.success === false ? 'Error' : '—'}
      />
    ),
    input_tokens: r.input_tokens != null ? r.input_tokens.toLocaleString() : '—',
    output_tokens: r.output_tokens != null ? r.output_tokens.toLocaleString() : '—',
    cost_usd_milli: r.cost_usd_milli != null ? r.cost_usd_milli.toFixed(1) : '—',
    duration_ms: r.duration_ms != null ? r.duration_ms.toLocaleString() : '—',
    reasoning: r.reasoning ? r.reasoning.slice(0, 120) + (r.reasoning.length > 120 ? '…' : '') : '—',
  }));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="IT" tab="Logs" title="Audit Logs" />

      {loading ? (
        <p style={{ color: 'var(--color-muted, #888)', marginTop: 24 }}>Loading…</p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              marginTop: 24,
              marginBottom: 32,
            }}
          >
            <KpiBox
              label="Total Events"
              value={rows.length.toLocaleString()}
            />
            <KpiBox
              label="Success"
              value={successCount.toLocaleString()}
            />
            <KpiBox
              label="Errors"
              value={failCount.toLocaleString()}
            />
            <KpiBox
              label="Total Cost"
              value={`$${totalCostUsd.toFixed(3)}`}
            />
            <KpiBox
              label="Avg Duration"
              value={avgDurationMs > 0 ? `${Math.round(avgDurationMs).toLocaleString()} ms` : '—'}
            />
          </div>

          <DataTable
            columns={columns.map((c) => ({ key: c.key, header: c.header }))}
            rows={tableRows}
          />
        </>
      )}
    </main>
  );
}
