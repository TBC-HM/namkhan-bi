// app/revenue/compset/agent-settings/page.tsx
// Revenue · Comp Set · Agents — runtime knobs (RM-editable) + mandate rules (owner-only).
// Server component that loads both compset agents from public.v_compset_agent_settings.
//
// Uses ?agent=<code> URL param to switch between compset_agent (default) and comp_discovery_agent.
//
// API route used by editor:
//   POST /api/compset/agent-runtime  -> compset_update_agent_runtime

import Link from 'next/link';
import Page from '@/components/page/Page';
import { REVENUE_SUBPAGES } from '../../_subpages';
import StatusPill from '@/components/ui/StatusPill';
import { supabase } from '@/lib/supabase';
import { fmtTableUsd } from '@/lib/format';

import AgentSelectorTabs from '../_components/agent/AgentSelectorTabs';
import AgentSettingsEditor from '../_components/agent/AgentSettingsEditor';
import MandateRulesTable from '../_components/agent/MandateRulesTable';
import AgentRunHistoryTable from '../_components/AgentRunHistoryTable';
import type { AgentRunSummaryRow } from '../_components/types';
import type { AgentSettingsRow, MandateRule } from '../_components/scoring/types';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { agent?: string };
}

const AGENT_CODES = ['compset_agent', 'comp_discovery_agent'] as const;

async function loadAgents(): Promise<AgentSettingsRow[]> {
  const { data } = await supabase
    .from('v_compset_agent_settings')
    .select('*')
    .in('code', AGENT_CODES as unknown as string[]);
  const rows = (data ?? []) as AgentSettingsRow[];
  // Stable order: compset_agent first
  return rows.sort((a, b) => {
    const ai = AGENT_CODES.indexOf(a.code as (typeof AGENT_CODES)[number]);
    const bi = AGENT_CODES.indexOf(b.code as (typeof AGENT_CODES)[number]);
    return ai - bi;
  });
}

async function loadRunsForAgent(agentCode: string): Promise<AgentRunSummaryRow[]> {
  const { data } = await supabase
    .schema('governance')
    .from('agent_run_summary')
    .select('*')
    .eq('agent_code', agentCode)
    .order('started_at', { ascending: false })
    .limit(20);
  return (data ?? []) as AgentRunSummaryRow[];
}

const PANEL_STYLE: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '22px 24px',
  marginTop: 18,
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-xl)',
  fontWeight: 500,
  margin: 0,
};

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--ls-extra)',
  color: 'var(--ink-mute)',
  marginBottom: 4,
  display: 'block',
};

export default async function AgentSettingsPage({ searchParams }: PageProps) {
  const agents = await loadAgents();
  const selectedCode =
    searchParams?.agent && agents.some((a) => a.code === searchParams.agent)
      ? searchParams.agent
      : agents[0]?.code ?? 'compset_agent';
  const agent = agents.find((a) => a.code === selectedCode);
  const runs = agent ? await loadRunsForAgent(agent.code) : [];
  const successCount = runs.filter((r) => r.status === 'success').length;
  const failedCount = runs.filter((r) => r.status === 'failed').length;
  const totalCost = runs.reduce((s, r) => s + (r.cost_usd ?? 0), 0);

  return (
    <Page
      eyebrow="Revenue · Comp Set · Agents"
      title={<>Tune the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>knobs</em>, respect the mandate.</>}
      subPages={REVENUE_SUBPAGES}
      topRight={<Link href="/revenue/compset" style={backLinkStyle}>← BACK TO COMP SET</Link>}
    >

      {agents.length === 0 ? (
        <div
          style={{
            ...PANEL_STYLE,
            textAlign: 'center',
            color: 'var(--ink-mute)',
          }}
        >
          No compset agents found in <code style={inlineCodeStyle}>governance.agents</code>.
          Seed compset_agent or comp_discovery_agent to begin.
        </div>
      ) : (
        <>
          <AgentSelectorTabs agents={agents} selectedCode={selectedCode} />

          {agent && (
            <>
              {/* Agent header card */}
              <div style={PANEL_STYLE}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="t-eyebrow">{agent.pillar ?? 'AGENT'}</div>
                    <h2 style={{ ...SECTION_TITLE_STYLE, marginTop: 6 }}>
                      {agent.name}
                    </h2>
                    <div
                      style={{
                        marginTop: 6,
                        color: 'var(--ink-mute)',
                        fontSize: 'var(--t-sm)',
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      <code style={inlineCodeStyle}>{agent.code}</code>
                      {' · agent_id '}
                      <code style={inlineCodeStyle}>{agent.agent_id.slice(0, 8)}</code>
                    </div>
                  </div>
                  <div>
                    <StatusPill tone={statusTone(agent.status)}>
                      {(agent.status ?? 'unknown').toUpperCase()}
                    </StatusPill>
                  </div>
                </div>
              </div>

              <AgentSettingsEditor agent={agent} />

              {/* MANDATE-LOCKED RULES */}
              <MandateBlock agent={agent} />

              {/* RUN HISTORY — last 20 runs of this agent */}
              <div style={{ ...PANEL_STYLE, padding: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '18px 22px',
                    borderBottom: '1px solid var(--paper-deep)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div className="t-eyebrow">RUN HISTORY</div>
                    <h2 style={{ ...SECTION_TITLE_STYLE, marginTop: 6 }}>
                      Last {runs.length} run{runs.length === 1 ? '' : 's'}
                    </h2>
                    <div
                      style={{
                        color: 'var(--ink-mute)',
                        fontSize: 'var(--t-sm)',
                        marginTop: 4,
                      }}
                    >
                      {successCount} success · {failedCount} failed · {fmtTableUsd(totalCost)} total cost
                    </div>
                  </div>
                </div>
                {runs.length === 0 ? (
                  <div
                    style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: 'var(--ink-mute)',
                    }}
                  >
                    No runs captured yet for{' '}
                    <code style={inlineCodeStyle}>{agent.code}</code>.
                  </div>
                ) : (
                  <AgentRunHistoryTable rows={runs} />
                )}
              </div>
            </>
          )}
        </>
      )}
    </Page>
  );
}

function statusTone(s: string | null): 'active' | 'pending' | 'inactive' | 'expired' | 'info' {
  switch ((s ?? '').toLowerCase()) {
    case 'active':
    case 'live':
      return 'active';
    case 'beta':
    case 'pending':
    case 'planned':
      return 'pending';
    case 'paused':
    case 'inactive':
    case 'idle':
      return 'inactive';
    case 'failed':
      return 'expired';
    default:
      return 'info';
  }
}

function MandateBlock({ agent }: { agent: AgentSettingsRow }) {
  const locked = agent.locked_by_mandate ?? {};
  const monthlyBudget = locked.monthly_budget_usd ?? null;
  const mtdCost = locked.month_to_date_cost_usd ?? 0;
  const mandateRules: MandateRule[] = Array.isArray(locked.mandate_rules)
    ? (locked.mandate_rules as MandateRule[])
    : [];

  const pct =
    monthlyBudget && monthlyBudget > 0
      ? Math.min(100, (mtdCost / monthlyBudget) * 100)
      : 0;

  return (
    <div
      style={{
        background: 'var(--st-bad-bg)',
        border: '1px solid var(--st-bad-bd)',
        borderLeft: '4px solid var(--st-bad)',
        borderRadius: 8,
        padding: 0,
        marginTop: 18,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '22px 24px' }}>
        <div
          style={{
            ...LABEL_STYLE,
            color: 'var(--st-bad)',
          }}
        >
          🔒 OWNER-ONLY · MANDATE-LOCKED RULES
        </div>
        <h2
          style={{
            ...SECTION_TITLE_STYLE,
            marginTop: 4,
          }}
        >
          Mandate rules
        </h2>
        <div
          style={{
            color: 'var(--ink-soft)',
            fontSize: 'var(--t-sm)',
            marginTop: 4,
          }}
        >
          The owner sets these via a published mandate. RM cannot edit.
        </div>

        {/* Budget cell */}
        <div
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          <div
            style={{
              background: 'var(--paper-warm)',
              border: '1px solid var(--paper-deep)',
              borderRadius: 8,
              padding: '14px 16px',
            }}
          >
            <div style={LABEL_STYLE}>Monthly budget</div>
            <div
              style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 'var(--t-2xl)',
                fontWeight: 500,
                lineHeight: 1.1,
              }}
            >
              {fmtTableUsd(monthlyBudget)}
            </div>
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-mute)',
                letterSpacing: 'var(--ls-loose)',
                textTransform: 'uppercase',
              }}
            >
              <span>MTD spend {fmtTableUsd(mtdCost)}</span>
              <span>{pct.toFixed(0)}% of budget</span>
            </div>
            <div
              style={{
                marginTop: 6,
                height: 6,
                background: 'var(--paper-deep)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background:
                    pct >= 90
                      ? 'var(--st-bad)'
                      : pct >= 70
                        ? 'var(--brass)'
                        : 'var(--moss-glow)',
                }}
              />
            </div>
          </div>
          <div
            style={{
              background: 'var(--paper-warm)',
              border: '1px solid var(--paper-deep)',
              borderRadius: 8,
              padding: '14px 16px',
            }}
          >
            <div style={LABEL_STYLE}>Active mandate rules</div>
            <div
              style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 'var(--t-2xl)',
                fontWeight: 500,
                lineHeight: 1.1,
              }}
            >
              {mandateRules.length}
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-mute)',
                letterSpacing: 'var(--ls-loose)',
                textTransform: 'uppercase',
              }}
            >
              {mandateRules.filter((r) => r.severity === 'block').length} block
              {' · '}
              {mandateRules.filter((r) => r.severity === 'warn').length} warn
            </div>
          </div>
        </div>
      </div>

      <MandateRulesTable rows={mandateRules} />

      <div
        style={{
          padding: '12px 22px',
          borderTop: '1px solid var(--paper-deep)',
          background: 'var(--paper)',
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-loose)',
          textTransform: 'uppercase',
          color: 'var(--ink-mute)',
        }}
      >
        Mandate changes require an owner to publish a new mandate version. Contact PBS.
      </div>
    </div>
  );
}

const backLinkStyle: React.CSSProperties = {
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
  border: '1px solid var(--paper-deep)',
  background: 'var(--paper-warm)',
  color: 'var(--ink-soft)',
  textDecoration: 'none',
};

const inlineCodeStyle: React.CSSProperties = {
  margin: '0 4px',
  padding: '1px 6px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  background: 'var(--paper)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 3,
};
