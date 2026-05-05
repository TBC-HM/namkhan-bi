// app/revenue/compset/_components/TopStrip.tsx
// Top 4-cell strip: Comp Set Agent · Last Run · MTD Cost · Next Major Event.

import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, EMPTY } from '@/lib/format';
import type { AgentRow, AgentRunSummaryRow, UpcomingEventRow } from './types';
import RunNowButtons from './RunNowButtons';

const AGENT_STATUS_TONE: Record<string, StatusTone> = {
  active: 'active',
  beta: 'pending',
  planned: 'inactive',
  paused: 'inactive',
};

const RUN_STATUS_TONE: Record<string, StatusTone> = {
  success: 'active',
  partial: 'pending',
  failed: 'expired',
  running: 'info',
};

function fmtRelative(minutes: number | null | undefined): string {
  if (minutes == null) return EMPTY;
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round(minutes - h * 60);
    return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Props {
  agent: AgentRow | null;
  lastRun: AgentRunSummaryRow | null;
  nextEvent: UpcomingEventRow | null;
}

export default function TopStrip({ agent, lastRun, nextEvent }: Props) {
  const budget = Number(agent?.monthly_budget_usd ?? 0);
  const spent = Number(agent?.month_to_date_cost_usd ?? 0);
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  const agentStatus = (agent?.status ?? 'planned').toLowerCase();
  const agentTone: StatusTone = AGENT_STATUS_TONE[agentStatus] ?? 'inactive';

  const runStatus = (lastRun?.status ?? '').toLowerCase();
  const runTone: StatusTone = RUN_STATUS_TONE[runStatus] ?? 'inactive';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr',
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 8,
        marginTop: 14,
      }}
    >
      {/* Cell 1: Agent + Run Now */}
      <div style={cellStyle}>
        <div className="t-eyebrow">COMP SET AGENT</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
            flexWrap: 'wrap',
          }}
        >
          <StatusPill tone={agentTone}>{agentStatus.toUpperCase()}</StatusPill>
          <span
            style={{
              color: 'var(--ink-mute)',
              fontSize: 'var(--t-sm)',
              fontFamily: 'var(--mono)',
            }}
          >
            {agent?.model_id ?? EMPTY}
          </span>
        </div>
        <RunNowButtons agentStatus={agentStatus} />
      </div>

      {/* Cell 2: Last Run */}
      <div style={{ ...cellStyle, borderLeft: '1px solid var(--paper-deep)' }}>
        <div className="t-eyebrow">LAST RUN</div>
        <div
          style={{
            marginTop: 8,
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-lg)',
          }}
        >
          {lastRun ? fmtRelative(lastRun.minutes_ago) : EMPTY}
        </div>
        <div
          style={{
            marginTop: 6,
            color: 'var(--ink-mute)',
            fontSize: 'var(--t-sm)',
            display: 'inline-flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {lastRun ? (
            <>
              <StatusPill tone={runTone}>{runStatus.toUpperCase()}</StatusPill>
              <span style={{ fontFamily: 'var(--mono)' }}>
                {lastRun.proposals_created ?? 0} obs
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>
              No runs yet
            </span>
          )}
        </div>
      </div>

      {/* Cell 3: MTD Cost */}
      <div style={{ ...cellStyle, borderLeft: '1px solid var(--paper-deep)' }}>
        <div className="t-eyebrow">MTD COST</div>
        <div
          style={{
            marginTop: 8,
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-lg)',
          }}
        >
          {fmtTableUsd(spent)}{' '}
          <span
            style={{
              color: 'var(--ink-mute)',
              fontSize: 'var(--t-md)',
            }}
          >
            / {fmtTableUsd(budget)}
          </span>
        </div>
        <div
          style={{
            marginTop: 8,
            height: 4,
            background: 'var(--paper-deep)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background:
                pct > 80 ? 'var(--st-bad)' : pct > 50 ? 'var(--brass)' : 'var(--moss)',
            }}
          />
        </div>
        <div
          style={{
            marginTop: 6,
            color: 'var(--ink-mute)',
            fontSize: 'var(--t-sm)',
          }}
        >
          {pct}% of monthly cap
        </div>
      </div>

      {/* Cell 4: Next major event */}
      <div style={{ ...cellStyle, borderLeft: '1px solid var(--paper-deep)' }}>
        <div className="t-eyebrow">NEXT MAJOR EVENT</div>
        <div
          style={{
            marginTop: 8,
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-xl)',
            fontWeight: 500,
          }}
        >
          {nextEvent?.display_name ?? EMPTY}
        </div>
        <div
          style={{
            color: 'var(--ink-mute)',
            fontSize: 'var(--t-sm)',
            fontFamily: 'var(--mono)',
            marginTop: 4,
          }}
        >
          {nextEvent ? (
            <>
              {nextEvent.days_until_event != null ? `${nextEvent.days_until_event} days` : EMPTY}
              {nextEvent.demand_score != null && ` · score ${nextEvent.demand_score}`}
            </>
          ) : (
            <span style={{ fontStyle: 'italic' }}>No events scheduled</span>
          )}
        </div>
        {nextEvent?.source_markets && nextEvent.source_markets.length > 0 && (
          <div
            style={{
              marginTop: 4,
              fontSize: 'var(--t-xs)',
              color: 'var(--ink-faint)',
              fontFamily: 'var(--mono)',
              letterSpacing: 'var(--ls-loose)',
            }}
          >
            {nextEvent.source_markets.join(' · ').toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '18px 20px',
};

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  fontWeight: 600,
  borderRadius: 4,
  border: 'none',
};
