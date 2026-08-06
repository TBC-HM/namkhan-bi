// app/holding/settings/documents/page.tsx
// PBS 2026-08-02 — Holding-level document registry (property_id = NULL scope).

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DocRegistrySettingsPanel } from '@/app/h/[property_id]/finance/legal/docs/_components/SettingsDrawerButton';
// ADR-241 (bug #173, finding 101) — same dropzone the property docs page uses.
// propertyId={0} = HOLDING scope; /api/docs/ingest maps 0 → property_id NULL.
import DocUploadDropzone from '@/app/h/[property_id]/finance/legal/docs/_components/DocUploadDropzone';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { settingsTabs } from '@/app/holding/settings/_components/tabs';

async function fetchHoldingDocSettings() {
  const sb = getSupabaseAdmin();
  const [familyRows, vocab, cases, collections, projects, tagRows, authors] = await Promise.all([
    sb.from('v_doc_register').select('doc_type').is('property_id', null),
    sb.from('v_doc_subtype_vocab').select('doc_type, subtype_slug, label, time_model, sort_order').order('doc_type').order('label'),
    sb.from('v_doc_cases').select('case_ref, title, matter_type, status').is('property_id', null).order('case_ref'),
    sb.from('v_doc_collections').select('name, description, is_smart').is('property_id', null).order('name'),
    sb.from('v_doc_projects').select('project_name, n_docs').is('property_id', null).order('n_docs', { ascending: false }),
    sb.from('v_doc_register').select('tags').is('property_id', null),
    sb.from('v_doc_authors').select('author_name, n_docs').is('property_id', null).order('n_docs', { ascending: false }),
  ]);
  const familyCounts = new Map<string, number>();
  for (const r of (familyRows.data ?? []) as { doc_type: string | null }[]) {
    const k = String(r.doc_type ?? '');
    if (k) familyCounts.set(k, (familyCounts.get(k) ?? 0) + 1);
  }
  const tagCounts = new Map<string, number>();
  for (const r of (tagRows.data ?? []) as { tags: string[] | null }[]) {
    for (const t of r.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const totalDocs = Array.from(familyCounts.values()).reduce((s, n) => s + n, 0);
  return {
    families: Array.from(familyCounts.entries()).map(([doc_type, n]) => ({ doc_type, n })).sort((a, b) => b.n - a.n),
    subtypeVocab: (vocab.data ?? []) as any[],
    cases: (cases.data ?? []) as any[],
    collections: (collections.data ?? []) as any[],
    projects: ((projects.data ?? []) as any[]).map((p: any) => ({ project: p.project_name, n: p.n_docs ?? 0 })),
    tags: Array.from(tagCounts.entries()).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n),
    authors: ((authors.data ?? []) as any[]).map((a: any) => ({ author: a.author_name, n: a.n_docs ?? 0 })),
    totalDocs,
  };
}

export default async function HoldingDocumentsSettingsPage() {
  const d = await fetchHoldingDocSettings();
  return (
    <DashboardPage
      title="Holding · Documents"
      subtitle={`${d.totalDocs} holding-wide docs · ${d.families.length} families · separate from tenant documents`}
      tabs={settingsTabs('documents')}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Upload documents" subtitle="PDF · DOCX · XLSX · TXT · CSV · ODS — filed at HOLDING level, not under a property">
          <div style={{ padding: '8px 16px 16px' }}>
            <DocUploadDropzone propertyId={0} />
          </div>
        </Container>
      </div>
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Holding document register" subtitle="Board resolutions, group contracts, holding compliance — no property assignment">
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ fontSize: 13, color: '#5A5A5A' }}>{d.totalDocs} holding-wide documents across {d.families.length} families.</div>
            <Link href="/holding/legal/docs" style={{ fontSize: 12, fontWeight: 700, color: '#084838', textDecoration: 'none', border: '1px solid #084838', padding: '6px 14px', borderRadius: 5, whiteSpace: 'nowrap' as const }}>Open holding register →</Link>
          </div>
        </Container>
      </div>
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Document vocabulary · holding" subtitle="Families · Subtypes · Matters · Cases · Collections · Tags · Authors — holding scope">
          <div style={{ padding: '8px 16px 16px' }}>
            <DocRegistrySettingsPanel propertyId={0} families={d.families} subtypeVocab={d.subtypeVocab} projects={d.projects} cases={d.cases} collections={d.collections} tags={d.tags} authors={d.authors} />
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
