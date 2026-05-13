// app/finance/agents/page.tsx — REDESIGN 2026-05-13 (wiring fix)
// PBS audit: the prior version queried governance.agents and
// governance.agent_run_summary — neither table exists. The canonical agent
// registry now lives at cockpit.id_agents (exposed via the public view
// cockpit_agent_identity). Runtime stats (MTD cost, last-run status) live
// in governance.agent_runs but can't be joined cleanly without agent_id on
// the public view — surfaced on /cockpit-v2 instead.
import Page from '@/components/page/Page';
import KpiBox from '@/components/kpi/KpiBox';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import AgentsTable, { type AgentRow } from '@/app/revenue/agents/_components/AgentsTableClient';
import { FINANCE_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface IdentityRow {
  role: string;
  display_name: string | null;
  tagline: string | null;
  dept: string | null;
  status: string | null;
  hierarchy_level: string | null;
  property_id: number | null;
  updated_at: string | null;
}

export default async function FinanceAgentsPage() {
  // cockpit_agent_identity is the public wrapper view over cockpit.id_agents.
  // Filter to the active property + finance dept.
  const { data: agentsR } = await supabase
    .from('cockpit_agent_identity')
    .select('role, display_name, tagline, dept, status, hierarchy_level, property_id, updated_at')
    .eq('dept', 'finance')
    .eq('property_id', PROPERTY_ID)
    .order('hierarchy_level', { ascending: true })
    .order('role', { ascending: true });
  const agents = (agentsR ?? []) as IdentityRow[];

  const rows: AgentRow[] = agents.map((a) => ({
    agent_id: a.role,
    code: a.role,
    name: a.display_name ?? a.role,
    status: a.status,
    schedule_human: a.hierarchy_level === 'hod' ? 'HoD · on-demand' : (a.tagline ?? null),
    monthly_budget_usd: null,
    month_to_date_cost_usd: null,
    last_run_at: a.updated_at,
    last_run_status: null,
    settings_href: null,
  }));

  const total = rows.length;
  const active = rows.filter((r) => (r.status ?? '').toLowerCase() === 'active').length;
  const dormant = rows.filter((r) => (r.status ?? '').toLowerCase() === 'dormant').length;
  const hod = agents.filter((a) => (a.hierarchy_level ?? '') === 'hod').length;

  const agentsEyebrow = [
    'Finance · Agents',
    'cockpit_agent_identity · dept=finance',
    `${total} registered · ${active} active · ${dormant} dormant`,
    `${hod} HoD`,
  ].filter(Boolean).join(' · ');

  return (
    <Page eyebrow={agentsEyebrow} title={<>Finance <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>watchers</em> — variance, AR/AP, cash, close.</>} subPages={FINANCE_SUBPAGES}>
      {/* ─── 1. KPI tiles ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiBox value={total}   unit="count" label="Agents registered" tooltip="Rows in cockpit_agent_identity filtered to dept=finance for the active property." />
        <KpiBox value={active}  unit="count" label="Active"             tooltip="Agents with status=active." />
        <KpiBox value={dormant} unit="count" label="Dormant"            tooltip="Agents with status=dormant — registered but not scheduled to run yet." />
        <KpiBox value={hod}     unit="count" label="HoDs"               tooltip="Head-of-Department agents at hierarchy_level=hod." />
      </div>

      {/* No period selector — registry view is global state. */}

      {/* ─── 4. Tables ──────────────────────────────────────────────── */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, marginBottom: 6 }}>Agents</div>
        <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginBottom: 10 }}>
          Runtime cost + last-run status live on <a href="/cockpit-v2" style={{ color: 'var(--brass)' }}>/cockpit-v2</a> — the cockpit_agent_identity view doesn&apos;t expose agent_id, so a cross-join to governance.agent_runs needs schema work first.
        </div>
        <AgentsTable rows={rows} />
      </div>
    </Page>
  );
}
