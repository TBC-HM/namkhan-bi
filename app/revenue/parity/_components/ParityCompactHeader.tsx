// Compact agent header for /revenue/parity — mirrors compset's CompactAgentHeader
// but adapted to parity's data shape (no scrape-date picker; severity chips instead).
//
// 2 dense rows replace the previous 5-cell TopStrip block.

'use client';

import Link from 'next/link';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, EMPTY } from '@/lib/format';
import ParityRunButton from './ParityRunButton';

type AgentLike = {
  status: string | null;
  name: string | null;
  schedule_human: string | null;
  monthly_budget_usd: number | null;
  month_to_date_cost_usd: number | null;
};

type RunLike = {
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
};

type SummaryLike = {
  open_critical: number | null;
  open_high: number | null;
  open_medium: number | null;
  open_low: number | null;
  open_total: number | null;
  detected_7d: number | null;
} | null;

interface Props {
  agent: AgentLike | null;
  lastRun: RunLike | null;
  summary: SummaryLike;
  settingsLinks?: { href: string; label: string }[];
}

const AGENT_STATUS_TONE: Record<string, StatusTone> = {
  active: 'active', beta: 'pending', planned: 'inactive', paused: 'inactive',
};
const RUN_STATUS_TONE: Record<string, StatusTone> = {
  success: 'active', partial: 'pending', failed: 'expired', running: 'info',
};

function fmtRelMin(min: number | null | undefined): string {
  if (min == null) return EMPTY;
  if (min < 1) return 'just now';
  if (min < 60) return `${Math.round(min)}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ParityCompactHeader({
  agent, lastRun, summary, settingsLinks = [],
}: Props) {
  const status = (agent?.status ?? 'planned').toLowerCase();
  const runStatus = (lastRun?.status ?? '').toLowerCase();
  const minutesAgo = lastRun?.started_at
    ? Math.max(0, Math.floor((Date.now() - new Date(lastRun.started_at).getTime()) / 60_000))
    : null;
  const budget = Number(agent?.monthly_budget_usd ?? 0);
  const spent = Number(agent?.month_to_date_cost_usd ?? 0);
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  const oc = Number(summary?.open_critical ?? 0);
  const oh = Number(summary?.open_high ?? 0);
  const om = Number(summary?.open_medium ?? 0);
  const ol = Number(summary?.open_low ?? 0);
  const ot = Number(summary?.open_total ?? 0);
  const d7 = Number(summary?.detected_7d ?? 0);

  return (
    <div style={wrap}>
      {/* Row 1: agent | last check | MTD cost | open | critical | RUN NOW */}
      <div style={row1}>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 8 }}>AGENT</span>
          <StatusPill tone={AGENT_STATUS_TONE[status] ?? 'inactive'}>{status.toUpperCase()}</StatusPill>
          <span style={meta}>{agent?.name ?? 'parity_agent'}</span>
          {agent?.schedule_human && <span style={metaDim}>· {agent.schedule_human}</span>}
        </div>

        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>LAST CHECK</span>
          {lastRun ? (
            <>
              <StatusPill tone={RUN_STATUS_TONE[runStatus] ?? 'inactive'}>{runStatus.toUpperCase()}</StatusPill>
              <span style={meta}>{fmtRelMin(minutesAgo)}</span>
            </>
          ) : <span style={metaDim}>never</span>}
        </div>

        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>MTD COST</span>
          <span style={metaStrong}>{fmtTableUsd(spent)}</span>
          {budget > 0 && (
            <>
              <span style={metaDim}>/ {fmtTableUsd(budget)}</span>
              <span style={{
                ...metaDim,
                color: pct > 80 ? 'var(--st-bad)' : pct > 50 ? 'var(--brass)' : 'var(--ink-mute)',
              }}>· {pct}%</span>
            </>
          )}
        </div>

        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>OPEN</span>
          <span style={metaStrong}>{ot}</span>
          {d7 > 0 && <span style={metaDim}>· {d7} new 7d</span>}
        </div>

        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>CRITICAL</span>
          <span style={{
            ...metaStrong,
            color: oc > 0 ? 'var(--st-bad)' : 'var(--ink-mute)',
          }}>{oc}</span>
        </div>

        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ParityRunButton agentStatus={status} />
        </div>
      </div>

      {/* Row 2: severity chips + settings links */}
      <div style={row2}>
        <span className="t-eyebrow" style={{ marginRight: 6 }}>SEVERITY MIX</span>
        <div style={pillsWrap}>
          <Chip tone="bad" label="CRITICAL" n={oc} />
          <Chip tone="bad" label="HIGH" n={oh} />
          <Chip tone="warn" label="MEDIUM" n={om} />
          <Chip tone="dim" label="LOW" n={ol} />
        </div>
        <span style={metaDim}>· non-refund &gt; refund + DoD jumps</span>
        <span style={{ flex: 1 }} />
        {settingsLinks.map((l) => (
          <Link key={l.href} href={l.href} style={linkBtn}>{l.label}</Link>
        ))}
      </div>
    </div>
  );
}

function Chip({ tone, label, n }: { tone: 'bad' | 'warn' | 'dim'; label: string; n: number }) {
  const color = tone === 'bad' ? 'var(--st-bad)' : tone === 'warn' ? 'var(--brass)' : 'var(--ink-mute)';
  const bg = n > 0 ? 'var(--paper)' : 'var(--paper-warm)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px',
      background: bg,
      border: `1px solid ${n > 0 ? color : 'var(--paper-deep)'}`,
      borderRadius: 3,
      fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
      color: n > 0 ? color : 'var(--ink-faint)',
      fontWeight: n > 0 ? 600 : 400,
      letterSpacing: 'var(--ls-loose)',
    }}>
      {label} <span style={{ fontWeight: 600 }}>{n}</span>
    </span>
  );
}

const wrap: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  marginTop: 14,
  overflow: 'hidden',
};
const row1: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 18,
  padding: '10px 16px',
  borderBottom: '1px solid var(--paper-deep)',
  flexWrap: 'wrap',
};
const row2: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 16px',
  fontSize: 'var(--t-xs)',
  flexWrap: 'wrap',
};
const cell: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const meta: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)',
};
const metaStrong: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)', fontWeight: 600,
};
const metaDim: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)',
  letterSpacing: 'var(--ls-loose)',
};
const pillsWrap: React.CSSProperties = { display: 'inline-flex', gap: 4, flexWrap: 'wrap' };
const linkBtn: React.CSSProperties = {
  padding: '4px 10px',
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
  fontWeight: 600,
  background: 'var(--paper)',
  color: 'var(--ink-soft)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  textDecoration: 'none',
};
