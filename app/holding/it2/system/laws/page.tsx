// app/holding/it2/system/laws/page.tsx
// laws-page-v1 — Operating Laws under System. Reads public.v_agent_laws
// (bridge over cockpit.kn_agent_memory, importance>=8 AND active — L5) plus
// open change/retire proposals (public.v_law_change_proposals).
// Nav: NO new System tab (7 already — law 659); reached via Health link card +
// scripts/check-it2-orphans.mjs allowlist ("linked contextually", DQ pattern).
// Layer separation (owner decision 2026-08-04): operating laws ≠ business
// guardrails (Settings) ≠ ADRs — this page renders the separation note and
// never mixes the three.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { LawsClient } from './LawsClient';
import type { LawRow, ProposalRow } from './LawsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function LawsPage({
  searchParams,
}: {
  searchParams?: { law?: string };
}) {
  const sb = getSupabaseAdmin();
  const [lawsRes, propsRes] = await Promise.all([
    (sb as any).from('v_agent_laws').select('*')
      .order('importance', { ascending: false })
      .order('id', { ascending: false })
      .range(0, 999),
    (sb as any).from('v_law_change_proposals').select('id, law_id, kind, status, created_at')
      .eq('status', 'open'),
  ]);

  const laws = (lawsRes.data ?? []) as LawRow[];
  const openProposals = (propsRes.data ?? []) as ProposalRow[];
  const loadError = lawsRes.error?.message ?? propsRes.error?.message ?? null;

  const focusLawId = searchParams?.law && /^\d+$/.test(searchParams.law) ? Number(searchParams.law) : null;

  return (
    <LawsClient
      laws={laws}
      openProposals={openProposals}
      loadError={loadError}
      focusLawId={focusLawId}
    />
  );
}
