// app/h/[property_id]/settings/knowledge/page.tsx
// knowledge-goals-intake-v1 — client Knowledge tab: tenant goal registry + judgment-doc intake.
// Fix: JUDGMENT_SECTIONS defined locally (no cross-boundary client import), createClient() matches other settings pages

import { createClient } from '@/lib/supabase/server';
import { getSettingsTabs } from '@/lib/property-settings-tabs';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import KnowledgeClient, {
  type TenantGoalRow,
  type KnowledgeAnswerRow,
  type KnowledgeDocRow,
} from '@/components/settings/KnowledgeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Defined here (not imported from KnowledgeClient) to avoid RSC cross-boundary client import crash
const JUDGMENT_SECTIONS: Array<{ slug: string; questions: string[] }> = [
  { slug: 'revenue_philosophy', questions: ['','','',''] },
  { slug: 'playbook', questions: ['','',''] },
  { slug: 'positioning', questions: ['','',''] },
  { slug: 'guest_profile', questions: ['','',''] },
  { slug: 'escalation_crisis', questions: ['','',''] },
  { slug: 'compliance', questions: ['',''] },
  { slug: 'activities', questions: ['','','',''] },
  { slug: 'retreats', questions: ['','','',''] },
  { slug: 'fnb_ops', questions: ['','','',''] },
  { slug: 'spa_ops', questions: ['','','',''] },
  { slug: 'transport_ops', questions: ['','','',''] },
  { slug: 'retail_ops', questions: ['','','',''] },
  { slug: 'finance_ops', questions: ['','','',''] },
  { slug: 'hr_ops', questions: ['','','',''] },
];

export default async function KnowledgeSettingsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  const supabase = createClient();

  const [{ data: goals, error: gErr }, { data: answers, error: aErr }, { data: docs, error: dErr }] = await Promise.all([
    supabase.from('v_tenant_goals')
      .select('goal_id, property_id, kind, parent_goal_id, module, title, description, metric, baseline, target_value, deadline, weight, guardrail_type, status, updated_at')
      .eq('property_id', propertyId)
      .order('kind', { ascending: true })
      .order('goal_id', { ascending: true }),
    supabase.from('v_tenant_knowledge_answers')
      .select('section, question, answer, answered_by, updated_at')
      .eq('property_id', propertyId),
    supabase.from('v_tenant_knowledge_docs')
      .select('doc_id, section, version, status, content_md, owner_comments, drafted_by, decided_by, decided_at, updated_at')
      .eq('property_id', propertyId)
      .order('version', { ascending: false }),
  ]);

  if (gErr || aErr || dErr) {
    return (
      <div style={{ padding: 24, color: 'var(--ink)' }}>
        Failed to load knowledge intake: {gErr?.message ?? aErr?.message ?? dErr?.message}
      </div>
    );
  }

  const goalRows = (goals ?? []) as TenantGoalRow[];
  const answerRows = (answers ?? []) as KnowledgeAnswerRow[];
  const docRows = (docs ?? []) as KnowledgeDocRow[];

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
  // approvedSections: only sections with an approved doc count as done — pending drafts do not
  const approvedSections = new Set(docRows.filter(d => d.status === 'approved').map(d => d.section)).size;
  const completeness = Math.round(
    ((judgmentAnswered + approvedSections + goalsScore) / (judgmentTotal + JUDGMENT_SECTIONS.length + 2)) * 100
  );

  return (
    <DashboardPage
      title="Settings · Knowledge"
      subtitle={`What the platform knows about how you run this hotel · Property ID ${propertyId} · ${completeness}% complete`}
      tabs={getSettingsTabs(propertyId, 'knowledge')}
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
            docs={docRows}
            completeness={completeness}
          />
        </Container>
      </div>
    </DashboardPage>
  );
}
