'use client';

// app/revenue/briefing/_components/BriefingFeed.tsx
// PBS 2026-07-15 — client-side feed for the Briefing page. Handles severity/
// area/status filters + per-row accept/dismiss/snooze/investigate CTAs.
// Every write goes through /api/revenue/briefing/decide (server → SECURITY
// DEFINER RPC fn_briefing_decide).

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export interface BriefingRow {
  id: number;
  property_id: number;
  source_area: string;
  source_key: string | null;
  severity: 'critical' | 'warn' | 'info' | 'opportunity';
  headline: string;
  body: string | null;
  cta_kind: 'accept' | 'dismiss' | 'edit' | 'investigate' | 'snooze' | 'link';
  cta_label: string | null;
  cta_target: string | null;
  cta_params: Record<string, unknown> | null;
  status: 'new' | 'accepted' | 'dismissed' | 'snoozed' | 'missed' | 'expired';
  snoozed_until: string | null;
  outcome_success: number | null;
  outcome_scored_at: string | null;
  decided_at: string | null;
  decided_reason: string | null;
  created_at: string;
}

interface Props { initial: BriefingRow[]; }

// PBS 2026-07-16: opportunity ranked above info — it's actionable upside, not noise.
// Sort order: critical → warn → opportunity → info.
const SEVERITY_RANK: Record<BriefingRow['severity'], number> = { critical: 0, warn: 1, opportunity: 2, info: 3 };
const SEVERITY_STYLE: Record<BriefingRow['severity'], { bg: string; ink: string; label: string }> = {
  critical:    { bg: '#FEE4E2', ink: '#912018', label: 'CRITICAL'    },
  warn:        { bg: '#FEF0C7', ink: '#93370D', label: 'WARN'        },
  opportunity: { bg: '#D1FADF', ink: '#054F31', label: 'OPPORTUNITY' },
  info:        { bg: '#EFF4FF', ink: '#1D2939', label: 'INFO'        },
};

const AREAS = [
  { key: 'all',              label: 'All'         },
  { key: 'revenue.parity',   label: 'Parity'      },
  { key: 'revenue.compset',  label: 'Comp set'    },
  { key: 'revenue.pace',     label: 'Pace'        },
  { key: 'revenue.leakage',  label: 'Leakage'     },
  { key: 'revenue.rateplans',label: 'Rate plans'  },
  { key: 'revenue.lighthouse',label: 'Lighthouse' },
  { key: 'revenue.demand',   label: 'Demand'      },
] as const;

const SEVERITIES = [
  { key: 'all',         label: 'All' },
  { key: 'critical',    label: 'Critical' },
  { key: 'warn',        label: 'Warn' },
  { key: 'opportunity', label: 'Opportunity' },
  { key: 'info',        label: 'Info' },
] as const;

const STATUSES = [
  { key: 'live',   label: 'Live (new + snoozed)' },
  { key: 'all',    label: 'All' },
  { key: 'new',    label: 'New only' },
  { key: 'done',   label: 'Decided (accepted + dismissed)' },
] as const;

export default function BriefingFeed({ initial }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<BriefingRow[]>(initial);
  const [sev, setSev] = useState<(typeof SEVERITIES)[number]['key']>('all');
  const [area, setArea] = useState<(typeof AREAS)[number]['key']>('all');
  const [status, setStatus] = useState<(typeof STATUSES)[number]['key']>('live');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    return rows
      .filter((r) => sev === 'all' || r.severity === sev)
      .filter((r) => area === 'all' || r.source_area === area)
      .filter((r) => {
        if (status === 'all')  return true;
        if (status === 'new')  return r.status === 'new';
        if (status === 'live') return r.status === 'new' || r.status === 'snoozed';
        if (status === 'done') return r.status === 'accepted' || r.status === 'dismissed';
        return true;
      })
      .sort((a, b) => {
        const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (s !== 0) return s;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [rows, sev, area, status]);

  async function decide(row: BriefingRow, decision: 'accept' | 'dismiss' | 'snooze', reason?: string) {
    setBusyId(row.id);
    setBanner(null);
    try {
      const res = await fetch('/api/revenue/briefing/decide', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id, decision, reason, snooze_hours: decision === 'snooze' ? 24 : undefined }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);

      // Optimistic local update
      setRows((prev) => prev.map((r) => r.id === row.id
        ? { ...r,
            status: decision === 'accept' ? 'accepted' : decision === 'dismiss' ? 'dismissed' : 'snoozed',
            decided_at: new Date().toISOString(),
            decided_reason: reason ?? null }
        : r));
      setBanner({ tone: 'ok', text: decision === 'accept' && j.cta_result
        ? `Accepted · CTA fired (${String(j.cta_result).slice(0, 60)})`
        : `${decision[0].toUpperCase()}${decision.slice(1)}ed · logged` });
      startTransition(() => router.refresh());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBanner({ tone: 'err', text: `Failed: ${msg}` });
    } finally {
      setBusyId(null);
    }
  }

  function onDismiss(row: BriefingRow) {
    const reason = window.prompt('Why dismiss?\n(handled · not_relevant · threshold · false_signal · other)', 'not_relevant');
    if (reason === null) return;
    void decide(row, 'dismiss', reason.trim() || 'not_relevant');
  }

  function openTarget(row: BriefingRow) {
    if (!row.cta_target) return;
    if (row.cta_target.startsWith('rpc:')) {
      setBanner({ tone: 'err', text: 'This CTA is an RPC — use Accept to fire it.' });
      return;
    }
    if (row.cta_target.startsWith('http')) {
      window.open(row.cta_target, '_blank', 'noopener,noreferrer');
    } else {
      router.push(row.cta_target);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={label}>Severity</span>
        {SEVERITIES.map((s) => (
          <button key={s.key} type="button" onClick={() => setSev(s.key)}
                  style={chip(sev === s.key)}>{s.label}</button>
        ))}
        <span style={{ ...label, marginLeft: 12 }}>Area</span>
        {AREAS.map((a) => (
          <button key={a.key} type="button" onClick={() => setArea(a.key)}
                  style={chip(area === a.key)}>{a.label}</button>
        ))}
        <span style={{ ...label, marginLeft: 12 }}>Status</span>
        {STATUSES.map((s) => (
          <button key={s.key} type="button" onClick={() => setStatus(s.key)}
                  style={chip(status === s.key)}>{s.label}</button>
        ))}
      </div>

      {banner && (
        <div style={{
          padding: '8px 12px', fontSize: 12, borderRadius: 4,
          background: banner.tone === 'ok' ? '#DCFAE6' : '#FEE4E2',
          color: banner.tone === 'ok' ? '#054F31' : '#912018',
        }}>{banner.text}{pending && ' · refreshing…'}</div>
      )}

      {/* Feed */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4 }}>
        {visible.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b6b6b', fontSize: 13 }}>
            Nothing matches the current filters. Try widening severity or area.
          </div>
        )}
        {visible.map((r, idx) => {
          const done = r.status === 'accepted' || r.status === 'dismissed';
          const scored = r.outcome_success != null;
          const sevStyle = SEVERITY_STYLE[r.severity];
          return (
            <div key={r.id} style={{
              display: 'grid',
              gridTemplateColumns: '96px 1fr auto',
              gap: 12, padding: '12px 14px',
              borderTop: idx === 0 ? 'none' : '1px solid #E6DFCC',
              opacity: done ? 0.72 : 1,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{
                  alignSelf: 'flex-start',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 10, letterSpacing: 1.2, padding: '3px 7px', borderRadius: 3,
                  background: sevStyle.bg, color: sevStyle.ink, fontWeight: 700,
                }}>{sevStyle.label}</span>
                <span style={{ fontSize: 11, color: '#6b6b6b' }}>
                  {r.source_area.replace('revenue.', '')}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1B1B1B', lineHeight: 1.35 }}>{r.headline}</div>
                {r.body && <div style={{ fontSize: 12, color: '#4a4a4a', marginTop: 4, lineHeight: 1.5 }}>{r.body}</div>}
                <div style={{ fontSize: 11, color: '#6b6b6b', marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>{fmtRel(r.created_at)}</span>
                  {r.status === 'snoozed' && r.snoozed_until && <span>snoozed until {fmtShort(r.snoozed_until)}</span>}
                  {done && r.decided_at && (
                    <span>
                      {r.status === 'accepted' ? '✓ accepted' : '× dismissed'} {fmtRel(r.decided_at)}
                      {r.decided_reason ? ` · ${r.decided_reason}` : ''}
                    </span>
                  )}
                  {r.status === 'accepted' && (
                    <span>{scored
                      ? `outcome: ${Math.round((r.outcome_success ?? 0) * 100)}%`
                      : 'measuring…'}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                {!done && r.status !== 'snoozed' && (
                  <>
                    <button type="button" disabled={busyId === r.id}
                            onClick={() => decide(r, 'accept')} style={btnPrimary}>
                      Accept {r.cta_label ? `· ${r.cta_label}` : ''}
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.cta_target && !r.cta_target.startsWith('rpc:') && (
                        <button type="button" disabled={busyId === r.id}
                                onClick={() => openTarget(r)} style={btnGhost}>Open</button>
                      )}
                      <button type="button" disabled={busyId === r.id}
                              onClick={() => decide(r, 'snooze')} style={btnGhost}>Snooze 24h</button>
                      <button type="button" disabled={busyId === r.id}
                              onClick={() => onDismiss(r)} style={btnGhost}>Dismiss</button>
                    </div>
                  </>
                )}
                {r.status === 'snoozed' && (
                  <button type="button" disabled={busyId === r.id}
                          onClick={() => decide(r, 'accept')} style={btnPrimary}>Accept now</button>
                )}
                {done && <span style={{ fontSize: 11, color: '#6b6b6b' }}>done</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────
const label: React.CSSProperties = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: 1,
  color: '#6b6b6b', marginRight: 4,
};
function chip(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px', fontSize: 11, borderRadius: 999,
    border: `1px solid ${active ? '#084838' : '#E6DFCC'}`,
    background: active ? '#084838' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#1B1B1B',
    cursor: 'pointer', fontWeight: active ? 600 : 500,
  };
}
const btnPrimary: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, fontWeight: 600,
  background: '#084838', color: '#FFFFFF', border: 'none', borderRadius: 4,
  cursor: 'pointer', whiteSpace: 'nowrap',
};
const btnGhost: React.CSSProperties = {
  padding: '5px 10px', fontSize: 11, fontWeight: 500,
  background: '#FFFFFF', color: '#1B1B1B',
  border: '1px solid #E6DFCC', borderRadius: 4, cursor: 'pointer',
};

// ─── helpers ────────────────────────────────────────────────────────────
function fmtRel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtShort(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}
