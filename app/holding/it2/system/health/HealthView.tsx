'use client';
// app/holding/it2/system/health/HealthView.tsx
// Restructured health dashboard — stacked sections, external CTAs,
// last-run timestamps, cost drill link, activity log link. 30s auto-poll.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import type { V2AuditRow, V2CronRow, V2Incident } from '@/lib/cockpit/data-port';

type HealthBundle = {
  openIncidents: V2Incident[];
  recentAudit:   V2AuditRow[];
  webhookRecent: V2AuditRow[];
  crons:         V2CronRow[];
  burn: Array<{ day: string; runs: number; spend_usd: number; failures: number }>;
};

const VENDORS = [
  { name: 'Supabase', agent: 'supabase-webhook',    icon: '🗄', href: 'https://supabase.com/dashboard/project/kpenyneooigsyuuomgct' },
  { name: 'Vercel',   agent: 'vercel-webhook',       icon: '▲',  href: 'https://vercel.com/pbsbase-2825s-projects/namkhan-bi' },
  { name: 'GitHub',   agent: 'github-webhook',       icon: '⬡',  href: 'https://github.com/TBC-HM/namkhan-bi/actions' },
  { name: 'Deploys',  agent: 'deploy-prod-workflow', icon: '🚀', href: 'https://github.com/TBC-HM/namkhan-bi/actions' },
];

function age(iso: string | null): string {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}
function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function sevColor(sev: number | null): string {
  if (sev == null) return TOKENS.text3;
  if (sev >= 9) return '#C62828';
  if (sev >= 6) return '#E65100';
  if (sev >= 3) return '#B48A3A';
  return TOKENS.text3;
}
function cronStatus(status: string | null): { color: string; label: string } {
  if (!status) return { color: '#888', label: '—' };
  if (['succeeded', 'completed', 'ok'].includes(status)) return { color: '#2E7D32', label: status };
  if (['failed', 'error'].includes(status)) return { color: '#C62828', label: status };
  if (['running', 'skipped'].includes(status)) return { color: '#B48A3A', label: status };
  return { color: TOKENS.text2, label: status };
}

// Defined at module scope — safe to use as <Section /> inside 'use client'
function Section({ title, count, right, children }: {
  title: string; count?: number | null; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ border: `1px solid ${TOKENS.border}`, borderRadius: 8, background: TOKENS.bgRaised, marginBottom: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${TOKENS.border}`, background: '#FAFAF7' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: TOKENS.text2 }}>
          {title}{count != null ? ` · ${count}` : ''}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}

const linkCta: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: TOKENS.forest, textDecoration: 'none' };
const extCta:  React.CSSProperties = { fontSize: 10, fontWeight: 600, color: TOKENS.forest, textDecoration: 'none' };
const hdr:     React.CSSProperties = { textAlign: 'left', padding: '5px 12px', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: TOKENS.text3, borderBottom: `1px solid ${TOKENS.border}`, whiteSpace: 'nowrap' as const };
const cell:    React.CSSProperties = { padding: '7px 12px', borderBottom: `1px solid ${TOKENS.border}` };

export function HealthView({ initial }: { initial: HealthBundle }) {
  const [data, setData]           = useState<HealthBundle>(initial);
  const [refreshedAt, setRefAt]   = useState<number>(Date.now());
  const [polling, setPolling]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        setPolling(true);
        const res = await fetch('/api/holding/it/cockpit/health', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json() as HealthBundle;
        if (!cancelled && j && typeof j === 'object') { setData(j); setRefAt(Date.now()); }
      } catch { /* swallow */ } finally { if (!cancelled) setPolling(false); }
    };
    const id = window.setInterval(tick, 30_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  const vendorLast: Record<string, V2AuditRow | undefined> = {};
  for (const row of data.webhookRecent) {
    if (row.agent && !vendorLast[row.agent]) vendorLast[row.agent] = row;
  }

  const today   = data.burn[0];
  const CEILING = 20;
  const burnPct = today ? Math.min((today.spend_usd / CEILING) * 100, 100) : 0;
  const allOk   = data.openIncidents.length === 0;

  return (
    <div style={{ maxWidth: 860, color: TOKENS.ink, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Status banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const,
        padding: '10px 14px', borderRadius: 8, marginBottom: 16,
        background: allOk ? '#E8F5E9' : '#FFEBEE',
        border: `1px solid ${allOk ? '#A5D6A7' : '#EF9A9A'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>{allOk ? '✅' : '⚠️'}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: allOk ? '#2E7D32' : '#C62828' }}>
            {allOk ? 'All systems operational' : `${data.openIncidents.length} open incident${data.openIncidents.length > 1 ? 's' : ''}`}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#888', fontFamily: MONO }}>
          {polling ? 'refreshing…' : `refreshed ${age(new Date(refreshedAt).toISOString())}`} · auto every 30s
        </span>
      </div>

      {/* Integration signals */}
      <Section title="Integration signals" right={
        <a href="https://github.com/TBC-HM/namkhan-bi/actions" target="_blank" rel="noreferrer" style={extCta}>GitHub Actions →</a>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {VENDORS.map((v, i) => {
            const last = vendorLast[v.agent];
            const ok   = last ? last.success !== false : null;
            const dot  = ok === null ? '#888' : ok ? '#2E7D32' : '#C62828';
            return (
              <div key={v.name} style={{ padding: '11px 14px', borderRight: i < 3 ? `1px solid ${TOKENS.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: TOKENS.text2 }}>{v.icon} {v.name}</span>
                  <a href={v.href} target="_blank" rel="noreferrer" style={extCta}>→</a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: dot }}>{ok === null ? 'idle' : ok ? 'ok' : 'error'}</span>
                </div>
                <div style={{ fontSize: 10, color: '#888', fontFamily: MONO }}>{last ? fmtTime(last.created_at) : 'no events'}</div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Scheduled tasks */}
      <Section title="Scheduled tasks" count={data.crons.length} right={
        <Link href="/holding/it2/system/checks" style={linkCta}>View cron runs →</Link>
      }>
        {data.crons.length === 0
          ? <div style={{ padding: '12px 14px', fontSize: 12, color: TOKENS.text3 }}>No scheduled tasks.</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['Task', 'Last run', 'Status', 'Cost'].map(h => <th key={h} style={hdr}>{h}</th>)}</tr></thead>
              <tbody>
                {data.crons.map((c) => {
                  const { color, label } = cronStatus(c.status);
                  return (
                    <tr key={c.task_name}>
                      <td style={{ ...cell, fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{c.task_name}</td>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 10 }}>
                        <div style={{ color: TOKENS.text2 }}>{age(c.started_at)}</div>
                        <div style={{ color: TOKENS.text3 }}>{fmtTime(c.started_at)}</div>
                      </td>
                      <td style={{ ...cell }}><span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span></td>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>${Number(c.cost_usd ?? 0).toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        }
      </Section>

      {/* Open incidents */}
      <Section title="Open incidents" count={data.openIncidents.length} right={
        data.openIncidents.length > 0
          ? <span style={{ fontSize: 11, fontWeight: 700, color: '#C62828' }}>⚠ Needs attention</span>
          : <span style={{ fontSize: 11, color: '#2E7D32', fontWeight: 600 }}>✓ Clear</span>
      }>
        {data.openIncidents.length === 0
          ? <div style={{ padding: '12px 14px', fontSize: 12, color: '#2E7D32' }}>No open incidents.</div>
          : data.openIncidents.map((inc) => (
              <div key={inc.id} style={{ padding: '10px 14px', borderBottom: `1px solid ${TOKENS.border}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#FFEBEE', color: sevColor(inc.severity), whiteSpace: 'nowrap' as const, marginTop: 2 }}>
                  SEV {inc.severity ?? '?'}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{inc.symptom ?? '—'}</div>
                  <div style={{ fontSize: 11, color: TOKENS.text3, fontFamily: MONO, marginTop: 2 }}>
                    Detected {age(inc.detected_at)}{inc.source ? ` · source: ${inc.source}` : ''}
                  </div>
                </div>
              </div>
            ))
        }
      </Section>

      {/* Cost burn */}
      <Section title="Cost burn — today" right={
        <Link href="/holding/finance/costs" style={linkCta}>Full cost ledger →</Link>
      }>
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO }}>${today ? Number(today.spend_usd).toFixed(2) : '0.00'}</span>
            <span style={{ fontSize: 12, color: TOKENS.text3 }}>of ${CEILING}/day ceiling · {today?.runs ?? 0} runs{today?.failures ? ` · ${today.failures} failed` : ''}</span>
          </div>
          <div style={{ height: 5, background: '#E6DFCC', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: `${burnPct}%`, borderRadius: 3, background: burnPct >= 75 ? '#C62828' : burnPct >= 50 ? '#B48A3A' : '#2E7D32' }} />
          </div>
          {data.burn.length > 1 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr>{['Day','Runs','Fail','Spend'].map(h => <th key={h} style={{ ...hdr, padding: '4px 8px 4px 0', border: 'none', borderBottom: `1px solid ${TOKENS.border}` }}>{h}</th>)}</tr></thead>
              <tbody>
                {data.burn.slice(0,7).map((b) => (
                  <tr key={b.day}>
                    <td style={{ padding: '4px 8px 4px 0', fontFamily: MONO }}>{b.day?.slice(0,10)}</td>
                    <td style={{ padding: '4px 8px 4px 0', fontFamily: MONO }}>{b.runs}</td>
                    <td style={{ padding: '4px 8px 4px 0', fontFamily: MONO, color: b.failures > 0 ? '#C62828' : TOKENS.text3 }}>{b.failures}</td>
                    <td style={{ padding: '4px 8px 4px 0', fontFamily: MONO }}>${Number(b.spend_usd).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      {/* Recent events */}
      <Section title="Recent events (24h)" count={data.recentAudit.length} right={
        <Link href="/holding/it2/system/activity" style={linkCta}>Full activity log →</Link>
      }>
        {data.recentAudit.length === 0
          ? <div style={{ padding: '12px 14px', fontSize: 12, color: TOKENS.text3 }}>No audit entries in the last 24h.</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['When','Agent','Action','Target',''].map((h,i) => <th key={i} style={hdr}>{h}</th>)}</tr></thead>
              <tbody>
                {data.recentAudit.map((e) => (
                  <tr key={e.id}>
                    <td style={{ ...cell, fontFamily: MONO, fontSize: 10, color: TOKENS.text3, whiteSpace: 'nowrap' as const }}>{age(e.created_at)}</td>
                    <td style={{ ...cell, fontFamily: MONO, fontSize: 11, color: e.success === false ? '#C62828' : '#2E7D32', whiteSpace: 'nowrap' as const }}>{e.agent ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: MONO, fontSize: 11 }}>{e.action ?? '—'}</td>
                    <td style={{ ...cell, fontSize: 11, color: TOKENS.text2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{e.target ?? ''}</td>
                    <td style={{ ...cell, fontSize: 12, color: e.success === false ? '#C62828' : '#2E7D32' }}>{e.success === false ? '✗' : '✓'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </Section>
    </div>
  );
}
