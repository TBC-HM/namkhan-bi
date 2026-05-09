// app/finance/agents/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { supabase } from '@/lib/supabase';
import AgentsTable, { type AgentRow } from '@/app/revenue/agents/_components/AgentsTableClient';
import { FINANCE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function FinanceAgentsPage() {
  const { data: agentsR } = await supabase
    .schema('governance')
    .from('agents')
    .select('agent_id, code, name, status, schedule_human, monthly_budget_usd, month_to_date_cost_usd, last_run_at, pillar')
    .order('status', { ascending: true })
    .order('name', { ascending: true });
  const allAgents = (agentsR ?? []) as any[];
  const FIN_RX = /finance|gl|usali|ledger|variance|cashflow|ar |ap |budget|expense|fx |close|payroll/i;
  const agents = allAgents.filter((a) => (a.pillar ?? '').toLowerCase() === 'finance' || FIN_RX.test(a.code) || FIN_RX.test(a.name));

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
      settings_href: null,
    };
  });

  const total = rows.length;
  const active = rows.filter((r) => (r.status ?? '').toLowerCase() === 'active').length;
  const failed = rows.filter((r) => (r.last_run_status ?? '').toLowerCase() === 'failed').length;
  const totalBudget = rows.reduce((s, r) => s + (r.monthly_budget_usd ?? 0), 0);
  const totalSpent = rows.reduce((s, r) => s + (r.month_to_date_cost_usd ?? 0), 0);

  return (
    <Page eyebrow="Finance · Agents" title={<>Finance <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>watchers</em> — variance, AR/AP, cash, close.</>} subPages={FINANCE_SUBPAGES}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '10px 16px', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, marginTop: 14 }}>
        <span className="t-eyebrow">SOURCE</span>
        <StatusPill tone="active">governance.agents</StatusPill>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>· pillar=finance · {active} active · {failed} failed runs</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={total} unit="count" label="Agents registered" />
        <KpiBox value={active} unit="count" label="Active" />
        <KpiBox value={totalSpent} unit="usd" label="MTD spend" />
        <KpiBox value={totalBudget} unit="usd" label="Monthly budget" />
      </div>
      <div style={{ marginTop: 18 }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, marginBottom: 6 }}>Agents</div>
        <AgentsTable rows={rows} />
      </div>
    </Page>
  );
}
