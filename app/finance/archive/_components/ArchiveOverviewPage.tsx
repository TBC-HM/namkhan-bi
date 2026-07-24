// app/finance/archive/_components/ArchiveOverviewPage.tsx
// Archive overview — the Administration · Archive tab (PBS 2026-07-24).
// NOT the doc registry: a brain-backed landing page in the Revenue-HoD design
// language — headline KPI stripes + a prompt window on top.
//   Stripe 1 · registry health (v_doc_register counts, property-scoped)
//   Stripe 2 · documents by family (doc_type tallies)
//   Stripe 3 · company brain coverage (v_brain_pipeline_status, global) + cases
// The full editable register stays one click away (quiet link at the bottom) —
// the two "Open Docs register" buttons on the Legal page were retired for this.

import { DashboardPage, Container, KpiTile } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ArchiveAskClient from './ArchiveAskClient';

interface Props {
  propertyId: number;
  propertyLabel?: string;
  subPagesOverride?: { label: string; href: string }[];
}

interface CaseRow { case_ref: string; status: string | null; n_docs: number }

interface BrainStatus {
  total_docs: number; classified: number; needs_human: number; human_confirmed: number;
  excluded: number; chunks_total: number; chunks_embedded: number; ocr_needed: number;
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const FAMILY_LABEL: Record<string, string> = {
  hr_doc: 'HR', legal: 'Legal', qm: 'Quality', financial: 'Financial',
  marketing: 'Marketing', partner: 'Partner', compliance: 'Compliance',
  template: 'Templates', note: 'Notes', meeting_note: 'Meeting notes',
  insurance: 'Insurance', research: 'Research', vendor_doc: 'Vendors',
  sop: 'SOPs', audit: 'Audits', kb_article: 'KB articles', other: 'Other',
};

async function fetchAllDocTypes(sb: ReturnType<typeof getSupabaseAdmin>, propertyId: number): Promise<string[]> {
  // PostgREST caps result pages — page through doc_type only (cheap column).
  const out: string[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await sb
      .from('v_doc_register')
      .select('doc_type')
      .eq('property_id', propertyId)
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    for (const r of data as { doc_type: string | null }[]) out.push(r.doc_type ?? 'other');
    if (data.length < PAGE) break;
  }
  return out;
}

export default async function ArchiveOverviewPage({ propertyId, propertyLabel, subPagesOverride }: Props) {
  const title = `Archive · ${propertyLabel ?? 'Property'}`;
  const subtitle = 'Company document archive — ask in plain language, or scan the stripes. Human review + rules live on the Brain console.';

  const tabs = (subPagesOverride ?? []).map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/archive'),
  }));

  const sb = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const [totalRes, reviewRes, archivedRes, signedRes, expiringRes, casesRes, brainRes, docTypes] = await Promise.all([
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId),
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('needs_review', true),
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('is_archived', true),
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('signed', true),
    sb.from('v_doc_register').select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId).gte('expiry_date', today).lte('expiry_date', in90),
    sb.from('v_doc_cases').select('case_ref, status, n_docs').eq('property_id', propertyId).order('case_ref'),
    sb.from('v_brain_pipeline_status').select('*').single(),
    fetchAllDocTypes(sb, propertyId),
  ]);

  const familyCounts = new Map<string, number>();
  for (const t of docTypes) familyCounts.set(t, (familyCounts.get(t) ?? 0) + 1);
  const families = [...familyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const cases = ((casesRes.data ?? []) as Partial<CaseRow>[])
    .map((c) => ({ case_ref: c.case_ref ?? '', status: c.status ?? null, n_docs: typeof c.n_docs === 'number' ? c.n_docs : 0 }))
    .filter((c) => c.case_ref);
  const brain = (brainRes.data ?? null) as BrainStatus | null;

  const docsHref = `/h/${propertyId}/finance/legal/docs`;
  const tile = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 } as React.CSSProperties;

  return (
    <DashboardPage title={title} subtitle={subtitle} tabs={tabs.length ? tabs : undefined}>
      {/* Prompt window — the primary way in */}
      <div style={fullRow}>
        <Container title="Ask the archive" subtitle="Answers come only from classified documents, with citations · access-tiered · HR/payroll excluded by policy" density="compact">
          <ArchiveAskClient />
        </Container>
      </div>

      {/* Stripe 1 · registry health */}
      <div style={fullRow}>
        <Container title="Registry" subtitle="What is on file right now" density="compact">
          <div style={tile}>
            <KpiTile label="Documents" value={totalRes.count ?? 0} size="sm" footnote="total on file" />
            <KpiTile label="Needs review" value={reviewRes.count ?? 0} size="sm" footnote="subtype / expiry gaps" />
            <KpiTile label="Expiring ≤ 90d" value={expiringRes.count ?? 0} size="sm" footnote="licenses · insurance · permits" />
            <KpiTile label="Signed" value={signedRes.count ?? 0} size="sm" footnote="signed on file" />
            <KpiTile label="Archived" value={archivedRes.count ?? 0} size="sm" footnote="status = archived" />
          </div>
        </Container>
      </div>

      {/* Stripe 2 · by family */}
      <div style={fullRow}>
        <Container title="By family" subtitle="Document count per register family (top 8)" density="compact">
          <div style={tile}>
            {families.map(([fam, n]) => (
              <KpiTile key={fam} label={FAMILY_LABEL[fam] ?? fam} value={n} size="sm" footnote={fam} />
            ))}
          </div>
        </Container>
      </div>

      {/* Stripe 3 · brain coverage + running cases */}
      <div style={fullRow}>
        <Container title="Company brain" subtitle="How much of the archive is readable by the ask window" density="compact">
          <div style={tile}>
            <KpiTile label="Classified" value={(brain?.classified ?? 0) + (brain?.human_confirmed ?? 0)} size="sm" footnote={`${brain?.human_confirmed ?? 0} human-confirmed`} />
            <KpiTile label="Needs human" value={brain?.needs_human ?? 0} size="sm" footnote="review on Brain console" />
            <KpiTile label="Chunks embedded" value={brain?.chunks_embedded ?? 0} size="sm" footnote={`of ${brain?.chunks_total ?? 0}`} />
            <KpiTile label="Excluded (HR)" value={brain?.excluded ?? 0} size="sm" footnote="never retrievable" />
            <KpiTile label="OCR backlog" value={brain?.ocr_needed ?? 0} size="sm" footnote="scanned PDFs, deferred" />
          </div>
          {cases.length > 0 ? (
            <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink, #1B1B1B)' }}>
              ⌛ Running cases:{' '}
              {cases.map((c, i) => (
                <span key={c.case_ref}>
                  {i > 0 ? ' · ' : ''}
                  <a href={`/h/${propertyId}/finance/legal/cases/${encodeURIComponent(c.case_ref)}`} style={{ textDecoration: 'underline' }}>
                    {c.case_ref}
                  </a>
                  <span style={{ opacity: 0.6 }}> ({c.n_docs} docs{c.status ? ` · ${c.status}` : ''})</span>
                </span>
              ))}
            </div>
          ) : null}
        </Container>
      </div>

      {/* Quiet exits */}
      <div style={fullRow}>
        <div style={{ fontSize: 12, color: 'var(--ink-mute, #5A5A5A)', display: 'flex', gap: 18 }}>
          <a href={docsHref} style={{ textDecoration: 'underline' }}>Open the full document register (triage / edit / classify) →</a>
          <a href="/holding/it/brain" style={{ textDecoration: 'underline' }}>Brain console (review queue · classifier rules) →</a>
        </div>
      </div>
    </DashboardPage>
  );
}
