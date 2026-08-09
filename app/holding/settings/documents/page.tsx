// app/holding/settings/documents/page.tsx
// PBS 2026-08-02 — Holding-level document registry (property_id = NULL scope).
// 2026-08-09 — added inline needs_review triage table so uploaded docs can be
// classified without navigating to /holding/legal/docs.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DocRegistrySettingsPanel } from '@/app/h/[property_id]/finance/legal/docs/_components/SettingsDrawerButton';
import DocUploadDropzone from '@/app/h/[property_id]/finance/legal/docs/_components/DocUploadDropzone';
import DocsTableClient from '@/app/h/[property_id]/finance/legal/docs/_components/DocsTableClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { settingsTabs } from '@/app/holding/settings/_components/tabs';

const PAGE_SIZE = 25;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

function asStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

async function fetchHoldingDocSettings() {
  const sb = getSupabaseAdmin();
  const [familyRows, familyVocabRows, vocab, cases, collections, projects, tagRows, authors] = await Promise.all([
    sb.from('v_doc_register').select('doc_type').is('property_id', null),
    sb.from('v_doc_type_vocab').select('value, label, sort_order, active, doc_count').is('property_id', null).order('sort_order').order('value'),
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
    familyVocab: (familyVocabRows.data ?? []) as any[],
    subtypeVocab: (vocab.data ?? []) as any[],
    cases: (cases.data ?? []) as any[],
    collections: (collections.data ?? []) as any[],
    projects: ((projects.data ?? []) as any[]).map((p: any) => ({ project: p.project_name, n: p.n_docs ?? 0 })),
    tags: Array.from(tagCounts.entries()).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n),
    authors: ((authors.data ?? []) as any[]).map((a: any) => ({ author: a.author_name, n: a.n_docs ?? 0 })),
    totalDocs,
    familyNames: Array.from(new Set([
      ...((familyVocabRows.data ?? []) as { value: string; active: boolean }[]).filter(r => r.active).map(r => r.value),
      ...Array.from(familyCounts.keys()),
    ])).sort(),
    familyLabels: Object.fromEntries(
      ((familyVocabRows.data ?? []) as { value: string; label: string | null }[])
        .filter(r => r.value)
        .map(r => [r.value, r.label ?? r.value])
    ),
    vocab: (vocab.data ?? []) as any[],
  };
}

export default async function HoldingDocumentsSettingsPage({ searchParams }: Props) {
  const d = await fetchHoldingDocSettings();

  // Triage table query params (nr defaults true = needs_review only)
  const q       = asStr(searchParams.q).trim();
  const family  = asStr(searchParams.family).trim();
  const subtype = asStr(searchParams.subtype).trim();
  const matter  = asStr(searchParams.matter).trim();
  const status  = asStr(searchParams.status).trim();
  const caseF   = asStr(searchParams.case).trim();
  const collF   = asStr(searchParams.coll).trim();
  const tagF    = asStr(searchParams.tag).trim();
  const nrRaw   = asStr(searchParams.nr);
  const nr      = nrRaw === '' ? true : nrRaw === '1';
  const exp     = asStr(searchParams.exp) === '1';
  const sort    = '';
  const dir: 'asc' | 'desc' | '' = '';
  const page    = Math.max(1, Number(asStr(searchParams.page) || '1') || 1);
  const offset  = (page - 1) * PAGE_SIZE;

  const sb = getSupabaseAdmin();
  let qry = sb.from('v_doc_register').select('*', { count: 'exact' }).is('property_id', null);
  if (nr)      qry = qry.eq('needs_review', true);
  if (family)  qry = qry.eq('doc_type', family);
  if (subtype) qry = qry.eq('doc_subtype', subtype);
  if (matter)  qry = qry.eq('matter', matter);
  if (status)  qry = qry.eq('status', status);
  if (q) {
    const safe = q.replace(/[,()]/g, ' ');
    qry = qry.or(`title.ilike.%${safe}%,reference_number.ilike.%${safe}%`);
  }
  qry = qry.order('uploaded_at', { ascending: false, nullsFirst: false }).order('doc_id', { ascending: true });
  qry = qry.range(offset, offset + PAGE_SIZE - 1);

  const { data: triageRows, count } = await qry;
  const total = typeof count === 'number' && count > 0 ? count : (triageRows ?? []).length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [{ data: matterProjectRows }, { data: matterCaseRows }] = await Promise.all([
    sb.from('v_doc_projects').select('project_name').is('property_id', null),
    sb.from('v_doc_cases').select('case_ref').is('property_id', null),
  ]);
  const matters = Array.from(new Set([
    ...((matterProjectRows ?? []) as { project_name: string | null }[]).map((r) => (r.project_name ?? '').trim()),
    ...((matterCaseRows ?? []) as { case_ref: string | null }[]).map((r) => (r.case_ref ?? '').trim()),
  ].filter(Boolean))).sort();

  const { data: statusRows } = await sb.from('v_doc_register').select('status').is('property_id', null);
  const statuses = Array.from(new Set((statusRows ?? []).map((r: any) => String(r.status ?? '')).filter(Boolean))).sort();

  const caseRefs = d.cases.map((c: any) => c.case_ref as string);
  const collectionNames = d.collections.map((c: any) => c.name as string);
  const tagList = d.tags.map((t: any) => t.tag as string);
  const authorList = d.authors.map((a: any) => a.author as string);

  return (
    <DashboardPage
      title="Holding · Documents"
      subtitle={`${d.totalDocs} holding-wide docs · ${d.families.length} families · separate from tenant documents`}
      tabs={settingsTabs('documents')}
    >
      <div id="doc-upload" style={{ gridColumn: '1 / -1' }}>
        <Container title="Upload documents" subtitle="PDF · DOCX · XLSX · TXT · CSV · ODS — filed at HOLDING level, not under a property">
          <div style={{ padding: '8px 16px 16px' }}>
            <DocUploadDropzone propertyId={0} defaultDocType="research_plattform" />
          </div>
        </Container>
      </div>

      {/* Inline triage table — classify newly uploaded docs without leaving this page */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Holding document register"
          subtitle="Classify family + subtype to activate brain indexing · inline remap clears needs_review"
          action={
            <Link
              href="/holding/legal/docs"
              style={{ fontSize: 11.5, fontWeight: 700, color: '#084838', textDecoration: 'none',
                border: '1px solid #084838', padding: '4px 10px', borderRadius: 4, whiteSpace: 'nowrap' as const }}
            >
              Full register →
            </Link>
          }
        >
          <DocsTableClient
            propertyId={0}
            rows={(triageRows ?? []) as any[]}
            vocab={d.vocab}
            families={d.familyNames}
            familyLabels={d.familyLabels}
            matters={matters}
            statuses={statuses}
            caseRefs={caseRefs}
            collectionNames={collectionNames}
            tagList={tagList}
            authorList={authorList}
            query={{ q, family, subtype, matter, status, caseF, collF, tagF, nr, exp, sort, dir, page }}
            totalRows={total}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            emptyStateVariant="holding"
            expectedFamilies={d.familyNames}
          />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Document vocabulary · holding" subtitle="Families · Subtypes · Matters · Cases · Collections · Tags · Authors — holding scope">
          <div style={{ padding: '8px 16px 16px' }}>
            <DocRegistrySettingsPanel propertyId={0} families={d.families} familyVocab={d.familyVocab} subtypeVocab={d.subtypeVocab} projects={d.projects} cases={d.cases} collections={d.collections} tags={d.tags} authors={d.authors} />
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
