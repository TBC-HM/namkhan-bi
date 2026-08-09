// app/holding/legal/docs/page.tsx
// Holding · Legal · Documents — the HOLDING-scope mirror of
// app/h/[property_id]/finance/legal/docs/page.tsx.
//
// ADR-241 (bug #173 / finding 101). PBS 2026-08-06: "create in holding mirror
// the doc page of /h/260955/finance/legal/docs and hang it as substripe in
// holding/legal".
//
// SCOPE: property_id IS NULL. Holding documents only — board resolutions, group
// contracts, holding compliance. Property rows never appear here.
//
// The table and the dropzone are the SAME components the property page uses
// (finding #100 — one concept, one implementation, not a second copy).

import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import DocsTableClient from '@/app/h/[property_id]/finance/legal/docs/_components/DocsTableClient';
import DocUploadDropzone from '@/app/h/[property_id]/finance/legal/docs/_components/DocUploadDropzone';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAGE_SIZE = 50;

const SORTABLE = new Set([
  'title', 'doc_date', 'author', 'doc_type', 'doc_subtype', 'file_type',
  'status', 'matter', 'expiry_date', 'signed', 'sensitivity', 'importance',
  'uploaded_at', 'last_updated_at',
]);

const SUBPAGES: { label: string; href: string }[] = [
  { label: 'HoD',         href: '/holding/legal'           },
  { label: 'Contracts',   href: '/holding/legal/contracts' },
  { label: 'Docs',        href: '/holding/legal/docs'      },
  { label: 'Legal · Lao', href: '/holding/legal/lao'       },
];

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

function asStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function HoldingLegalDocsPage({ searchParams }: Props) {
  const q       = asStr(searchParams.q).trim();
  const family  = asStr(searchParams.family).trim();
  const subtype = asStr(searchParams.subtype).trim();
  const matter  = asStr(searchParams.matter).trim();
  const status  = asStr(searchParams.status).trim();
  const caseF   = asStr(searchParams.case).trim();
  const collF   = asStr(searchParams.coll).trim();
  const tagF    = asStr(searchParams.tag).trim();
  const nrRaw   = asStr(searchParams.nr);
  // Holding has few documents — default to ALL, not needs_review only, or the
  // page reads as empty the first time it is opened.
  const nr      = nrRaw === '1';
  const exp     = asStr(searchParams.exp) === '1';
  const sortRaw = asStr(searchParams.sort);
  const dirRaw  = asStr(searchParams.dir).toLowerCase();
  const sort    = SORTABLE.has(sortRaw) ? sortRaw : '';
  const dir: 'asc' | 'desc' | '' = dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : '';
  const page    = Math.max(1, Number(asStr(searchParams.page) || '1') || 1);
  const offset  = (page - 1) * PAGE_SIZE;

  const supabase = getSupabaseAdmin();

  let qry = supabase
    .from('v_doc_register')
    .select('*', { count: 'exact' })
    .is('property_id', null);

  if (nr)      qry = qry.eq('needs_review', true);
  if (family)  qry = qry.eq('doc_type', family);
  if (subtype) qry = qry.eq('doc_subtype', subtype);
  if (matter)  qry = qry.eq('matter', matter);
  if (status)  qry = qry.eq('status', status);
  if (caseF)   qry = qry.contains('case_refs',        [caseF]);
  if (collF)   qry = qry.contains('collection_names', [collF]);
  if (tagF)    qry = qry.contains('tags',             [tagF]);
  if (exp) {
    const today = new Date().toISOString().slice(0, 10);
    const in90  = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    qry = qry.gte('expiry_date', today).lte('expiry_date', in90);
  }
  if (q) {
    const safe = q.replace(/[,()]/g, ' ');
    qry = qry.or(`title.ilike.%${safe}%,reference_number.ilike.%${safe}%`);
  }

  if (sort && dir) {
    qry = qry.order(sort, { ascending: dir === 'asc', nullsFirst: false });
  } else {
    qry = qry.order('uploaded_at', { ascending: false, nullsFirst: false });
  }
  qry = qry.order('doc_id', { ascending: true });

  const { data: rowsRaw, count } = await qry.range(offset, offset + PAGE_SIZE - 1);
  const rows = rowsRaw ?? [];
  const total = typeof count === 'number' && count > 0 ? count : rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: vocab } = await supabase
    .from('v_doc_subtype_vocab')
    .select('doc_type, subtype_slug, label, time_model, sort_order')
    .order('doc_type').order('label');

  const [{ data: familyRows }, { data: vocabFamilyRows }] = await Promise.all([
    supabase.from('v_doc_register').select('doc_type').is('property_id', null),
    supabase.from('v_doc_type_vocab').select('value, label').is('property_id', null).eq('active', true),
  ]);
  const familyCounts = new Map<string, number>();
  for (const r of (familyRows ?? []) as { doc_type: string | null }[]) {
    const k = String(r.doc_type ?? '');
    if (!k) continue;
    familyCounts.set(k, (familyCounts.get(k) ?? 0) + 1);
  }
  // All governed active families — includes zero-doc families added in Settings
  const familyLabels: Record<string, string> = {};
  for (const r of (vocabFamilyRows ?? []) as { value: string; label: string | null }[]) {
    if (r.value) familyLabels[r.value] = r.label ?? r.value;
  }
  const families = Array.from(new Set([
    ...Object.keys(familyLabels),
    ...Array.from(familyCounts.keys()),
  ])).sort();

  const [
    { data: matterProjectRows },
    { data: matterCaseRows },
  ] = await Promise.all([
    supabase.from('v_doc_projects').select('project_name').is('property_id', null),
    supabase.from('v_doc_cases').select('case_ref').is('property_id', null),
  ]);
  const matters = Array.from(new Set([
    ...((matterProjectRows ?? []) as { project_name: string | null }[]).map((r) => (r.project_name ?? '').trim()),
    ...((matterCaseRows    ?? []) as { case_ref: string | null }[]).map((r) => (r.case_ref ?? '').trim()),
  ].filter(Boolean))).sort();

  const { data: statusRows } = await supabase
    .from('v_doc_register').select('status').is('property_id', null);
  const statuses = Array.from(new Set((statusRows ?? []).map((r: any) => String(r.status ?? '')).filter(Boolean))).sort();

  const [
    { data: caseRows },
    { data: collRows },
    { data: tagRows },
    { data: authorRows },
  ] = await Promise.all([
    supabase.from('v_doc_cases').select('case_ref').is('property_id', null).order('case_ref'),
    supabase.from('v_doc_collections').select('name').is('property_id', null).order('name'),
    supabase.from('v_doc_register').select('tags').is('property_id', null),
    supabase.from('v_doc_authors').select('author_name').is('property_id', null).order('author_name'),
  ]);

  const caseRefs        = ((caseRows   ?? []) as { case_ref: string }[]).map((c) => c.case_ref);
  const collectionNames = ((collRows   ?? []) as { name: string }[]).map((c) => c.name);
  const authorList      = ((authorRows ?? []) as { author_name: string }[]).map((a) => a.author_name);

  const tagSet = new Set<string>();
  for (const r of (tagRows ?? []) as { tags: string[] | null }[]) {
    for (const t of r.tags ?? []) { const k = (t ?? '').trim(); if (k) tagSet.add(k); }
  }
  const tagList = Array.from(tagSet).sort();

  const tabs: DashboardTab[] = SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/holding/legal/docs',
  }));

  // §3 (A4): expected families for the filtered-empty state. Governed vocabulary
  // (v_doc_subtype_vocab doc_type) first — per owner-confirmed finding #98 the
  // structure comes top-down, not from free text — falling back to families
  // already in use at holding scope. No new taxonomy invented here.
  const expectedFamilies = Array.from(new Set([
    ...(((vocab ?? []) as { doc_type: string | null }[]).map((v) => String(v.doc_type ?? '').trim())),
    ...families,
  ].filter(Boolean))).sort();

  return (
    <DashboardPage
      title="Legal · Holding · Docs"
      subtitle={`Holding scope · ${total.toLocaleString('en-US')} document${total === 1 ? '' : 's'} · no property assignment`}
      tabs={tabs}
    >
      <div id="doc-upload" style={{ gridColumn: '1 / -1' }}>
        <Container title="Upload documents" subtitle="PDF · DOCX · XLSX · TXT · CSV · ODS — filed at HOLDING level, not under a property" density="compact">
          <DocUploadDropzone propertyId={0} />
        </Container>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Holding document register"
          subtitle="Board resolutions · group contracts · holding compliance — inline remap clears needs_review"
          density="compact"
        >
          <DocsTableClient
            propertyId={0}
            rows={rows as any[]}
            vocab={(vocab ?? []) as any[]}
            families={families}
            familyLabels={familyLabels}
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
            expectedFamilies={expectedFamilies}
          />
        </Container>
      </div>
    </DashboardPage>
  );
}
