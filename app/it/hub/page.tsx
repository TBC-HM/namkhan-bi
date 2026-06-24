'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = 'data' | 'logs' | 'knowledge' | 'ocs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'data',      label: '📊 Data' },
  { id: 'logs',      label: '📋 Logs' },
  { id: 'knowledge', label: '🧠 Knowledge' },
  { id: 'ocs',       label: '⚙️ OCS' },
];

/* ─── sub-panel types ─── */
interface AuditRow {
  id: number;
  created_at: string;
  agent: string;
  action: string;
  details: string | null;
}
interface KbRow {
  id: number;
  topic: string;
  key_fact: string;
  scope: string;
  confidence: string;
}
interface IncidentRow {
  id: number;
  created_at: string;
  title: string;
  status: string;
  severity: string | null;
}
interface TicketRow {
  id: number;
  created_at: string;
  parsed_summary: string;
  status: string;
  arm: string;
}

export default function ITHubPage() {
  const [tab, setTab] = useState<Tab>('data');

  /* data states */
  const [auditRows, setAuditRows]       = useState<AuditRow[]>([]);
  const [kbRows,    setKbRows]          = useState<KbRow[]>([]);
  const [incidents, setIncidents]       = useState<IncidentRow[]>([]);
  const [tickets,   setTickets]         = useState<TicketRow[]>([]);
  const [loading,   setLoading]         = useState(false);

  useEffect(() => {
    void loadTab(tab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function loadTab(t: Tab) {
    setLoading(true);
    try {
      if (t === 'logs') {
        const { data } = await supabase
          .from('cockpit_audit_log')
          .select('id, created_at, agent, action, details')
          .order('created_at', { ascending: false })
          .limit(60);
        setAuditRows((data as AuditRow[]) ?? []);
      }
      if (t === 'knowledge') {
        const { data } = await supabase
          .from('cockpit_knowledge_base')
          .select('id, topic, key_fact, scope, confidence')
          .order('id', { ascending: false })
          .limit(60);
        setKbRows((data as KbRow[]) ?? []);
      }
      if (t === 'ocs') {
        const { data } = await supabase
          .from('cockpit_incidents')
          .select('id, created_at, title, status, severity')
          .order('created_at', { ascending: false })
          .limit(40);
        setIncidents((data as IncidentRow[]) ?? []);
      }
      if (t === 'data') {
        const { data } = await supabase
          .from('cockpit_tickets')
          .select('id, created_at, parsed_summary, status, arm')
          .order('id', { ascending: false })
          .limit(40);
        setTickets((data as TicketRow[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {/* ── Header ── */}
      <div style={{ padding: '32px 40px 0' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>IT Hub</h1>
        <p style={{ color: '#888', marginTop: 4, fontSize: 14 }}>Data · Logs · Knowledge · OCS — all in one place</p>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 0, padding: '24px 40px 0', borderBottom: '1px solid #222' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #a78bfa' : '2px solid transparent',
              color: tab === t.id ? '#a78bfa' : '#888',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === t.id ? 700 : 400,
              padding: '10px 24px',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '32px 40px' }}>
        {loading && <p style={{ color: '#666' }}>Loading…</p>}

        {/* DATA tab — cockpit tickets */}
        {!loading && tab === 'data' && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Cockpit Tickets</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['ID', 'Created', 'Arm', 'Status', 'Summary'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, color: '#555' }}>No rows</td></tr>
                )}
                {tickets.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={tdStyle}>{r.id}</td>
                    <td style={tdStyle}>{r.created_at?.slice(0, 10) ?? '—'}</td>
                    <td style={tdStyle}>{r.arm ?? '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ ...pillStyle, background: statusColor(r.status) }}>
                        {r.status ?? '—'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 420, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(r.parsed_summary ?? '—').slice(0, 120)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* LOGS tab — audit log */}
        {!loading && tab === 'logs' && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Audit Log</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['ID', 'Timestamp', 'Agent', 'Action', 'Details'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditRows.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, color: '#555' }}>No rows</td></tr>
                )}
                {auditRows.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={tdStyle}>{r.id}</td>
                    <td style={tdStyle}>{r.created_at?.slice(0, 19).replace('T', ' ') ?? '—'}</td>
                    <td style={tdStyle}>{r.agent ?? '—'}</td>
                    <td style={tdStyle}>{r.action ?? '—'}</td>
                    <td style={{ ...tdStyle, maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#888' }}>
                      {r.details ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* KNOWLEDGE tab */}
        {!loading && tab === 'knowledge' && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Knowledge Base</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
              {kbRows.length === 0 && <p style={{ color: '#555' }}>No entries</p>}
              {kbRows.map(r => (
                <div key={r.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#a78bfa' }}>{r.topic ?? '—'}</span>
                    <span style={{ fontSize: 11, color: '#555' }}>{r.scope ?? '—'} · {r.confidence ?? '—'}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>{r.key_fact ?? '—'}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* OCS tab — incidents */}
        {!loading && tab === 'ocs' && (
          <section>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>OCS / Incidents</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['ID', 'Created', 'Title', 'Severity', 'Status'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidents.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, color: '#555' }}>No rows</td></tr>
                )}
                {incidents.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={tdStyle}>{r.id}</td>
                    <td style={tdStyle}>{r.created_at?.slice(0, 10) ?? '—'}</td>
                    <td style={{ ...tdStyle, maxWidth: 360 }}>{r.title ?? '—'}</td>
                    <td style={tdStyle}>{r.severity ?? '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ ...pillStyle, background: statusColor(r.status) }}>
                        {r.status ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}

/* ─── helpers ─── */
function statusColor(s: string | null | undefined): string {
  if (!s) return '#333';
  const v = s.toLowerCase();
  if (v.includes('open') || v.includes('triaged') || v.includes('working')) return '#1e3a5f';
  if (v.includes('complet') || v.includes('ready') || v.includes('closed')) return '#14532d';
  if (v.includes('error') || v.includes('fail') || v.includes('critical')) return '#7f1d1d';
  return '#333';
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  color: '#555',
  fontWeight: 600,
  borderBottom: '1px solid #222',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: '#ccc',
  verticalAlign: 'top',
};
const pillStyle: React.CSSProperties = {
  display: 'inline-block',
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: 11,
  color: '#fff',
  fontWeight: 600,
};
const cardStyle: React.CSSProperties = {
  background: '#111',
  border: '1px solid #1e1e1e',
  borderRadius: 8,
  padding: 16,
};
