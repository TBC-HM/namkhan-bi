'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Cockpit page — tab navigation
// Ticket note: "costtab before tools can be deleted" → removed the Cost tab
// Remaining tabs: Overview | Agents | Tickets | Docs | Logs
// ---------------------------------------------------------------------------

const TABS = ['overview', 'agents', 'tickets', 'docs', 'logs'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  agents:   'Agents',
  tickets:  'Tickets',
  docs:     'Docs',
  logs:     'Logs',
};

// ── sub-components (inline stubs — each wired to its own file separately) ──

function OverviewPanel() {
  return (
    <section style={{ padding: '24px 0' }}>
      <p style={{ color: '#6b7280' }}>System overview — KPIs and health.</p>
    </section>
  );
}

function AgentsPanel() {
  return (
    <section style={{ padding: '24px 0' }}>
      <p style={{ color: '#6b7280' }}>Agent roster and status.</p>
    </section>
  );
}

function TicketsPanel() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase
      .from('cockpit_tickets')
      .select('id, arm, intent, status, parsed_summary, created_at')
      .order('id', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p style={{ padding: 24, color: '#6b7280' }}>Loading…</p>;

  return (
    <section style={{ overflowX: 'auto', padding: '16px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            {['ID', 'Arm', 'Intent', 'Status', 'Summary', 'Created'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id)} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '8px 12px', color: '#084838', fontWeight: 600 }}>{String(r.id)}</td>
              <td style={{ padding: '8px 12px' }}>{String(r.arm ?? '—')}</td>
              <td style={{ padding: '8px 12px' }}>{String(r.intent ?? '—')}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{
                  background: r.status === 'completed' ? '#d1fae5' : r.status === 'triaged' ? '#dbeafe' : '#f3f4f6',
                  color:      r.status === 'completed' ? '#065f46' : r.status === 'triaged' ? '#1e40af' : '#374151',
                  borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500,
                }}>
                  {String(r.status ?? '—')}
                </span>
              </td>
              <td style={{ padding: '8px 12px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(r.parsed_summary ?? '—').slice(0, 120)}
              </td>
              <td style={{ padding: '8px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                {r.created_at ? new Date(String(r.created_at)).toISOString().slice(0, 10) : '—'}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>No tickets found.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function DocsPanel() {
  return (
    <section style={{ padding: '24px 0' }}>
      <p style={{ color: '#6b7280' }}>Documentation — live, staging, audit, backup status.</p>
    </section>
  );
}

function LogsPanel() {
  return (
    <section style={{ padding: '24px 0' }}>
      <p style={{ color: '#6b7280' }}>Audit logs and system events.</p>
    </section>
  );
}

// ── main page ──────────────────────────────────────────────────────────────

export default function CockpitPage() {
  const [tab, setTab] = useState<Tab>('overview');

  const panelMap: Record<Tab, React.ReactNode> = {
    overview: <OverviewPanel />,
    agents:   <AgentsPanel />,
    tickets:  <TicketsPanel />,
    docs:     <DocsPanel />,
    logs:     <LogsPanel />,
  };

  return (
    <main style={{ fontFamily: 'Inter, sans-serif', maxWidth: 1280, margin: '0 auto', padding: '0 24px 48px' }}>
      {/* ── header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0 8px' }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#084838' }}>🛠 Cockpit</span>
        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 4 }}>Namkhan BI · Internal control panel</span>
      </div>

      {/* ── tab bar — Cost tab REMOVED per ticket ── */}
      <nav style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: t === tab ? '2px solid #084838' : '2px solid transparent',
              color: t === tab ? '#084838' : '#6b7280',
              fontWeight: t === tab ? 700 : 400,
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: -2,
              transition: 'color 0.15s',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {/* ── active panel ── */}
      <div style={{ minHeight: 400 }}>
        {panelMap[tab]}
      </div>
    </main>
  );
}
