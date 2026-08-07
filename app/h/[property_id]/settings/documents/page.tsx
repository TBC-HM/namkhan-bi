// app/h/[property_id]/settings/documents/page.tsx
// PBS 2026-08-02 — Document register settings inline (no drawer).
// All 7 tabs visible directly: Families · Subtypes · Matters · Cases · Collections · Tags · Authors
// Uses DocRegistrySettingsPanel export from SettingsDrawerButton — no code duplication.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSettingsTabs } from '@/lib/property-settings-tabs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DocRegistrySettingsPanel } from '@/app/h/[property_id]/finance/legal/docs/_components/SettingsDrawerButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


async function fetchDocSettings(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [familyRows, familyVocabRows, vocab, cases, collections, projects, tagRows, authors] = await Promise.all([
    sb.from('v_doc_register').select('doc_type').eq('property_id', propertyId),
    // Governed family vocab (dms-doc-families-governance-v1, finding #98).
    sb.from('v_doc_type_vocab').select('value, label, sort_order, active, doc_count').eq('property_id', propertyId).order('sort_order').order('value'),
    sb.from('v_doc_subtype_vocab').select('doc_type, subtype_slug, label, time_model, sort_order').order('doc_type').order('label'),
    sb.from('v_doc_cases').select('case_ref, title, matter_type, status').eq('property_id', propertyId).order('case_ref'),
    sb.from('v_doc_collections').select('name, description, is_smart').eq('property_id', propertyId).order('name'),
    sb.from('v_doc_projects').select('project_name, n_docs').eq('property_id', propertyId).order('n_docs', { ascending: false }),
    sb.from('v_doc_register').select('tags').eq('property_id', propertyId),
    sb.from('v_doc_authors').select('author_name, n_docs').eq('property_id', propertyId).order('n_docs', { ascending: false }),
  ]);

  const familyCounts = new Map<string, number>();
  for (const r of (familyRows.data ?? []) as { doc_type: string | null }[]) {
    const k = String(r.doc_type ?? '');
    if (k) familyCounts.set(k, (familyCounts.get(k) ?? 0) + 1);
  }
  const familiesWithCounts = Array.from(familyCounts.entries())
    .map(([doc_type, n]) => ({ doc_type, n })).sort((a, b) => b.n - a.n);

  const tagCounts = new Map<string, number>();
  for (const r of (tagRows.data ?? []) as { tags: string[] | null }[]) {
    for (const t of r.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const tags = Array.from(tagCounts.entries()).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);

  return {
    families: familiesWithCounts,
    familyVocab: (familyVocabRows.data ?? []) as any[],
    subtypeVocab: (vocab.data ?? []) as any[],
    cases: (cases.data ?? []) as any[],
    collections: (collections.data ?? []) as any[],
    projects: ((projects.data ?? []) as any[]).map((p: any) => ({ project: p.project_name, n: p.n_docs ?? 0 })),
    tags,
    authors: ((authors.data ?? []) as any[]).map((a: any) => ({ author: a.author_name, n: a.n_docs ?? 0 })),
  };
}

export default async function DocumentsSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const d = await fetchDocSettings(propertyId);

  return (
    <DashboardPage
      title="Settings · Documents"
      subtitle={`Document register vocabulary · ${d.families.length} families · ${d.subtypeVocab.length} subtypes · property ${propertyId}`}
      tabs={getSettingsTabs(propertyId, 'documents')}
    >
      {/* Document upload — goes to DMS pipeline, not media pipeline */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Upload documents"
          subtitle="PDF · DOCX · XLSX · contracts · certificates · policies · SOPs — go to the Document Register, not the media library"
        >
          <div style={{ padding: '12px 16px' }}>
            <div style={{ padding: '14px 16px', background: '#FFF8E1', border: '1px solid #F57F17', borderRadius: 6, marginBottom: 12 }}>
              <strong style={{ color: '#E65100', fontSize: 12 }}>Upload via the Document Register</strong>
              <p style={{ fontSize: 12, color: '#5A5A5A', margin: '4px 0 8px' }}>
                Documents (.docx, .pdf, .xlsx, etc.) go through a different pipeline than photos. Use the Document Register to upload — files land in the brain pipeline for extraction and classification.
              </p>
              <a href={`/h/${propertyId}/finance/legal/docs`} style={{ fontSize: 12, fontWeight: 700, color: '#084838', textDecoration: 'none', border: '1px solid #084838', padding: '6px 14px', borderRadius: 5, display: 'inline-block' }}>
                Open Document Register →
              </a>
            </div>
            <p style={{ fontSize: 11, color: '#888', margin: 0 }}>
              Accepted: PDF, DOCX, DOC, XLSX, XLS, PPTX, TXT, CSV, ODS · After upload: needs_review status → classify family + subtype → enters brain pipeline
            </p>
          </div>
        </Container>
      </div>

      {/* Document register vocabulary — 7 tabs inline, no drawer */}
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container
          title="Document register · settings"
          subtitle="Families · Subtypes · Matters · Cases · Collections · Tags · Authors — tenant-scoped, changes apply immediately"
        >
          <div style={{ padding: '8px 16px 16px' }}>
            <DocRegistrySettingsPanel
              propertyId={propertyId}
              families={d.families}
              familyVocab={d.familyVocab}
              subtypeVocab={d.subtypeVocab}
              projects={d.projects}
              cases={d.cases}
              collections={d.collections}
              tags={d.tags}
              authors={d.authors}
            />
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
