// app/revenue/agents/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { supabase } from '@/lib/supabase';
import AgentsTable, { type AgentRow } from './_components/AgentsTableClient';
import { REVENUE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const SETTINGS_HREF: Record<string, string> = {
  compset_agent: '/revenue/compset/agent-settings',
  comp_discovery_agent: '/revenue/compset/agent-settings?agent=comp_discovery_agent',
  parity_agent: '/revenue/parity/agent-settings',
};

export default async function AgentsPage() {
  const { data: agentsR } = await supabase
    .schema('governance')
    .from('agents')
    .select('agent_id, code, name, status, schedule_human, monthly_budget_usd, month_to_date_cost_usd, last_run_at, pillar')
    .order('status', { ascending: true })
    .order('name', { ascending: true });
  const allAgents = (agentsR ?? []) as any[];
  const REV_RX = /revenue|compset|parity|rate|channel|pricing|pace|pulse|inventory|forecast|nimble/i;
  const agents = allAgents.filter((a) => (a.pillar ?? '').toLowerCase() === 'revenue' || REV_RX.test(a.code) || REV_RX.test(a.name));

  const codes = agents.map((a) => a.code);
  const lastRunByCode = new Map<string, any>();
  if (codes.length > 0) {
    const { data: runsR } = await supabase
      .schema('governance')
      .from('agent_run_summary')
      .select('agent_code, status, started_at')
      .in('agent_code', codes)
      .order('started_at', { ascending: false });
    for (const row of (runsR ?? []) as any[]) {
      if (!lastRunByCode.has(row.agent_code)) lastRunByCode.set(row.agent_code, row);
    }
  }

  const rows: AgentRow[] = agents.map((a) => {
    const lr = lastRunByCode.get(a.code) ?? null;
    return {
      agent_id: a.agent_id, code: a.code, name: a.name, status: a.status,
      schedule_human: a.schedule_human,
      monthly_budget_usd: a.monthly_budget_usd != null ? Number(a.monthly_budget_usd) : null,
      month_to_date_cost_usd: a.month_to_date_cost_usd != null ? Number(a.month_to_date_cost_usd) : null,
      last_run_at: a.last_run_at ?? lr?.started_at ?? null,
      last_run_status: lr?.status ?? null,
      settings_href: SETTINGS_HREF[a.code] ?? null,
    };
  });

  const total = rows.length;
  const active = rows.filter((r) => (r.status ?? '').toLowerCase() === 'active').length;
  const beta = rows.filter((r) => (r.status ?? '').toLowerCase() === 'beta').length;
  const failed = rows.filter((r) => (r.last_run_status ?? '').toLowerCase() === 'failed').length;
  const totalBudget = rows.reduce((s, r) => s + (r.monthly_budget_usd ?? 0), 0);
  const totalSpent = rows.reduce((s, r) => s + (r.month_to_date_cost_usd ?? 0), 0);

  return (
    <Page eyebrow="Revenue · Agents" title={<>Every agent on <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>watch</em> — schedule, status, MTD spend.</>} subPages={REVENUE_SUBPAGES}>
      <div style={statusWrap}>
        <div style={statusRow1}>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 8 }}>SOURCE</span><StatusPill tone="active">governance.agents</StatusPill></div>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 6 }}>REGISTERED</span><span style={metaStrong}>{total}</span></div>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 6 }}>ACTIVE</span><StatusPill tone="active">{active}</StatusPill></div>
          {beta > 0 && <div style={cell}><span className="t-eyebrow" style={{ marginRight: 6 }}>BETA</span><StatusPill tone="pending">{beta}</StatusPill></div>}
          <span style={{ flex: 1 }} />
        </div>
        <div style={statusRow2}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>FAILED RUNS</span>
          <StatusPill tone={failed > 0 ? 'expired' : 'active'}>{failed}</StatusPill>
          <span style={{ flex: 1 }} />
          <span style={metaDim}>MTD ${Math.round(totalSpent).toLocaleString()} / ${Math.round(totalBudget).toLocaleString()}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={total} unit="count" label="Agents registered" tooltip="Rows in governance.agents filtered to pillar=revenue." />
        <KpiBox value={active} unit="count" label="Active"             tooltip="Agents with status=active. Inactive ones don't run on schedule." />
        <KpiBox value={totalSpent} unit="usd" label="MTD spend"         tooltip="Sum of run costs (Sonnet pricing) for revenue agents this month." />
        <KpiBox value={totalBudget} unit="usd" label="Monthly budget"   tooltip="Sum of monthly_budget_usd across registered revenue agents. Spend > budget = warn." />
      </div>
      <div style={{ marginTop: 18 }}>
        <SectionHead title="Agents" emphasis="all registered" sub="Status · schedule · last run · MTD cost · budget · settings" source="governance.agents" />
        <AgentsTable rows={rows} />
      </div>
    </Page>
  );
}

function SectionHead({ title, emphasis, sub, source }: { title: string; emphasis?: string; sub?: string; source?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.1 }}>
          {title}
          {emphasis && <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>{emphasis}</span>}
        </div>
        {sub && <div style={{ marginTop: 2, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{sub}</div>}
      </div>
      {source && <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{source}</span>}
    </div>
  );
}

const statusWrap: React.CSSProperties = { background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, marginTop: 14, overflow: 'hidden' };
const statusRow1: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 18, padding: '10px 16px', borderBottom: '1px solid var(--paper-deep)', flexWrap: 'wrap' };
const statusRow2: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 'var(--t-xs)', flexWrap: 'wrap' };
const cell: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6 };
const metaStrong: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)', fontWeight: 600 };
const metaDim: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', letterSpacing: 'var(--ls-loose)' };
