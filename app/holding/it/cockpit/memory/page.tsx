// app/holding/it/cockpit/memory/page.tsx
// Platform Memory — Module 1 (brief module-doc-architecture-memory-v1, goal 43).
// Institutional memory as one owner surface: doc version timelines + diffs,
// ADR supersede/reference threads, rule consolidation workflow, why-search.
// Reads via service role against public bridges (claude_md §0.5):
//   public.v_doc_version_history · public.cockpit_decisions ·
//   public.cockpit_agent_memory · public.fn_brain_platform_search (via API).
// NOTE (§0.R R4): cockpit_* bridge views have NO anon grants — all reads are
// server-side service-role by design; do not move these fetches client-side.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { MemoryView } from './MemoryView';
import type { DocVersionRow, AdrRow, RuleRow } from './MemoryView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CockpitMemoryPage() {
  const sb = getSupabaseAdmin();
  const [
    { data: versions, error: vErr },
    { data: adrs, error: aErr },
    { data: rules, error: rErr },
    { data: proposals },
  ] = await Promise.all([
    sb.from('v_doc_version_history')
      .select('doc_type, version, title, status, last_updated_by, last_updated_at, snapshotted_at, md_len, hist_id')
      .order('snapshotted_at', { ascending: false })
      .limit(2000),
    sb.from('cockpit_decisions')
      .select('id, title, decision, reasoning, superseded_by, created_at, decided_by, impact')
      .order('id', { ascending: false })
      .limit(1000),
    sb.from('cockpit_agent_memory')
      .select('id, agent_handle, memory_type, content, topics, importance, active, superseded_by, archived_reason, updated_at')
      .gte('importance', 8)
      .neq('memory_type', 'merge_proposal')
      .order('importance', { ascending: false })
      .order('id', { ascending: false })
      .limit(2000),
    sb.from('cockpit_agent_memory')
      .select('id, content, archived_at, archived_reason, updated_at, created_at')
      .eq('memory_type', 'merge_proposal')
      .order('id', { ascending: true })
      .limit(500),
  ]);

  const err = vErr || aErr || rErr;
  if (err) {
    return <div style={{ padding: 24, color: 'var(--ink)' }}>Failed to load platform memory: {err.message}</div>;
  }

  return (
    <MemoryView
      versions={(versions || []) as DocVersionRow[]}
      adrs={(adrs || []) as AdrRow[]}
      rules={(rules || []) as RuleRow[]}
      proposals={(proposals || []) as Array<{ id: number; content: string; archived_at: string | null; archived_reason: string | null; updated_at: string | null; created_at: string | null }>}
    />
  );
}
