// app/holding/it2/modules/findings/[module]/page.tsx
// owner-findings-ui-v1 (ADR-218): per-module findings surface.
// Server page: truth header from public.v_module_truth + list from
// public.v_module_findings; interactivity in FindingsClient.

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import FindingsClient from './FindingsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchData(moduleName: string) {
  const sb = getSupabaseAdmin() as any;
  const [{ data: truthRows }, { data: findings }, { data: comments }] = await Promise.all([
    sb.from('v_module_truth').select('*').eq('module_doc_type', moduleName).limit(1),
    sb.from('v_module_findings').select('*').eq('module_doc_type', moduleName)
      .order('created_at', { ascending: false }),
    // finding_threads_v1: dialogue thread per finding. Resolution (fixed/refuted)
    // is gated at trigger level on a PBS-confirmed restatement in this thread.
    sb.from('v_finding_threads').select('*').eq('module_doc_type', moduleName)
      .order('created_at', { ascending: true }),
  ]);
  return { truth: truthRows?.[0] ?? null, findings: findings ?? [], comments: comments ?? [] };
}

export default async function ModuleFindingsPage({ params }: { params: { module: string } }) {
  const moduleName = decodeURIComponent(params.module);
  const { truth, findings, comments } = await fetchData(moduleName);

  const specPct = truth?.spec_pct ?? null;
  const testedPct = truth?.tested_pct ?? null;
  const ok = truth?.testing_ok ?? 0;
  const target = truth?.testing_target ?? null;
  const openBlocking = truth?.open_blocking_findings ?? 0;
  const frozen = truth?.status === 'completed'
    && (testedPct === 100 || truth?.owner_test_waiver === true)
    && openBlocking === 0;

  return (
    <div style={{ maxWidth: 760, padding: '28px 24px' }}>
      <Link href="/holding/it2/modules/specs" style={{ fontSize: 11, fontWeight: 700, color: '#5A5A5A', textDecoration: 'none' }}>
        ← Module specs
      </Link>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '10px 0 4px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1B1B1B', margin: 0 }}>
          {truth?.display_name ?? moduleName} — findings
        </h1>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
          background: frozen ? '#E8F5E9' : '#FFF3E0', color: frozen ? '#2E7D32' : '#B26A00' }}>
          {frozen ? 'FROZEN' : 'UNPROVEN'}
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 18px' }}>
        {truth ? (
          <>
            SPEC {specPct ?? '—'}% · TESTED {testedPct ?? 0}%
            {target != null ? ` (${ok}/${target} runs)` : ' (no test target)'} ·{' '}
            <span style={{ color: openBlocking > 0 ? '#B71C1C' : '#2E7D32', fontWeight: 700 }}>
              {openBlocking} open blocking finding{openBlocking === 1 ? '' : 's'}
            </span>
          </>
        ) : (
          <span style={{ color: '#B71C1C' }}>No truth row for “{moduleName}” — check the module_doc_type spelling.</span>
        )}
        {' '}· Open blocking findings stop completion at the database trigger — resolving them here is the only way through.
      </p>
      <FindingsClient module={moduleName} findings={findings} comments={comments} />
    </div>
  );
}
