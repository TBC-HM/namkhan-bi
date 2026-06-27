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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };
const PAGE_SIZE = 50;

// Brief §3: every column on this list is sortable server-side.
const SORTABLE = new Set([
  'title', 'doc_type', 'doc_subtype', 'status', 'matter',
  'doc_date', 'expiry_date', 'signed', 'sensitivity', 'importance',
  'uploaded_at', 'last_updated_at', 'has_file',
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
  const matter  = asStr(searchParams.matter).trim();
  const status  = asStr(searchParams.status).trim();
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
  if (matter)         qry = qry.eq('matter', matter);
  if (status)         qry = qry.eq('status', status);
  if (exp) {
    const today = new Date().toISOString().slice(0, 10);
    const in90  = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    qry = qry.gte('expiry_date', today).lte('expiry_date', in90);
  }
  if (q) {
    const safe = q.replace(/[,()]/g, ' ');
    qry = qry.or(`title.ilike.%${safe}%,reference_number.ilike.%${safe}%`);
  }

  // Sort: explicit > default (expiry_date asc nulls last when nr=true) > uploaded_at desc.
  if (sort && dir) {
    qry = qry.order(sort, { ascending: dir === 'asc', nullsFirst: false });
  } else if (nr) {
    qry = qry.order('expiry_date', { ascending: true, nullsFirst: false });
  } else {
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
    .select('doc_type, subtype_slug, label, time_model')
    .order('doc_type').order('label');

  // --- Filter dropdown sources (cheap distinct queries) ------------------
  const { data: familyRows } = await supabase
    .from('v_doc_register').select('doc_type').eq('property_id', propertyId);
  const families = Array.from(new Set((familyRows ?? []).map((r: any) => String(r.doc_type ?? '')).filter(Boolean))).sort();
  const { data: matterRows } = await supabase
    .from('v_doc_register').select('matter').eq('property_id', propertyId);
  const matters = Array.from(new Set((matterRows ?? []).map((r: any) => String(r.matter ?? '')).filter(Boolean))).sort();
  const { data: statusRows } = await supabase
    .from('v_doc_register').select('status').eq('property_id', propertyId);
  const statuses = Array.from(new Set((statusRows ?? []).map((r: any) => String(r.status ?? '')).filter(Boolean))).sort();

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
        >
          <DocsTableClient
            propertyId={propertyId}
            rows={rows as any[]}
            vocab={(vocab ?? []) as any[]}
            families={families}
            matters={matters}
            statuses={statuses}
            query={{ q, family, matter, status, nr, exp, sort, dir, page }}
            totalRows={total}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
          />
        </Container>
      </div>
    </DashboardPage>
  );
}
