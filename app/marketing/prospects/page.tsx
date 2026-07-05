// app/marketing/prospects/page.tsx
// PBS 2026-07-05 v2: newsletter-style prospects list with company, pin, per-row tag/delete, mass ops.
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import ProspectsClient from './_components/ProspectsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export type ProspectRow = {
  subscriber_id: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  company: string | null;
  website: string | null;
  enrichment: string | null;
  interest_series: string | null;
  tags: string[] | null;
  enrolled_funnels: string[] | null;
  funnel_sends: number;
  funnel_pending: number;
  lifecycle_stage: string | null;
  booking_count: number | null;
  last_email_open_at: string | null;
  last_email_click_at: string | null;
  is_pinned: boolean;
  created_at: string | null;
};

export default async function ProspectsPage() {
  const sb = getSupabaseAdmin();
  const CHUNK = 1000;
  const projection = 'subscriber_id, full_name, email, country, company, website, enrichment, interest_series, tags, enrolled_funnels, funnel_sends, funnel_pending, lifecycle_stage, booking_count, last_email_open_at, last_email_click_at, is_pinned, created_at';
  const rows: ProspectRow[] = [];
  for (let offset = 0; offset < 5000; offset += CHUNK) {
    const { data } = await sb
      .from('v_marketing_prospects_directory')
      .select(projection)
      .eq('property_id', PROPERTY_ID)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + CHUNK - 1);
    if (!data || data.length === 0) break;
    rows.push(...(data as ProspectRow[]));
    if (data.length < CHUNK) break;
  }

  const total = rows.length;
  const pinned = rows.filter(r => r.is_pinned).length;
  const withCompany = rows.filter(r => !!r.company).length;
  const enrolled = rows.filter(r => (r.enrolled_funnels?.length ?? 0) > 0).length;
  const engaged  = rows.filter(r => !!(r.last_email_open_at || r.last_email_click_at)).length;
  const converted = rows.filter(r => (r.booking_count ?? 0) > 0).length;
  const guessed = rows.filter(r => r.enrichment === 'guessed_info').length;
  const supplied = rows.filter(r => r.enrichment === 'supplied').length;

  // tag facet
  const tagMap = new Map<string, number>();
  for (const r of rows) for (const t of (r.tags ?? [])) tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
  const tagFacets = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);

  const tiles: KpiTileProps[] = [
    { label: 'Prospects', value: total, size: 'sm', footnote: 'never-stayed leads' },
    { label: 'Pinned',    value: pinned, size: 'sm', status: pinned > 0 ? 'green' : undefined },
    { label: 'With company', value: withCompany, size: 'sm', footnote: total > 0 ? `${Math.round(withCompany/total*100)}%` : '—' },
    { label: 'Guessed emails', value: guessed, size: 'sm', footnote: 'info@<domain> · may bounce' },
    { label: 'Real emails',    value: supplied, size: 'sm', status: 'green' },
    { label: 'In a sequence',  value: enrolled, size: 'sm' },
    { label: 'Engaged',    value: engaged, size: 'sm', footnote: 'opened or clicked' },
    { label: 'Converted',  value: converted, size: 'sm', status: converted > 0 ? 'green' : undefined, footnote: 'became bookings' },
  ];

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Marketing · Prospects"
        subtitle={`${total.toLocaleString()} email leads — nurture via Sequences (below), never sent to Cloudbeds`}
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:8 }}>
            <Link href="/marketing/prospects/sequences" style={btnGreen}>Sequences →</Link>
            <Link href="/marketing/prospects/import"    style={btnLight}>+ Import CSV</Link>
          </div>
          <div style={{ fontSize:11, color:'#5A5A5A' }}>
            Tags in use: {tagFacets.map(([t, n]) => `${t} (${n})`).join(' · ') || 'none'}
          </div>
        </div>

        <div style={{ gridColumn:'1 / -1' }}>
          <ProspectsClient initialRows={rows} tagFacets={tagFacets} />
        </div>
      </DashboardPage>
    </div>
  );
}

const btnGreen = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#084838', color:'#FFFFFF', border:'1px solid #084838', borderRadius:4, textDecoration:'none' as const };
const btnLight = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:'#084838', border:'1px solid #E6DFCC', borderRadius:4, textDecoration:'none' as const };
