// Compact agent header — replaces TopStrip + UtilBar + EventsStrip + ScrapeDatesPreview
// with a single 2-row dense block. Used on /revenue/compset and /revenue/parity.

'use client';

import Link from 'next/link';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';
import RunNowButtons from './RunNowButtons';
import type { AgentRow, AgentRunSummaryRow, ScrapeDateRow, UpcomingEventRow } from './types';

interface Props {
  agent: AgentRow | null;
  lastRun: AgentRunSummaryRow | null;
  nextEvent: UpcomingEventRow | null;
  pickDates: ScrapeDateRow[];
  events: UpcomingEventRow[];
  /** Settings pages to show as buttons. */
  settingsLinks?: { href: string; label: string }[];
  /** Hide RUN NOW (used on Parity where it's a different button). */
  hideRunNow?: boolean;
}

const AGENT_STATUS_TONE: Record<string, StatusTone> = {
  active: 'active', beta: 'pending', planned: 'inactive', paused: 'inactive',
};
const RUN_STATUS_TONE: Record<string, StatusTone> = {
  success: 'active', partial: 'pending', failed: 'expired', running: 'info',
};

function fmtRel(min: number | null | undefined): string {
  if (min == null) return EMPTY;
  if (min < 60) return `${Math.round(min)}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CompactAgentHeader({
  agent, lastRun, nextEvent, pickDates, events, settingsLinks = [], hideRunNow = false,
}: Props) {
  const status = (agent?.status ?? 'planned').toLowerCase();
  const runStatus = (lastRun?.status ?? '').toLowerCase();
  const budget = Number(agent?.monthly_budget_usd ?? 0);
  const spent = Number(agent?.month_to_date_cost_usd ?? 0);
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  return (
    <div style={wrap}>
      {/* Row 1: agent | last run | MTD cost | next event | RUN NOW */}
      <div style={row1}>
        <div style={cellLeft}>
          <span className="t-eyebrow" style={{ marginRight: 8 }}>AGENT</span>
          <StatusPill tone={AGENT_STATUS_TONE[status] ?? 'inactive'}>{status.toUpperCase()}</StatusPill>
          <span style={meta}>{agent?.name ?? 'compset_agent'}</span>
          {agent?.schedule_human && <span style={metaDim}>· {agent.schedule_human}</span>}
        </div>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>LAST RUN</span>
          {lastRun ? (
            <>
              <StatusPill tone={RUN_STATUS_TONE[runStatus] ?? 'inactive'}>{runStatus.toUpperCase()}</StatusPill>
              <span style={meta}>{fmtRel(lastRun.minutes_ago)}</span>
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
        {nextEvent && (
          <div style={cell}>
            <span className="t-eyebrow" style={{ marginRight: 6 }}>NEXT EVENT</span>
            <span style={meta}>{nextEvent.display_name}</span>
            {nextEvent.days_until_event != null && (
              <span style={metaDim}>· {nextEvent.days_until_event}d</span>
            )}
          </div>
        )}
        <span style={{ flex: 1 }} />
        {!hideRunNow && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <RunNowButtons agentStatus={status} />
          </div>
        )}
      </div>

      {/* Row 2: scrape dates pills + settings links + events count */}
      <div style={row2}>
        <span className="t-eyebrow" style={{ marginRight: 6 }}>NEXT SHOP</span>
        {pickDates.length === 0 ? (
          <span style={metaDim}>no dates picked</span>
        ) : (
          <div style={pillsWrap}>
            {pickDates.map((d) => (
              <span key={d.stay_date} style={datePill} title={d.events?.join(' · ')}>
                {fmtIsoDate(d.stay_date)}
                {(d.events ?? []).length > 0 && (
                  <span style={pillDot}>●</span>
                )}
              </span>
            ))}
          </div>
        )}
        <span style={metaDim}>· {pickDates.length} dates picked</span>
        <span style={{ flex: 1 }} />
        {events.length > 0 && (
          <span style={metaDim}>{events.length} upcoming events</span>
        )}
        {settingsLinks.map((l) => (
          <Link key={l.href} href={l.href} style={linkBtn}>{l.label}</Link>
        ))}
      </div>
    </div>
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
const cellLeft: React.CSSProperties = { ...cell };
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
const datePill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 8px',
  background: 'var(--paper)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink)',
};
const pillDot: React.CSSProperties = { color: 'var(--brass)', fontSize: 8 };
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
