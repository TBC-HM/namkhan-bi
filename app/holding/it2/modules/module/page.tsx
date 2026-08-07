// app/holding/it2/modules/module/page.tsx
// Intake LEVEL 2 — a TENANT starts a module for their own property.
// Sibling of "+ Intake" (level 1 = building the platform itself, PBS/TBC operator).
// Level 1 is NOT replaced and NOT redirected — PBS retires it only once this is proven.
//
// Spec: cockpit.prototype_specs slug='intake-v2-single-surface'. Brief: intake-l2-s4-page.
// Decisions: ADR-260, ADR-262.
//
// v2 2026-08-07 — §10.6 gap closure: tenant-scoped goals (a GM must never be offered
// holding goals), the open interview question, dismiss/approve wiring.
//
// Completeness is DERIVED server-side via public.fn_intake_completeness(slug).
// Never accept a percentage from the client and never store one.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ModuleIntakeClient, {
  type GoalOption, type IntakeRow, type PropertyOption,
} from './ModuleIntakeClient';

export const dynamic = 'force-dynamic';

const STALE_DAYS = 30;

export default async function ModuleIntakePage() {
  let goals: GoalOption[] = [];
  let properties: PropertyOption[] = [];
  let intakes: IntakeRow[] = [];

  try {
    const sb = getSupabaseAdmin();

    const { data: propData } = await sb
      .from('v_tenancy_properties')
      .select('property_id, display_name, status')
      .eq('status', 'active')
      .order('property_id', { ascending: true });
    properties = (propData ?? []).map(p => ({
      property_id: p.property_id as number,
      name: p.display_name as string,
    }));

    // TENANT goals only. v_tenant_goals excludes every holding/platform goal by
    // definition (property_id IS NOT NULL), so "Constitution consolidation" and
    // friends can never appear in front of a hotel GM.
    const { data: goalData } = await sb
      .from('v_tenant_goals')
      .select('goal_id, property_id, title, level')
      .order('property_id', { ascending: true })
      .order('level', { ascending: true });
    goals = (goalData ?? []).map(g => ({
      goal_id: g.goal_id as number,
      property_id: g.property_id as number,
      title: g.title as string,
      level: g.level as number,
    }));

    const { data: specRows } = await sb
      .from('v_prototype_specs')
      .select('id, slug, title, status, property_scope, property_id, goal_id, updated_at, open_question, dismissed_reason')
      .in('status', ['draft', 'queued', 'building', 'verifying', 'needs_schema', 'abandoned'])
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
      const q = row.open_question as {
        field?: string; question?: string; context?: string; options?: string[];
        free_text?: string; rephrase?: string;
      } | null;
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
        open_question: q,
        dismissed_reason: (row.dismissed_reason as string | null) ?? null,
      };
    }));
  } catch {
    goals = []; properties = []; intakes = [];
  }

  const live = intakes.filter(i => i.status !== 'abandoned');
  const kpis = {
    open: live.length,
    waiting: live.filter(i => i.open_question).length,
    ready: live.filter(i => i.ready).length,
    idle: live.filter(i => i.idle_days >= STALE_DAYS).length,
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
        <ModuleIntakeClient
          goals={goals}
          properties={properties}
          intakes={intakes}
          kpis={kpis}
          staleDays={STALE_DAYS}
        />
      </div>
    </DashboardPage>
  );
}
