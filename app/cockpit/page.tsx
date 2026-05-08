'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ticket {
  id: number;
  created_at: string;
  updated_at: string;
  source: string;
  arm: string;
  intent: string;
  status: string;
  parsed_summary: string | null;
}

interface Incident {
  id: number;
  created_at: string;
  title: string;
  severity: string;
  status: string;
}

interface AuditRow {
  id: number;
  created_at: string;
  agent: string;
  action: string;
  detail: string | null;
}

interface CockpitData {
  tickets: Ticket[];
  incidents: Incident[];
  audit: AuditRow[];
}

// ─── Supabase client (browser-safe: public anon key only) ────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── Parallel fetch helper ────────────────────────────────────────────────────
async function fetchCockpitData(): Promise<CockpitData> {
  const supabase = getSupabase();

  // ALL THREE fetches fire simultaneously — previously sequential
  const [ticketsRes, incidentsRes, auditRes] = await Promise.all([
    supabase
      .from('cockpit_tickets')
      .select('id, created_at, updated_at, source, arm, intent, status, parsed_summary')
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('cockpit_incidents')
      .select('id, created_at, title, severity, status')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('cockpit_audit_log')
      .select('id, created_at, agent, action, detail')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return {
    tickets: ticketsRes.data ?? [],
    incidents: incidentsRes.data ?? [],
    audit: auditRes.data ?? [],
  };
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    completed: '#16a34a',
    working: '#2563eb',
    triaging: '#d97706',
    triage_failed: '#dc2626',
    new: '#6b7280',
    open: '#dc2626',
    resolved: '#16a34a',
    investigating: '#d97706',
  };
  return (
    <span
      style={{
        background: color[status] ?? '#6b7280',
        color: '#fff',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</h2>
      <span
        style={{
          background: '#f3f4f6',
          color: '#374151',
          borderRadius: 9999,
          padding: '1px 8px',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CockpitPage() {
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchMs, setFetchMs] = useState<number | null>(null);

  useEffect(() => {
    const t0 = performance.now();
    void fetchCockpitData()
      .then((result) => {
        setFetchMs(Math.round(performance.now() - t0));
        setData(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#6b7280' }}>Loading cockpit…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#dc2626' }}>Error: {error}</p>
      </main>
    );
  }

  const { tickets, incidents, audit } = data!;
  const openIncidents = incidents.filter((i) => i.status !== 'resolved');

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>
            🛸 Cockpit
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Operations command centre — Namkhan BI
          </p>
        </div>
        {fetchMs !== null && (
          <span style={{ fontSize: 12, color: '#9ca3af', background: '#f9fafb', padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
            ⚡ Parallel fetch: {fetchMs} ms
          </span>
        )}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Total tickets', value: tickets.length },
          { label: 'Completed', value: tickets.filter((t) => t.status === 'completed').length },
          { label: 'In progress', value: tickets.filter((t) => t.status === 'working').length },
          { label: 'Open incidents', value: openIncidents.length },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '14px 18px',
              boxShadow: '0 1px 2px rgba(0,0,0,.04)',
            }}
          >
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, color: '#111827' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Two-column layout: tickets | incidents + audit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Tickets */}
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <SectionHeader title="Recent Tickets" count={tickets.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tickets.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>No tickets found.</p>
            )}
            {tickets.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '10px 12px',
                  background: '#f9fafb',
                  borderRadius: 6,
                  border: '1px solid #f3f4f6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
                    #{t.id} · <span style={{ textTransform: 'capitalize' }}>{t.arm}</span>
                  </span>
                  <StatusBadge status={t.status} />
                </div>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 12,
                    color: '#6b7280',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.parsed_summary
                    ? t.parsed_summary.replace(/\*\*/g, '').split('\n')[0]
                    : '—'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
                  {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' · '}
                  {t.source ?? '—'}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Incidents + Audit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Incidents */}
          <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <SectionHeader title="Incidents" count={incidents.length} />
            {incidents.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>No incidents — all clear ✅</p>
            )}
            {incidents.map((inc) => (
              <div
                key={inc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #f3f4f6',
                  gap: 8,
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{inc.title ?? '—'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
                    {new Date(inc.created_at).toLocaleDateString('en-GB')}
                    {' · severity: '}
                    {inc.severity ?? '—'}
                  </p>
                </div>
                <StatusBadge status={inc.status} />
              </div>
            ))}
          </section>

          {/* Audit log */}
          <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, flex: 1 }}>
            <SectionHeader title="Audit Log" count={audit.length} />
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {audit.length === 0 && (
                <p style={{ color: '#9ca3af', fontSize: 13 }}>No audit entries.</p>
              )}
              {audit.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    gap: 8,
                    padding: '6px 0',
                    borderBottom: '1px solid #f9fafb',
                    fontSize: 12,
                    color: '#374151',
                  }}
                >
                  <span style={{ color: '#9ca3af', whiteSpace: 'nowrap', minWidth: 60 }}>
                    {new Date(row.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontWeight: 600, color: '#6366f1', whiteSpace: 'nowrap' }}>{row.agent ?? '—'}</span>
                  <span style={{ color: '#111827' }}>{row.action ?? '—'}</span>
                  {row.detail && (
                    <span
                      style={{
                        color: '#9ca3af',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 180,
                      }}
                    >
                      {row.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
