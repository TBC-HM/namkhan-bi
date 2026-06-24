'use client';

// app/it/cost/page.tsx
// Marathon #195 — IT · Cost
// Data: v_it_weekly_digest (cost_usd, tickets_closed, deploys)
//       v_agent_health (per-agent call & failure counts)
// Assumptions:
//   • v_agent_cost_24h not in allowlist — using v_it_weekly_digest + v_agent_health as cost proxies
//   • cost_usd from weekly digest is the canonical AI/infra spend figure
//   • v_agent_health recent_failures / recent_calls used to derive per-agent failure cost ratio
//   • All KpiBox / DataTable / PageHeader are default exports

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DigestRow {
  cost_usd: number | null;
  tickets_closed: number | null;
  deploys_staging: number | null;
  deploys_prod: number | null;
  workers_spawned: number | null;
  emergencies_escalated: number | null;
}

interface AgentRow {
  agent_id: number;
  role: string;
  department: string;
  active: boolean;
  health_state: string;
  recent_calls: number;
  recent_failures: number;
  minutes_since_last_call: number | null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ItCostPage() {
  const [digest, setDigest] = useState<DigestRow | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [digestRes, agentRes] = await Promise.all([
        supabase.from('v_it_weekly_digest').select('*').limit(1).single(),
        supabase.from('v_agent_health').select('*').order('recent_calls', { ascending: false }).limit(50),
      ]);
      if (digestRes.data) setDigest(digestRes.data as DigestRow);
      if (agentRes.data) setAgents(agentRes.data as AgentRow[]);
      setLoading(false);
    }
    void load();
  }, []);

  const totalCost = digest?.cost_usd ?? null;
  const ticketsClosed = digest?.tickets_closed ?? null;
  const costPerTicket =
    totalCost != null && ticketsClosed != null && ticketsClosed > 0
      ? (totalCost / ticketsClosed).toFixed(2)
      : null;
  const totalCalls = agents.reduce((s, a) => s + (a.recent_calls ?? 0), 0);
  const totalFailures = agents.reduce((s, a) => s + (a.recent_failures ?? 0), 0);
  const failureRate =
    totalCalls > 0 ? ((totalFailures / totalCalls) * 100).toFixed(1) : '—';

  const columns: { key: keyof AgentRow | string; header: string }[] = [
    { key: 'role', header: 'Agent Role' },
    { key: 'department', header: 'Dept' },
    { key: 'health_state', header: 'Health' },
    { key: 'recent_calls', header: 'Calls (recent)' },
    { key: 'recent_failures', header: 'Failures' },
    { key: 'failure_rate_pct', header: 'Failure %' },
    { key: 'minutes_since_last_call', header: 'Idle (min)' },
  ];

  const tableRows = agents.map((a) => ({
    ...a,
    failure_rate_pct:
      a.recent_calls > 0
        ? `${((a.recent_failures / a.recent_calls) * 100).toFixed(1)}%`
        : '—',
    minutes_since_last_call:
      a.minutes_since_last_call != null
        ? `${a.minutes_since_last_call.toFixed(0)}`
        : '—',
  }));

  return (
    <main style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
      <PageHeader pillar="IT" tab="Cost" title="IT Cost & Agent Efficiency" />

      {loading ? (
        <p style={{ color: '#6b7280', marginTop: 24 }}>Loading cost data…</p>
      ) : (
        <>
          {/* ── KPI Strip ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginTop: 24,
              marginBottom: 32,
            }}
          >
            <KpiBox
              label="AI / Infra Spend (week)"
              value={totalCost != null ? `$${totalCost.toFixed(2)}` : '—'}
            />
            <KpiBox
              label="Tickets Closed"
              value={ticketsClosed != null ? String(ticketsClosed) : '—'}
            />
            <KpiBox
              label="Cost / Ticket"
              value={costPerTicket != null ? `$${costPerTicket}` : '—'}
            />
            <KpiBox
              label="Total Agent Calls"
              value={totalCalls > 0 ? String(totalCalls) : '—'}
            />
            <KpiBox
              label="Failure Rate"
              value={`${failureRate}%`}
            />
            <KpiBox
              label="Staging Deploys"
              value={digest?.deploys_staging != null ? String(digest.deploys_staging) : '—'}
            />
            <KpiBox
              label="Prod Deploys"
              value={digest?.deploys_prod != null ? String(digest.deploys_prod) : '—'}
            />
            <KpiBox
              label="Workers Spawned"
              value={digest?.workers_spawned != null ? String(digest.workers_spawned) : '—'}
            />
          </div>

          {/* ── Per-Agent Cost Breakdown ── */}
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#111827' }}>
            Per-Agent Activity &amp; Failure Breakdown
          </h2>
          <DataTable
            columns={columns}
            rows={tableRows}
          />

          <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
            Source: <code>v_it_weekly_digest</code> · <code>v_agent_health</code> ·
            Spend figure is weekly AI + infra total. Calls &amp; failures are rolling 24-hour window.
          </p>
        </>
      )}
    </main>
  );
}
