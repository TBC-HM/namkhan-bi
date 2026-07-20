// app/h/[property_id]/finance/legal/docs/page.tsx
// Finance · Legal · Document Triage Register (ADR-145 / build brief
// legal-docs-triage-register / cockpit_decisions id 145).
//
// Server component. Fetches a single page (50 rows) of public.v_doc_register
// filtered by property + the URL search params (server-side sort, filter,
// pagination — never load all rows). Thin 'use client' table handles inline
// remap + row actions via SECURITY DEFINER RPCs.

import { notFound } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';
import DocsTableClient from './_components/DocsTableClient';
import SettingsDrawerButton from './_components/SettingsDrawerButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };
const PAGE_SIZE = 50;

// Brief §3 + PBS 2026-06-28: every column on this list is sortable server-side.
const SORTABLE = new Set([
  'title', 'doc_date', 'author', 'doc_type', 'doc_subtype', 'file_type',
  'status', 'matter', 'expiry_date', 'signed', 'sensitivity', 'importance',
  'uploaded_at', 'last_updated_at',
]);

interface Props {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

function asStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function DocsTriagePage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  const label = KNOWN_LABEL[propertyId];
  if (!label) notFound();

  // --- URL → query state -------------------------------------------------
  const q       = asStr(searchParams.q).trim();
  const family  = asStr(searchParams.family).trim();        // doc_type
  const subtype = asStr(searchParams.subtype).trim();       // doc_subtype slug
  const matter  = asStr(searchParams.matter).trim();
  const status  = asStr(searchParams.status).trim();
  const caseF   = asStr(searchParams.case).trim();          // case_ref filter
  const collF   = asStr(searchParams.coll).trim();          // collection name filter
  const tagF    = asStr(searchParams.tag).trim();           // tag filter
  const nrRaw   = asStr(searchParams.nr);
  const nr      = nrRaw === '' ? true : nrRaw === '1';      // default: needs_review = true
  const exp     = asStr(searchParams.exp) === '1';          // expiring ≤ 90d
  const sortRaw = asStr(searchParams.sort);
  const dirRaw  = asStr(searchParams.dir).toLowerCase();
  const sort    = SORTABLE.has(sortRaw) ? sortRaw : '';
  const dir: 'asc' | 'desc' | '' = dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : '';
  const page    = Math.max(1, Number(asStr(searchParams.page) || '1') || 1);
  const offset  = (page - 1) * PAGE_SIZE;

  // --- Query -------------------------------------------------------------
  const supabase = getSupabaseAdmin();
  // count:'exact' — the doc register is small (≤ a few thousand rows per
  // property) so the planner estimate is wildly off after recent inserts;
  // exact count keeps "X matching · page A/B" honest and pagination correct.
  let qry = supabase
    .from('v_doc_register')
    .select('*', { count: 'exact' })
    .eq('property_id', propertyId);

  if (nr)             qry = qry.eq('needs_review', true);
  if (family)         qry = qry.eq('doc_type', family);
  if (subtype)        qry = qry.eq('doc_subtype', subtype);
  if (matter)         qry = qry.eq('matter', matter);
  if (status)         qry = qry.eq('status', status);
  // Array-membership filters — case_refs / collection_names / tags are text[]
  // on v_doc_register; .contains() compiles to PostgreSQL `@>`.
  if (caseF)          qry = qry.contains('case_refs',        [caseF]);
  if (collF)          qry = qry.contains('collection_names', [collF]);
  if (tagF)           qry = qry.contains('tags',             [tagF]);
  if (exp) {
    const today = new Date().toISOString().slice(0, 10);
    const in90  = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    qry = qry.gte('expiry_date', today).lte('expiry_date', in90);
  }
  if (q) {
    const safe = q.replace(/[,()]/g, ' ');
    qry = qry.or(`title.ilike.%${safe}%,reference_number.ilike.%${safe}%`);
  }

  // Sort: explicit user choice wins, otherwise default to doc_date asc nulls
  // last (oldest first) — PBS 2026-06-28: always chronological so drilldowns
  // (filter changes) keep the same time order rather than flipping between
  // expiry_date asc / uploaded_at desc depending on which filter is active.
  if (sort && dir) {
    qry = qry.order(sort, { ascending: dir === 'asc', nullsFirst: false });
  } else {
    // PBS 2026-07-20 pm · default = newest upload first (was doc_date ASC which
    // buried today's uploads at the bottom of the register).
    qry = qry.order('uploaded_at', { ascending: false, nullsFirst: false });
  }
  // Stable tiebreaker so pagination doesn't shuffle when sort key has ties.
  qry = qry.order('doc_id', { ascending: true });

  const { data: rowsRaw, count } = await qry.range(offset, offset + PAGE_SIZE - 1);
  const rows = rowsRaw ?? [];
  const total = typeof count === 'number' && count > 0 ? count : rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // --- Subtype vocab (whole table — 100s of rows, cached in client) ------
  const { data: vocab } = await supabase
    .from('v_doc_subtype_vocab')
    .select('doc_type, subtype_slug, label, time_model, sort_order')
    .order('doc_type').order('label');

  // --- Filter dropdown sources (cheap distinct queries) ------------------
  const { data: familyRows } = await supabase
    .from('v_doc_register').select('doc_type').eq('property_id', propertyId);
  const familyCounts = new Map<string, number>();
  for (const r of (familyRows ?? []) as { doc_type: string | null }[]) {
    const k = String(r.doc_type ?? '');
    if (!k) continue;
    familyCounts.set(k, (familyCounts.get(k) ?? 0) + 1);
  }
  const families = Array.from(familyCounts.keys()).sort();
  const familiesWithCounts = Array.from(familyCounts.entries()).map(([doc_type, n]) => ({ doc_type, n })).sort((a, b) => b.n - a.n);

  // Matters = union of every case_ref AND every project (in-use + vocab-only).
  // Reading from v_doc_register.matter (distinct) misses vocab-only matters
  // seeded via the settings drawer — PBS added "PLL" and it never appeared
  // in the dropdown because no doc had project='PLL' yet.
  const [
    { data: matterProjectRows },
    { data: matterCaseRows },
  ] = await Promise.all([
    supabase.from('v_doc_projects').select('project_name').eq('property_id', propertyId),
    supabase.from('v_doc_cases').select('case_ref').eq('property_id', propertyId),
  ]);
  const matters = Array.from(new Set([
    ...((matterProjectRows ?? []) as { project_name: string | null }[]).map((r) => (r.project_name ?? '').trim()),
    ...((matterCaseRows    ?? []) as { case_ref: string | null }[]).map((r) => (r.case_ref ?? '').trim()),
  ].filter(Boolean))).sort();

  const { data: statusRows } = await supabase
    .from('v_doc_register').select('status').eq('property_id', propertyId);
  const statuses = Array.from(new Set((statusRows ?? []).map((r: any) => String(r.status ?? '')).filter(Boolean))).sort();

  // --- Master vocab for the settings drawer + the row autocomplete pickers
  const [
    { data: caseRows },
    { data: collRows },
    { data: projectRows },
    { data: tagRows },
    { data: authorRows },
  ] = await Promise.all([
    supabase.from('v_doc_cases').select('case_ref, title, matter_type, status').eq('property_id', propertyId).order('case_ref'),
    supabase.from('v_doc_collections').select('name, description, is_smart').eq('property_id', propertyId).order('name'),
    // v_doc_projects UNIONs in-use projects (n_docs > 0) with vocab-only ones
    // seeded via the settings drawer (n_docs = 0). Without the vocab union,
    // "Add matter" looked like a no-op because router.refresh() refetched the
    // documents-derived list and a 0-doc project vanished.
    supabase.from('v_doc_projects').select('project_name, n_docs').eq('property_id', propertyId).order('n_docs', { ascending: false }).order('project_name'),
    // Distinct tags via dms.documents.tags — array_agg-able from the register's array projection.
    supabase.from('v_doc_register').select('tags').eq('property_id', propertyId),
    // Authors — vocab + in-use, same union pattern as projects.
    supabase.from('v_doc_authors').select('author_name, n_docs').eq('property_id', propertyId).order('n_docs', { ascending: false }).order('author_name'),
  ]);

  const cases = (caseRows ?? []) as { case_ref: string; title: string | null; matter_type: string | null; status: string | null }[];
  const collections = (collRows ?? []) as { name: string; description: string | null; is_smart?: boolean }[];

  const projects = ((projectRows ?? []) as { project_name: string; n_docs: number }[])
    .map((r) => ({ project: r.project_name, n: r.n_docs }));

  const tagCounts = new Map<string, number>();
  for (const r of (tagRows ?? []) as { tags: string[] | null }[]) {
    for (const t of r.tags ?? []) {
      const k = (t ?? '').trim();
      if (!k) continue;
      tagCounts.set(k, (tagCounts.get(k) ?? 0) + 1);
    }
  }
  const tags = Array.from(tagCounts.entries()).map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);

  // For row pickers — flat lists (existing → add new).
  const caseRefs       = cases.map((c) => c.case_ref);
  const collectionNames = collections.map((c) => c.name);
  const tagList        = Array.from(tagCounts.keys()).sort();
  const authors        = ((authorRows ?? []) as { author_name: string; n_docs: number }[])
    .map((r) => ({ author: r.author_name, n: r.n_docs }));
  const authorList     = authors.map((a) => a.author).sort();

  const tabs: DashboardTab[] = financeSubPagesForProperty(propertyId).map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/legal/docs'),
  }));

  return (
    <DashboardPage
      title="Finance · Legal · Docs"
      subtitle={`${label} · document triage register · ${total.toLocaleString('en-US')} doc${total === 1 ? '' : 's'} matching filter`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Document register"
          subtitle="Triage queue · classify, archive, link to cases/collections · inline remap clears needs_review"
          density="compact"
          action={
            <SettingsDrawerButton
              propertyId={propertyId}
              families={familiesWithCounts}
              subtypeVocab={(vocab ?? []) as any[]}
              projects={projects}
              cases={cases}
              collections={collections}
              tags={tags}
              authors={authors}
            />
          }
        >
          <DocsTableClient
            propertyId={propertyId}
            rows={rows as any[]}
            vocab={(vocab ?? []) as any[]}
            families={families}
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
          />
        </Container>
      </div>
    </DashboardPage>
  );
}
