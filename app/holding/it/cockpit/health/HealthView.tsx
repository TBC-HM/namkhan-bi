'use client';

// app/holding/it/cockpit/health/HealthView.tsx
// Live health dashboard. 30s poll refreshes incidents + audit + crons.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { useEffect, useState } from 'react';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import type {
  V2AuditRow,
  V2CronRow,
  V2Incident,
} from '../_lib/data-port';

type HealthBundle = {
  openIncidents: V2Incident[];
  recentAudit: V2AuditRow[];
  webhookRecent: V2AuditRow[];
  crons: V2CronRow[];
  burn: Array<{ day: string; runs: number; spend_usd: number; failures: number }>;
};

const VENDORS = [
  { name: 'Supabase', agent: 'supabase-webhook', icon: '🗄️' },
  { name: 'Vercel', agent: 'vercel-webhook', icon: '▲' },
  { name: 'GitHub', agent: 'github-webhook', icon: '🐙' },
  { name: 'Deploys', agent: 'deploy-prod-workflow', icon: '🚀' },
];

function ageMin(iso: string | null): string {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

function isoDate(s: string | null): string {
  return s ? s.slice(0, 10) : '—';
}

function severityColor(sev: number | null): string {
  if (sev == null) return TOKENS.text3;
  if (sev >= 9) return TOKENS.oxblood;
  if (sev >= 6) return TOKENS.terracotta;
  if (sev >= 3) return TOKENS.ochre;
  return TOKENS.sand;
}

function statusColor(status: string | null): string {
  if (!status) return TOKENS.text3;
  if (['succeeded', 'completed', 'ok'].includes(status)) return TOKENS.moss;
  if (['failed', 'error'].includes(status)) return TOKENS.oxblood;
  if (['running', 'skipped'].includes(status)) return TOKENS.ochre;
  return TOKENS.text2;
}

export function HealthView({ initial }: { initial: HealthBundle }) {
  const [data, setData] = useState<HealthBundle>(initial);
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        setPending(true);
        const res = await fetch('/api/holding/it/cockpit/health', { cache: 'no-store' });
        if (!res.ok) return;
        const j = (await res.json()) as HealthBundle;
        if (!cancelled && j && typeof j === 'object') {
          setData(j);
          setRefreshedAt(Date.now());
        }
      } catch {
        // swallow
      } finally {
        if (!cancelled) setPending(false);
      }
    };
    const id = window.setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Map last-event per vendor.
  const vendorLast: Record<string, V2AuditRow | undefined> = {};
  for (const row of data.webhookRecent) {
    if (row.agent && !vendorLast[row.agent]) vendorLast[row.agent] = row;
  }

  const today = data.burn[0];
  const ceiling = 20;
  const ceilingPct = today ? Math.min((today.spend_usd / ceiling) * 100, 100) : 0;

  return (
    <div style={{ color: TOKENS.ink, fontFamily: 'var(--sans)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>Health</h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          {data.openIncidents.length} open incident
          {data.openIncidents.length === 1 ? '' : 's'} · refreshed{' '}
          {ageMin(new Date(refreshedAt).toISOString())}
          {pending && (
            <span style={{ marginLeft: 6, color: TOKENS.sand }}>
              · refreshing…
            </span>
          )}
        </div>
      </div>

      {/* Vendor row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 22,
        }}
      >
        {VENDORS.map((v) => {
          const last = vendorLast[v.agent];
          const healthy = last ? last.success !== false : true;
          const dot = last ? (healthy ? TOKENS.moss : TOKENS.oxblood) : TOKENS.text3;
          return (
            <div
              key={v.name}
              style={{
                padding: '12px 14px',
                background: TOKENS.bgRaised,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 2,
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: TOKENS.text3,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {v.icon} {v.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  margin: '6px 0',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: dot,
                    boxShadow: `0 0 0 3px ${dot}33`,
                  }}
                />
                <span
                  style={{
                    fontFamily: SERIF,
                    fontSize: 16,
                    color: TOKENS.ink,
                  }}
                >
                  {last ? (healthy ? 'ok' : 'fail') : 'idle'}
                </span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3 }}>
                {last ? ageMin(last.created_at) : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Three-column row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)',
          gap: 16,
          marginBottom: 22,
        }}
      >
        {/* Recent events */}
        <section
          style={{
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            borderRadius: 2,
          }}
        >
          <SectionHeader>Recent events (24h)</SectionHeader>
          {data.recentAudit.length === 0 ? (
            <Empty>No audit entries in the last 24h.</Empty>
          ) : (
            <ol style={ulStyle}>
              {data.recentAudit.map((e) => (
                <li
                  key={e.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 130px 1fr',
                    gap: 12,
                    padding: '6px 12px',
                    borderBottom: `1px solid ${TOKENS.borderSoft}`,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3 }}>
                    {ageMin(e.created_at)}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      color: e.success === false ? TOKENS.oxblood : TOKENS.moss,
                    }}
                  >
                    {e.agent ?? '—'}
                  </span>
                  <span style={{ color: TOKENS.ink }}>
                    <span style={{ fontFamily: MONO, fontSize: 11 }}>
                      {e.action ?? '—'}
                    </span>
                    {e.target && (
                      <span style={{ color: TOKENS.text2 }}> → {e.target}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Open incidents */}
        <section
          style={{
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            borderRadius: 2,
          }}
        >
          <SectionHeader>Open incidents ({data.openIncidents.length})</SectionHeader>
          {data.openIncidents.length === 0 ? (
            <Empty>None.</Empty>
          ) : (
            <ol style={ulStyle}>
              {data.openIncidents.map((i) => (
                <li
                  key={i.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${TOKENS.borderSoft}`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: severityColor(i.severity),
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    sev {i.severity ?? '—'}
                  </div>
                  <div style={{ fontSize: 12, color: TOKENS.ink, marginTop: 2 }}>
                    {i.symptom ?? '—'}
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: TOKENS.text3,
                      marginTop: 2,
                    }}
                  >
                    {ageMin(i.detected_at)}{' '}
                    {i.source && <span>· {i.source}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Cost burn */}
        <section
          style={{
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            borderRadius: 2,
          }}
        >
          <SectionHeader>Cost burn</SectionHeader>
          <div style={{ padding: 12 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: TOKENS.text3,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              Today
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 24,
                color: TOKENS.ink,
                marginTop: 4,
              }}
            >
              ${today ? today.spend_usd.toFixed(2) : '0.00'}
            </div>
            <div
              style={{
                height: 4,
                background: TOKENS.bgDeep,
                borderRadius: 2,
                overflow: 'hidden',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  width: `${ceilingPct}%`,
                  height: '100%',
                  background:
                    ceilingPct >= 75
                      ? TOKENS.oxblood
                      : ceilingPct >= 50
                        ? TOKENS.ochre
                        : TOKENS.moss,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: TOKENS.text3,
                marginTop: 4,
              }}
            >
              of ${ceiling}/day ceiling
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: 12,
                fontSize: 11,
              }}
            >
              <thead>
                <tr>
                  <th style={tableTh}>Day</th>
                  <th style={tableThRight}>$</th>
                  <th style={tableThRight}>Runs</th>
                </tr>
              </thead>
              <tbody>
                {data.burn.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ color: TOKENS.text3, padding: 8 }}>
                      —
                    </td>
                  </tr>
                ) : (
                  data.burn.map((c) => (
                    <tr key={c.day}>
                      <td style={tableTd}>{isoDate(c.day)}</td>
                      <td style={tableTdRight}>
                        ${Number(c.spend_usd).toFixed(2)}
                      </td>
                      <td style={tableTdRight}>{c.runs}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Cron jobs */}
      <section
        style={{
          border: `1px solid ${TOKENS.border}`,
          background: TOKENS.bgRaised,
          borderRadius: 2,
        }}
      >
        <SectionHeader>Scheduled tasks ({data.crons.length})</SectionHeader>
        {data.crons.length === 0 ? (
          <Empty>No scheduled tasks.</Empty>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={tableTh}>Task</th>
                <th style={tableTh}>Cost class</th>
                <th style={tableTh}>Last run</th>
                <th style={tableTh}>Status</th>
                <th style={tableThRight}>Last cost</th>
              </tr>
            </thead>
            <tbody>
              {data.crons.map((c) => (
                <tr
                  key={c.task_name}
                  style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}
                >
                  <td style={tableTd}>{c.task_name}</td>
                  <td style={{ ...tableTd, fontFamily: MONO, color: TOKENS.text2 }}>
                    {c.cost_class ?? '—'}
                  </td>
                  <td style={{ ...tableTd, fontFamily: MONO, color: TOKENS.text3 }}>
                    {ageMin(c.started_at)}
                  </td>
                  <td style={{ ...tableTd, color: statusColor(c.status) }}>
                    {c.status ?? '—'}
                  </td>
                  <td style={tableTdRight}>
                    ${Number(c.cost_usd ?? 0).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${TOKENS.border}`,
        fontFamily: MONO,
        fontSize: 10,
        color: TOKENS.text3,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 14, color: TOKENS.text3, fontSize: 12 }}>{children}</div>
  );
}

const ulStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
};
const tableTh: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: 0.6,
  color: TOKENS.text3,
  textTransform: 'uppercase',
  borderBottom: `1px solid ${TOKENS.border}`,
};
const tableThRight: React.CSSProperties = { ...tableTh, textAlign: 'right' };
const tableTd: React.CSSProperties = { padding: '6px 12px' };
const tableTdRight: React.CSSProperties = { ...tableTd, textAlign: 'right' };
