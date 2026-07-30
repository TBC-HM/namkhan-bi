// app/h/[property_id]/settings/knowledge/page.tsx
// knowledge-goals-intake-v1 (PBS build order 2026-07-29): client Knowledge tab —
// tenant goal registry intake (big goals -> module goals) + guided judgment-doc
// question intake. Rows are canon (governance.tenant_goals / tenant_knowledge_answers,
// bridged via public.v_* views per claude_md L5); rendered MD docs + agent-draft
// approval cycle are the next stage of this brief and consume these rows.
// Completeness meter mirrors the /settings/property pattern (PBS: no second system).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import KnowledgeClient, {
  JUDGMENT_SECTIONS,
  type TenantGoalRow,
  type KnowledgeAnswerRow,
} from '@/components/settings/KnowledgeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function KnowledgeSettingsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  const sb = getSupabaseAdmin();

  const [{ data: goals, error: gErr }, { data: answers, error: aErr }] = await Promise.all([
    sb.from('v_tenant_goals')
      .select('goal_id, property_id, kind, parent_goal_id, module, title, description, metric, baseline, target_value, deadline, weight, guardrail_type, status, updated_at')
      .eq('property_id', propertyId)
      .order('kind', { ascending: true })
      .order('goal_id', { ascending: true }),
    sb.from('v_tenant_knowledge_answers')
      .select('section, question, answer, answered_by, updated_at')
      .eq('property_id', propertyId),
  ]);

  if (gErr || aErr) {
    return (
      <div style={{ padding: 24, color: 'var(--ink)' }}>
        Failed to load knowledge intake: {gErr?.message ?? aErr?.message}
      </div>
    );
  }

  const goalRows = (goals ?? []) as TenantGoalRow[];
  const answerRows = (answers ?? []) as KnowledgeAnswerRow[];

  // Completeness: goals section complete-ish when >= 1 big goal with >= 1 module goal;
  // each judgment section counts answered/total of its guided question set.
  const answeredBySection: Record<string, number> = {};
  answerRows.forEach((r) => {
    if (r.answer && r.answer.trim()) {
      answeredBySection[r.section] = (answeredBySection[r.section] ?? 0) + 1;
    }
  });
  const judgmentTotal = JUDGMENT_SECTIONS.reduce((n, s) => n + s.questions.length, 0);
  const judgmentAnswered = JUDGMENT_SECTIONS.reduce(
    (n, s) => n + Math.min(answeredBySection[s.slug] ?? 0, s.questions.length), 0);
  const hasBigGoal = goalRows.some((g) => g.kind === 'big_goal');
  const hasModuleGoal = goalRows.some((g) => g.kind === 'module_goal');
  const goalsScore = (hasBigGoal ? 1 : 0) + (hasModuleGoal ? 1 : 0);
  const completeness = Math.round(((judgmentAnswered + goalsScore) / (judgmentTotal + 2)) * 100);

  return (
    <DashboardPage
      title="Settings · Knowledge"
      subtitle={`What the platform knows about how you run this hotel · Property ID ${propertyId} · ${completeness}% complete`}
      tabs={[
        { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`   },
        { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media` },
        { key: 'rate_plans', label: 'Rate Plans', href: `/h/${propertyId}/settings/rate-plans` },
        { key: 'audience',   label: 'Newsletter', href: `/h/${propertyId}/settings/property/audience` },
        { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
        { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data` },
        { key: 'brain',      label: 'Brain',      href: `/h/${propertyId}/settings/brain` },
        { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
        { key: 'knowledge',  label: 'Knowledge',  href: `/h/${propertyId}/settings/knowledge`, active: true },
      ]}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Knowledge"
          subtitle="your goals · how you think about revenue, brand and guests · what agents must know before they act"
        >
          <KnowledgeClient
            propertyId={propertyId}
            goals={goalRows}
            answers={answerRows}
            completeness={completeness}
          />
        </Container>
      </div>
    </DashboardPage>
  );
}
