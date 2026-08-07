// app/holding/it2/modules/module/page.tsx
// Intake LEVEL 2 — a TENANT starts a module for their own property.
// Sibling of "+ Intake" (level 1 = building the platform itself, PBS/TBC operator).
// Level 1 is NOT replaced and NOT redirected — PBS retires it only once this is proven.
//
// Spec: cockpit.prototype_specs slug='intake-v2-single-surface' (status=passed,
// approved_by=PBS 2026-08-07). Brief: intake-l2-s4-page. Decision: ADR-260.
//
// Input model: describe -> extract (existing md-intake evaluator) -> agent interview
// -> TBC track -> freeze. NO FORM: a hotel GM cannot complete 8 structured items, so
// the 16 completeness items are an EXTRACTION TARGET, not a questionnaire.
//
// Completeness is DERIVED server-side via public.fn_intake_completeness(slug).
// Never accept a percentage from the client and never store one.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ModuleIntakeClient, { type GoalOption, type IntakeRow } from './ModuleIntakeClient';

export const dynamic = 'force-dynamic';

const STALE_DAYS = 30;

export default async function ModuleIntakePage() {
  let goals: GoalOption[] = [];
  let intakes: IntakeRow[] = [];

  try {
    const sb = getSupabaseAdmin();

    const { data: goalData } = await sb
      .from('v_goals')
      .select('goal_id, slug, title, level, status')
      .eq('status', 'active')
      .gte('level', 2)
      .order('goal_id', { ascending: true });
    goals = (goalData ?? []).map(g => ({
      goal_id: g.goal_id, slug: g.slug, title: g.title, level: g.level,
    }));

    // Open intakes only. Shipped/promoted live on the Specs surface, not here.
    const { data: specRows } = await sb
      .from('v_prototype_specs')
      .select('id, slug, title, status, property_scope, goal_id, updated_at, approved_at')
      .in('status', ['draft', 'queued', 'building', 'verifying', 'needs_schema'])
      .order('updated_at', { ascending: false });

    intakes = await Promise.all((specRows ?? []).map(async row => {
      let tenantDone = 0, tbcDone = 0, pct = 0, ready = false;
      try {
        const { data: c } = await sb.rpc('fn_intake_completeness', { p_slug: row.slug });
        const j = c as { tenant?: { done?: number }; tbc?: { done?: number }; pct?: number; ready?: boolean } | null;
        tenantDone = j?.tenant?.done ?? 0;
        tbcDone = j?.tbc?.done ?? 0;
        pct = j?.pct ?? 0;
        ready = j?.ready ?? false;
      } catch {
        // A failed completeness read must NEVER render as complete.
        tenantDone = 0; tbcDone = 0; pct = 0; ready = false;
      }
      const idleDays = Math.floor(
        (Date.now() - new Date(row.updated_at as string).getTime()) / 86400000,
      );
      return {
        slug: row.slug as string,
        title: row.title as string,
        status: row.status as string,
        property_scope: (row.property_scope as string | null) ?? null,
        tenant_done: tenantDone,
        tbc_done: tbcDone,
        pct,
        ready,
        idle_days: idleDays,
      };
    }));
  } catch {
    // Render the surface anyway — the empty state explains the gap, and nothing can
    // be created without a goal link (ADR-165) even if this read fails.
    goals = []; intakes = [];
  }

  const kpis = {
    open: intakes.length,
    waiting: intakes.filter(i => i.status === 'needs_schema').length,
    ready: intakes.filter(i => i.ready).length,
    idle: intakes.filter(i => i.idle_days >= STALE_DAYS).length,
  };

  return (
    <DashboardPage
      title="New module"
      action={
        <a
          href="/holding/it2/modules/specs"
          style={{ fontSize: 11, color: '#5A5A5A', textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          ← All specs
        </a>
      }
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 13, color: '#5A5A5A', marginBottom: 20, lineHeight: 1.6, maxWidth: 680 }}>
          Describe what you want to be able to do — in your own words. No form, no
          jargon. We work out the rest and come back to you with anything we still
          need. Nothing gets built until you approve it.
        </div>
        <ModuleIntakeClient goals={goals} intakes={intakes} kpis={kpis} staleDays={STALE_DAYS} />
      </div>
    </DashboardPage>
  );
}
