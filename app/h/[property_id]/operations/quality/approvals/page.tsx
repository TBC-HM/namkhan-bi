// app/h/[property_id]/operations/quality/approvals/page.tsx
// PBS 2026-09-15 · the approval surface behind the two Quality tiles that were dead ends:
//   "SUGGESTED 288"  — coverage suggestions, no way to accept or reject one
//   "Proposals 471"  — 332 accepted SOPs, 11 written, no way to work the list
// Both queues are read and decided through RPCs that already existed; this page only renders them.
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ApprovalsClient from './ApprovalsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

export default async function QualityApprovalsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const sb = getSupabaseAdmin();

  const [freshRes, qaRes] = await Promise.all([
    sb.rpc('fn_brain_qa_freshness', { p_property_id: propertyId }),
    sb.rpc('fn_brain_qa_context', { p_property_id: propertyId }),
  ]);

  const fresh = (freshRes.data ?? {}) as {
    last_qa_change?: string | null; changes_24h?: number; reindex_pending?: number;
  };
  const qaDigest = typeof qaRes.data === 'string' ? qaRes.data : '';
  const coverageLine = qaDigest.split('\n').find((l) => l.startsWith('SOP coverage')) ?? '';

  return (
    <DashboardPage
      title={`Quality · Approvals — ${LABEL[propertyId] ?? 'Property'}`}
      subtitle="Two queues that were counted on the dashboard and had nowhere to be decided. Every verdict is recorded with its reason."
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Where the standard stands" density="compact">
          <div style={{ fontSize: 12.5, color: 'var(--ink, #1B1B1B)' }}>
            {coverageLine || 'Coverage figure unavailable.'}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 6 }}>
            Brain freshness — QA changes are read live, no cache:{' '}
            {fresh.changes_24h ?? 0} change{(fresh.changes_24h ?? 0) === 1 ? '' : 's'} in the last 24h
            {fresh.last_qa_change ? ` · last ${new Date(fresh.last_qa_change).toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}
            {typeof fresh.reindex_pending === 'number' && fresh.reindex_pending > 0
              ? ` · ${fresh.reindex_pending} awaiting re-embedding`
              : ' · embeddings current'}
          </div>
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Decide"
          subtitle="Confirm only what you have read. A confirmed link is reported as coverage to SLH, GSTC, ASEAN and Travelife."
          density="compact"
        >
          <ApprovalsClient propertyId={propertyId} />
        </Container>
      </div>
    </DashboardPage>
  );
}
