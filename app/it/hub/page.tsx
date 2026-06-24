'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = 'data' | 'logs' | 'knowledge' | 'docs';

/* ── tiny shared helpers ───────────────────────────────────────── */
function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'data',      label: '📊 Data' },
    { id: 'logs',      label: '📋 Logs' },
    { id: 'knowledge', label: '🧠 Knowledge' },
    { id: 'docs',      label: '📄 Docs' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #2a2a2a', marginBottom: 24 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: active === t.id ? '2px solid #d4af37' : '2px solid transparent',
            color: active === t.id ? '#d4af37' : '#888',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: active === t.id ? 600 : 400,
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ color: '#d4af37', fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 20, marginBottom: 16 }}>
      {children}
    </h2>
  );
}

function Table({ columns, rows }: { columns: { key: string; header: string }[]; rows: Record<string, unknown>[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #2a2a2a', color: '#888', fontWeight: 500 }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '16px 12px', color: '#555', textAlign: 'center' }}>
                No records found.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                {columns.map(c => (
                  <td key={c.key} style={{ padding: '8px 12px', color: '#ccc' }}>
                    {(row[c.key] as string | number | null | undefined) ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── TAB: Data ─────────────────────────────────────────────────── */
function DataTab() {
  const [tickets, setTickets] = useState<Record<string, unknown>[]>([]);
  const [incidents, setIncidents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [t, i] = await Promise.all([
        supabase.from('cockpit_tickets').select('id,arm,intent,status,created_at').order('id', { ascending: false }).limit(20),
        supabase.from('cockpit_incidents').select('id,title,severity,status,created_at').order('id', { ascending: false }).limit(20),
      ]);
      setTickets(t.data ?? []);
      setIncidents(i.data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) return <p style={{ color: '#666' }}>Loading…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      <div>
        <SectionTitle>Dev Tickets</SectionTitle>
        <Table
          columns={[
            { key: 'id', header: 'ID' },
            { key: 'arm', header: 'Arm' },
            { key: 'intent', header: 'Intent' },
            { key: 'status', header: 'Status' },
            { key: 'created_at', header: 'Created' },
          ]}
          rows={tickets}
        />
      </div>
      <div>
        <SectionTitle>Incidents</SectionTitle>
        <Table
          columns={[
            { key: 'id', header: 'ID' },
            { key: 'title', header: 'Title' },
            { key: 'severity', header: 'Severity' },
            { key: 'status', header: 'Status' },
            { key: 'created_at', header: 'Created' },
          ]}
          rows={incidents}
        />
      </div>
    </div>
  );
}

/* ── TAB: Logs ─────────────────────────────────────────────────── */
function LogsTab() {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('cockpit_audit_log')
        .select('id,agent,action,detail,created_at')
        .order('id', { ascending: false })
        .limit(50);
      setLogs(data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) return <p style={{ color: '#666' }}>Loading…</p>;

  return (
    <div>
      <SectionTitle>Audit Log</SectionTitle>
      <Table
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'agent', header: 'Agent' },
          { key: 'action', header: 'Action' },
          { key: 'detail', header: 'Detail' },
          { key: 'created_at', header: 'Time' },
        ]}
        rows={logs}
      />
    </div>
  );
}

/* ── TAB: Knowledge ────────────────────────────────────────────── */
function KnowledgeTab() {
  const [kb, setKb] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('cockpit_knowledge_base')
        .select('id,topic,key_fact,scope,confidence,created_at')
        .order('id', { ascending: false })
        .limit(100);
      setKb(data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  const filtered = kb.filter(row =>
    search === '' ||
    String(row.topic ?? '').toLowerCase().includes(search.toLowerCase()) ||
    String(row.key_fact ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p style={{ color: '#666' }}>Loading…</p>;

  return (
    <div>
      <SectionTitle>Knowledge Base</SectionTitle>
      <input
        type="text"
        placeholder="Search topics or facts…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%',
          maxWidth: 400,
          padding: '8px 12px',
          background: '#111',
          border: '1px solid #2a2a2a',
          borderRadius: 6,
          color: '#ccc',
          fontSize: 13,
          marginBottom: 16,
        }}
      />
      <Table
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'topic', header: 'Topic' },
          { key: 'key_fact', header: 'Fact' },
          { key: 'scope', header: 'Scope' },
          { key: 'confidence', header: 'Confidence' },
        ]}
        rows={filtered}
      />
    </div>
  );
}

/* ── TAB: Docs ─────────────────────────────────────────────────── */
function DocsTab() {
  const DOC_TYPES = [
    'vision_roadmap',
    'prd',
    'architecture',
    'data_model',
    'api',
    'security',
    'integration',
  ] as const;

  const [docs, setDocs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('cockpit_docs')
        .select('id,doc_type,environment,version,status,updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);
      setDocs(data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) return <p style={{ color: '#666' }}>Loading…</p>;

  return (
    <div>
      <SectionTitle>Documentation</SectionTitle>
      {docs.length > 0 ? (
        <Table
          columns={[
            { key: 'doc_type', header: 'Type' },
            { key: 'environment', header: 'Env' },
            { key: 'version', header: 'Version' },
            { key: 'status', header: 'Status' },
            { key: 'updated_at', header: 'Updated' },
          ]}
          rows={docs}
        />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {DOC_TYPES.map(dt => (
            <div
              key={dt}
              style={{
                padding: '14px 20px',
                background: '#111',
                border: '1px solid #2a2a2a',
                borderRadius: 8,
                color: '#ccc',
                fontSize: 13,
                minWidth: 160,
              }}
            >
              <div style={{ color: '#d4af37', fontWeight: 600, marginBottom: 4 }}>{dt.replace('_', ' ').toUpperCase()}</div>
              <div style={{ color: '#555', fontSize: 12 }}>View in cockpit</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── PAGE ROOT ─────────────────────────────────────────────────── */
export default function ITHubPage() {
  const [activeTab, setActiveTab] = useState<Tab>('data');

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 28, color: '#fff', margin: 0 }}>
          IT Hub
        </h1>
        <p style={{ color: '#666', fontSize: 14, marginTop: 6 }}>
          Data · Logs · Knowledge · Docs — all in one place.
        </p>
      </div>

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'data'      && <DataTab />}
      {activeTab === 'logs'      && <LogsTab />}
      {activeTab === 'knowledge' && <KnowledgeTab />}
      {activeTab === 'docs'      && <DocsTab />}
    </main>
  );
}
