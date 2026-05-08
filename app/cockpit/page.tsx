'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';

// Lazy-load heavy tab panels (code-split, ssr:false — not default tab)
const ActivityTab = dynamic(() => import('@/components/cockpit/ActivityTab'), { ssr: false });
const LogsTab = dynamic(() => import('@/components/cockpit/LogsTab'), { ssr: false });
const ScheduleTab = dynamic(() => import('@/components/cockpit/ScheduleTab'), { ssr: false });
const CostTab = dynamic(() => import('@/components/cockpit/CostTab'), { ssr: false });
const ToolsTab = dynamic(() => import('@/components/cockpit/ToolsTab'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────
interface Ticket {
  id: number;
  status: string;
  arm: string;
  parsed_summary: string;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: number;
  created_at: string;
  agent: string;
  action: string;
  success: boolean;
  summary: string;
}

interface AgentRow {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface CostRow {
  id: number;
  created_at: string;
  cost_usd: number;
  agent: string;
  model: string;
}

// ─── Data fetcher — named columns only (perf #229: eliminates SELECT *) ───────
async function fetchCockpitData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [ticketsRes, auditRes, agentsRes, costRes] = await Promise.all([
    supabase
      .from('cockpit_tickets')
      .select('id, status, arm, parsed_summary, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('cockpit_audit_log')
      .select('id, created_at, agent, action, success, summary')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('cockpit_agent_identity')
      .select('id, name, role, status')
      .limit(50),
    supabase
      .from('cockpit_cost_log')
      .select('id, created_at, cost_usd, agent, model')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return {
    tickets: (ticketsRes.data ?? []) as Ticket[],
    audit: (auditRes.data ?? []) as AuditRow[],
    agents: (agentsRes.data ?? []) as AgentRow[],
    cost: (costRes.data ?? []) as CostRow[],
  };
}

// ─── KPI helpers ──────────────────────────────────────────────────────────────
function totalCost(rows: CostRow[]): string {
  if (!rows.length) return '—';
  const sum = rows.reduce((acc, r) => acc + (r.cost_usd ?? 0), 0);
  return `$${sum.toFixed(2)}`;
}

function openTicketCount(tickets: Ticket[]): number {
  return tickets.filter((t) => t.status !== 'completed' && t.status !== 'closed').length;
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type TabKey = 'overview' | 'activity' | 'logs' | 'schedule' | 'cost' | 'tools';

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CockpitPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [cost, setCost] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchCockpitData().then((d) => {
      setTickets(d.tickets);
      setAudit(d.audit);
      setAgents(d.agents);
      setCost(d.cost);
      setLoading(false);
    });
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'activity', label: 'Activity' },
    { key: 'logs', label: 'Logs' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'cost', label: 'Cost' },
    { key: 'tools', label: 'Tools' },
  ];

  return (
    <main style={{ background: 'var(--surface-base, #0a0a0a)', minHeight: '100vh', padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'var(--t-2xl, 1.5rem)', color: 'var(--brass, #c9a96e)', margin: 0 }}>
          Cockpit
        </h1>
        <p style={{ color: 'var(--text-muted, #888)', marginTop: 4 }}>Agent operations centre</p>
      </div>

      {/* KPI strip */}
      {loading ? (
        <div style={{ color: 'var(--text-muted, #888)', marginBottom: 24 }}>Loading…</div>
      ) : (
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}
        >
          {[
            { label: 'Open Tickets', value: String(openTicketCount(tickets)) },
            { label: 'Agents', value: String(agents.length) },
            { label: 'Audit Events', value: String(audit.length) },
            { label: 'Cost (last 50)', value: totalCost(cost) },
          ].map((kpi) => (
            <div
              key={kpi.label}
              style={{
                background: 'var(--surface-card, #141414)',
                border: '1px solid var(--border, #222)',
                borderRadius: 8,
                padding: '16px 20px',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', marginBottom: 4 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: '1.5rem', color: 'var(--brass, #c9a96e)', fontWeight: 600 }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          borderBottom: '1px solid var(--border, #222)',
          paddingBottom: 8,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: tab === t.key ? 'var(--brass, #c9a96e)' : 'transparent',
              color: tab === t.key ? '#000' : 'var(--text-muted, #888)',
              border: 'none',
              borderRadius: 4,
              padding: '6px 14px',
              cursor: 'pointer',
              fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === 'overview' && !loading && (
        <div>
          {/* Tickets table */}
          <h2 style={{ color: 'var(--text-primary, #fff)', fontSize: '1rem', marginBottom: 12 }}>
            Recent Tickets
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border, #222)', color: 'var(--text-muted, #888)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Arm</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Summary</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border, #222)', color: 'var(--text-primary, #eee)' }}>
                  <td style={{ padding: '6px 8px' }}>{t.id}</td>
                  <td style={{ padding: '6px 8px' }}>{t.arm ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{t.status ?? '—'}</td>
                  <td style={{ padding: '6px 8px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.parsed_summary?.slice(0, 80) ?? '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>{t.updated_at?.slice(0, 10) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Audit log preview */}
          <h2 style={{ color: 'var(--text-primary, #fff)', fontSize: '1rem', marginBottom: 12, marginTop: 32 }}>
            Recent Audit Events
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border, #222)', color: 'var(--text-muted, #888)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Time</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Agent</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Action</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>OK</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--border, #222)', color: 'var(--text-primary, #eee)' }}>
                  <td style={{ padding: '6px 8px' }}>{a.created_at?.slice(0, 16) ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{a.agent ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{a.action ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{a.success ? '✓' : '✗'}</td>
                  <td style={{ padding: '6px 8px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.summary?.slice(0, 80) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'activity' && <ActivityTab />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'cost' && <CostTab />}
      {tab === 'tools' && <ToolsTab />}
    </main>
  );
}
