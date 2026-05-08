'use client';

// ─────────────────────────────────────────────────────────────────────────────
// app/cockpit/page.tsx
// Perf #229: All Supabase fetches are now kicked off in parallel via
// Promise.all() instead of sequentially awaited one-by-one.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── types ────────────────────────────────────────────────────────────────────
interface Ticket   { id: number; status: string; arm: string; intent: string; parsed_summary: string; created_at: string; updated_at: string; source: string; }
interface Incident { id: number; title: string; severity: string; status: string; created_at: string; }
interface AuditRow { id: number; created_at: string; agent: string; action: string; detail: string; }

// ── component ────────────────────────────────────────────────────────────────
export default function CockpitPage() {
  const [tickets,   setTickets]   = useState<Ticket[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [auditLog,  setAuditLog]  = useState<AuditRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<'tickets' | 'incidents' | 'logs'>('tickets');

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);

      // ── PARALLEL fetch — all queries fire simultaneously ───────────────────
      const [ticketsRes, incidentsRes, auditRes] = await Promise.all([
        supabase
          .from('cockpit_tickets')
          .select('id,status,arm,intent,parsed_summary,created_at,updated_at,source')
          .order('created_at', { ascending: false })
          .limit(100),

        supabase
          .from('cockpit_incidents')
          .select('id,title,severity,status,created_at')
          .order('created_at', { ascending: false })
          .limit(50),

        supabase
          .from('cockpit_audit_log')
          .select('id,created_at,agent,action,detail')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (cancelled) return;

      setTickets(ticketsRes.data   ?? []);
      setIncidents(incidentsRes.data ?? []);
      setAuditLog(auditRes.data    ?? []);
      setLoading(false);
    }

    void fetchAll();
    return () => { cancelled = true; };
  }, []);

  // ── render helpers ───────────────────────────────────────────────────────
  const statusBadge = (s: string) => {
    const colours: Record<string, string> = {
      completed: '#16a34a', working: '#2563eb', triaged: '#7c3aed',
      triage_failed: '#dc2626', awaits_user: '#d97706', new: '#6b7280',
    };
    return (
      <span style={{
        background: colours[s] ?? '#6b7280',
        color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12,
      }}>
        {s}
      </span>
    );
  };

  const severityBadge = (s: string) => {
    const colours: Record<string, string> = {
      critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a',
    };
    return (
      <span style={{
        background: colours[s] ?? '#6b7280',
        color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12,
      }}>
        {s}
      </span>
    );
  };

  const fmt = (iso: string) => iso ? iso.replace('T', ' ').slice(0, 16) : '—';

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '24px 32px', maxWidth: 1400 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🛸 Cockpit</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
          Namkhan BI — agent command centre
        </p>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Tickets',  value: tickets.length },
          { label: 'Working',        value: tickets.filter(t => t.status === 'working').length },
          { label: 'Open Incidents', value: incidents.filter(i => i.status !== 'resolved').length },
          { label: 'Audit Entries',  value: auditLog.length },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: '#f9fafb', border: '1px solid #e5e7eb',
            borderRadius: 8, padding: '16px 20px',
          }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '…' : value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        {(['tickets', 'incidents', 'logs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
              background: 'none', fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? '#2563eb' : '#374151',
              fontSize: 14,
            }}
          >
            {tab === 'tickets'
              ? `Tickets (${tickets.length})`
              : tab === 'incidents'
              ? `Incidents (${incidents.length})`
              : `Audit Log (${auditLog.length})`}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#6b7280', fontSize: 14 }}>Loading…</p>}

      {/* ── Tickets tab ────────────────────────────────────────────── */}
      {!loading && activeTab === 'tickets' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['ID', 'Status', 'Arm', 'Intent', 'Source', 'Summary', 'Updated'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{t.id}</td>
                  <td style={{ padding: '8px 12px' }}>{statusBadge(t.status ?? '—')}</td>
                  <td style={{ padding: '8px 12px' }}>{t.arm ?? '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{t.intent ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 11 }}>{t.source ?? '—'}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 420 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>
                      {t.parsed_summary?.slice(0, 120) ?? '—'}
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#6b7280' }}>{fmt(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Incidents tab ──────────────────────────────────────────── */}
      {!loading && activeTab === 'incidents' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['ID', 'Title', 'Severity', 'Status', 'Created'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '24px 12px', color: '#6b7280', textAlign: 'center' }}>No incidents</td></tr>
              )}
              {incidents.map((inc, i) => (
                <tr key={inc.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{inc.id}</td>
                  <td style={{ padding: '8px 12px' }}>{inc.title ?? '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{severityBadge(inc.severity ?? 'low')}</td>
                  <td style={{ padding: '8px 12px' }}>{statusBadge(inc.status ?? '—')}</td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#6b7280' }}>{fmt(inc.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Audit Log tab ──────────────────────────────────────────── */}
      {!loading && activeTab === 'logs' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['ID', 'When', 'Agent', 'Action', 'Detail'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLog.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.id}</td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#6b7280' }}>{fmt(row.created_at)}</td>
                  <td style={{ padding: '8px 12px' }}>{row.agent ?? '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{row.action ?? '—'}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 500 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                      {row.detail ?? '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
