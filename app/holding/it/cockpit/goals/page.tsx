// app/holding/it/cockpit/goals/page.tsx
// Goals cockpit — the goal stack (governance.goals via public.v_goals) + founder intake.
// PBS 2026-07-25: "get the goal layers under control once and for all".
// PBS 2026-07-25 Bug #82: added v_goals_with_briefs fetch + answered_by in intake.
// Reads via service role against the public bridge view (claude_md 0.5).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { GoalsView, type GoalRow, type IntakeRow, type BriefRow } from './GoalsView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CockpitGoalsPage() {
  const sb = getSupabaseAdmin();
  const [
    { data: goals, error: gErr },
    { data: intake },
    { data: briefs },
  ] = await Promise.all([
    sb.from('v_goals')
      .select('goal_id, level, parent_goal_id, slug, title, description, measurable_target, target_metric, target_operator, target_value, property_id, status, review_cadence, ratified_at, updated_at')
      .order('level', { ascending: true })
      .order('goal_id', { ascending: true }),
    sb.from('v_goal_intake').select('block, question, answer, updated_at, answered_by'),
    sb.from('v_goals_with_briefs').select('goal_id, goal_slug, brief_slug, brief_status, brief_version, brief_last_edit, status_bulb'),
  ]);
  if (gErr) {
    return <div style={{ padding: 24, color: 'var(--ink)' }}>Failed to load goals: {gErr.message}</div>;
  }
  return (
    <GoalsView
      goals={(goals || []) as GoalRow[]}
      intake={(intake || []) as IntakeRow[]}
      briefs={(briefs || []) as BriefRow[]}
    />
  );
}
