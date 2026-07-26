// app/holding/it/cockpit/specs/new/page.tsx
// PBS 2026-07-24: Guided spec questionnaire — produces a complete build brief
// that an autonomous agent can act on without further clarification.
// v2 2026-07-26 (spec-builder completion): fetches active governance goals
// (public.v_goals, level >= 2) server-side and passes them to the client so
// every saved brief carries a goal_id (ADR-165).

import { DashboardPage } from '@/app/(cockpit)/_design';
import { groupsAsTabs } from '@/app/holding/it/cockpit/_lib/groups';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import SpecBuilderClient from './SpecBuilderClient';
type GoalOption = { goal_id: number | null; slug: string; title: string; level: number };

export const dynamic = 'force-dynamic';

export default async function SpecNewPage() {
  let goals: GoalOption[] = [];
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('v_goals')
      .select('goal_id, slug, title, level, status')
      .eq('status', 'active')
      .gte('level', 2)
      .order('goal_id', { ascending: true });
    goals = (data ?? []).map(g => ({ goal_id: g.goal_id, slug: g.slug, title: g.title, level: g.level }));
  } catch {
    // Render the form anyway — the API rejects a missing goal_id, so nothing
    // orphaned can slip through even if the goal list fails to load.
    goals = [];
  }

  return (
    <DashboardPage
      title="Spec Builder"
      tabs={groupsAsTabs('build')}
      action={
        <a href="/holding/it/cockpit/specs" style={{ fontSize: 11, color: '#5A5A5A', textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          ← All specs
        </a>
      }
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 13, color: '#5A5A5A', marginBottom: 20, lineHeight: 1.6, maxWidth: 680 }}>
          Answer 7 sections to produce a spec that an agent can build against autonomously.
          Be specific — vague descriptions lead to wrong implementations.
          You can edit the brief after saving.
        </div>
        <SpecBuilderClient goals={goals} />
      </div>
    </DashboardPage>
  );
}
