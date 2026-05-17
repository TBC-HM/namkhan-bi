// app/cockpit-v2/skills/page.tsx
//
// Skills cockpit — reads via getSupabaseAdmin() against PUBLIC views, since
// PostgREST only exposes the public schema (claude_md §0.5). Previous
// sbCockpit approach silently returned [] because cockpit schema is not
// in the exposed schemas list. Views used:
//   public.cockpit_skills_catalog     — cockpit.cap_skills (all cols incl. category)
//   public.cockpit_agent_role_skills  — cockpit.cap_agent_skills (role,skill_id,enabled)
//   public.cockpit_skill_calls        — cockpit.cap_skill_calls

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import { SkillsTable } from './SkillsTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchSkillsData() {
  const admin = getSupabaseAdmin();
  const [{ data: skills }, { data: agentSkills }, { data: calls7d }] = await Promise.all([
    admin.from('cockpit_skills_catalog')
      .select('id, name, description, category, authority_level, requires_pbs_approval, estimated_cost_usd_milli, cost_class, active, implementation_type, archived_at, handler, error_codes')
      .order('name'),
    admin.from('cockpit_agent_role_skills').select('role, skill_id, enabled'),
    admin.from('cockpit_skill_calls')
      .select('skill_id, status, duration_ms, cost_usd_milli')
      .gt('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
  ]);

  const grantsBySkill = new Map<number, Set<string>>();
  for (const g of agentSkills ?? []) {
    if (g.enabled === false) continue;
    if (!grantsBySkill.has(g.skill_id)) grantsBySkill.set(g.skill_id, new Set());
    grantsBySkill.get(g.skill_id)!.add(g.role);
  }

  const callsBySkill = new Map<number, { n: number; errors: number; cost: number }>();
  for (const c of calls7d ?? []) {
    const cur = callsBySkill.get(c.skill_id) ?? { n: 0, errors: 0, cost: 0 };
    cur.n += 1;
    if (c.status === 'error' || c.status === 'failed') cur.errors += 1;
    cur.cost += Number(c.cost_usd_milli) || 0;
    callsBySkill.set(c.skill_id, cur);
  }

  const rows = (skills ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    authority_level: s.authority_level,
    requires_pbs_approval: s.requires_pbs_approval,
    cost_class: s.cost_class,
    estimated_cost_usd_milli: s.estimated_cost_usd_milli,
    active: s.active !== false,
    archived: s.archived_at != null,
    implementation_type: s.implementation_type,
    agentCount: grantsBySkill.get(s.id)?.size ?? 0,
    calls7d: callsBySkill.get(s.id)?.n ?? 0,
    errors7d: callsBySkill.get(s.id)?.errors ?? 0,
    cost7d: (callsBySkill.get(s.id)?.cost ?? 0) / 1000,
  }));

  return {
    rows,
    total: rows.length,
    orphan: rows.filter((r) => r.agentCount === 0 && !r.archived).length,
    archived: rows.filter((r) => r.archived).length,
    approval: rows.filter((r) => r.requires_pbs_approval).length,
    totalCalls7d: rows.reduce((s, r) => s + r.calls7d, 0),
    totalErrors7d: rows.reduce((s, r) => s + r.errors7d, 0),
  };
}

export default async function SkillsPage() {
  const d = await fetchSkillsData();

  return (
    <div style={{ color: TOKENS.text }}>
      <header style={{ marginBottom: 14, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, color: TOKENS.ink, margin: 0, fontWeight: 500 }}>Skills catalog</h1>
        <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>cockpit.cap_skills · {d.total} rows</span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
        <Stat label="Total"            value={d.total} />
        <Stat label="Orphan (0 agents)" value={d.orphan} tone={d.orphan > 0 ? '#E07856' : TOKENS.text3} />
        <Stat label="Approval-gated"   value={d.approval} tone={TOKENS.brass} />
        <Stat label="Archived"         value={d.archived} tone={TOKENS.text3} />
        <Stat label="Calls (7d)"       value={d.totalCalls7d} />
        <Stat label="Errors (7d)"      value={d.totalErrors7d} tone={d.totalErrors7d > 0 ? '#E07856' : TOKENS.forest} />
      </div>

      <SkillsTable rows={d.rows} />

      <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 10, color: TOKENS.text3 }}>
        Click any row → /cockpit-v2/skills/[id] for description · agents granted · invocations · errors · handler.
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div style={{ padding: '10px 12px', background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 2 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: TOKENS.text3 }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 22, color: tone ?? TOKENS.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}
