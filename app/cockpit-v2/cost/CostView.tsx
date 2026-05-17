'use client';

// app/cockpit-v2/cost/CostView.tsx
// 60s poll on /api/cockpit-v2/cost. Three KPI tiles + two tables.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import type { V2CostBreakdown } from '../_lib/data-port';

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0.0000';
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1000).toFixed(0) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export function CostView({ initial }: { initial: V2CostBreakdown }) {
  const [data, setData] = useState<V2CostBreakdown>(initial);
  const [pending, setPending] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        setPending(true);
        const res = await fetch('/api/cockpit-v2/cost', { cache: 'no-store' });
        if (!res.ok) return;
        const j = (await res.json()) as V2CostBreakdown;
        if (!cancelled && j) {
          setData(j);
          setRefreshedAt(Date.now());
        }
      } catch {
        // swallow
      } finally {
        if (!cancelled) setPending(false);
      }
    };
    const id = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const refreshedAgo = (() => {
    const m = Math.round((Date.now() - refreshedAt) / 60_000);
    if (m < 1) return 'now';
    return `${m}m ago`;
  })();

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
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>
          Anthropic spend
        </h2>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
          aggregates cap_skill_calls + cockpit_audit_log · refreshed{' '}
          {refreshedAgo}
          {pending && (
            <span style={{ marginLeft: 6, color: TOKENS.sand }}>
              · refreshing…
            </span>
          )}
        </div>
      </div>

      {/* Totals row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 22,
        }}
      >
        <KpiTile label="Last 24h" totals={data.totals.h24} accent={TOKENS.terracotta} />
        <KpiTile label="Last 7d" totals={data.totals.d7} accent={TOKENS.ochre} />
        <KpiTile label="Last 30d" totals={data.totals.d30} accent={TOKENS.moss} />
      </div>

      {/* Two-column row: top tickets 24h + top agents 7d */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
          gap: 16,
        }}
      >
        <section
          style={{
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            borderRadius: 2,
          }}
        >
          <SectionHeader>Top tickets (24h)</SectionHeader>
          {data.topTickets24h.length === 0 ? (
            <Empty>No spend tied to tickets in 24h.</Empty>
          ) : (
            <table
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}
            >
              <thead>
                <tr>
                  <th style={th}>Ticket</th>
                  <th style={thRight}>Cost</th>
                  <th style={thRight}>Runs</th>
                  <th style={th}>Agents</th>
                </tr>
              </thead>
              <tbody>
                {data.topTickets24h.map((t) => (
                  <tr
                    key={t.ticket_id}
                    style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}
                  >
                    <td style={td}>
                      <Link
                        href={`/cockpit-v2/tasks/${t.ticket_id}`}
                        style={{
                          color: TOKENS.ochre,
                          fontFamily: MONO,
                          textDecoration: 'none',
                          fontSize: 12,
                        }}
                      >
                        #{t.ticket_id}
                      </Link>
                    </td>
                    <td
                      style={{
                        ...tdRight,
                        fontFamily: MONO,
                        color: TOKENS.ink,
                        fontWeight: 600,
                      }}
                    >
                      {fmtUsd(t.cost_usd)}
                    </td>
                    <td
                      style={{
                        ...tdRight,
                        fontFamily: MONO,
                        color: TOKENS.text2,
                      }}
                    >
                      {t.runs}
                    </td>
                    <td
                      style={{
                        ...td,
                        fontFamily: MONO,
                        color: TOKENS.text3,
                        maxWidth: 280,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={t.agents.join(', ')}
                    >
                      {t.agents.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section
          style={{
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            borderRadius: 2,
          }}
        >
          <SectionHeader>Top agents (7d)</SectionHeader>
          {data.topAgents7d.length === 0 ? (
            <Empty>No agent spend in 7d.</Empty>
          ) : (
            <table
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}
            >
              <thead>
                <tr>
                  <th style={th}>Agent</th>
                  <th style={thRight}>Cost</th>
                  <th style={thRight}>Runs</th>
                  <th style={thRight}>Avg / run</th>
                </tr>
              </thead>
              <tbody>
                {data.topAgents7d.map((a) => (
                  <tr
                    key={a.agent}
                    style={{ borderBottom: `1px solid ${TOKENS.borderSoft}` }}
                  >
                    <td
                      style={{
                        ...td,
                        fontFamily: MONO,
                        color: TOKENS.text2,
                      }}
                    >
                      {a.agent}
                    </td>
                    <td
                      style={{
                        ...tdRight,
                        fontFamily: MONO,
                        color: TOKENS.ink,
                        fontWeight: 600,
                      }}
                    >
                      {fmtUsd(a.cost_usd)}
                    </td>
                    <td
                      style={{
                        ...tdRight,
                        fontFamily: MONO,
                        color: TOKENS.text2,
                      }}
                    >
                      {a.runs}
                    </td>
                    <td
                      style={{
                        ...tdRight,
                        fontFamily: MONO,
                        color: TOKENS.text3,
                      }}
                    >
                      {fmtUsd(a.avg_cost_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  totals,
  accent,
}: {
  label: string;
  totals: { cost_usd: number; runs: number; tokens_in: number; tokens_out: number };
  accent: string;
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: TOKENS.bgRaised,
        border: `1px solid ${TOKENS.border}`,
        borderLeft: `3px solid ${accent}`,
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
        {label}
      </div>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 28,
          color: TOKENS.ink,
          margin: '4px 0',
          fontStyle: 'italic',
        }}
      >
        {fmtUsd(totals.cost_usd)}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
        {totals.runs} runs · in {fmtNum(totals.tokens_in)} · out{' '}
        {fmtNum(totals.tokens_out)}
      </div>
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
    <div style={{ padding: 14, color: TOKENS.text3, fontSize: 12 }}>
      {children}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: 0.6,
  color: TOKENS.text3,
  textTransform: 'uppercase',
  borderBottom: `1px solid ${TOKENS.border}`,
};
const thRight: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '6px 12px' };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right' };
