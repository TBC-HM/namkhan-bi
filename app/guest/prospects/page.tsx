// app/guest/prospects/page.tsx
// PBS 2026-07-06 evening: Prospects now lives under Contacts (was /marketing/prospects).
// Reuses the ProspectsClient component from marketing to avoid drift.
// /marketing/prospects still works — deprecated, kept alive to not break external links.

import TenantLink from '@/components/nav/TenantLink';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import ProspectsClient from '@/app/marketing/prospects/_components/ProspectsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

type ProspectRow = {
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
  mx_valid: boolean | null;
  mx_checked_at: string | null;
};

export default async function ContactsProspectsPage() {
  const sb = getSupabaseAdmin();
  const CHUNK = 1000;
  const projection = 'subscriber_id, full_name, email, country, company, website, enrichment, interest_series, tags, enrolled_funnels, funnel_sends, funnel_pending, lifecycle_stage, booking_count, last_email_open_at, last_email_click_at, is_pinned, created_at, mx_valid, mx_checked_at';
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
  const enrolled = rows.filter(r => (r.enrolled_funnels?.length ?? 0) > 0).length;
  const engaged  = rows.filter(r => !!(r.last_email_open_at || r.last_email_click_at)).length;
  const converted = rows.filter(r => (r.booking_count ?? 0) > 0).length;
  const guessed = rows.filter(r => r.enrichment === 'guessed_info').length;
  const supplied = rows.filter(r => r.enrichment === 'supplied').length;

  const tagMap = new Map<string, number>();
  for (const r of rows) for (const t of (r.tags ?? [])) tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
  const tagFacets = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);

  const mxValid   = rows.filter(r => r.mx_valid === true).length;
  const mxInvalid = rows.filter(r => r.mx_valid === false).length;
  const mxUnchecked = rows.filter(r => r.mx_valid === null || r.mx_valid === undefined).length;

  const tiles: KpiTileProps[] = [
    { label: 'Prospects', value: total, size: 'sm', footnote: 'never-stayed leads' },
    { label: 'Pinned',    value: pinned, size: 'sm', status: pinned > 0 ? 'green' : undefined },
    { label: 'Real emails', value: supplied, size: 'sm', status: 'green', footnote: 'supplied in CSV' },
    { label: 'Guessed',    value: guessed, size: 'sm', footnote: 'info@<domain>' },
    { label: 'MX verified', value: mxValid,   size: 'sm', status: mxValid > 0 ? 'green' : undefined },
    { label: 'MX invalid',  value: mxInvalid, size: 'sm', status: mxInvalid > 0 ? 'red' : undefined, footnote: 'safe to bulk-delete' },
    { label: 'Unchecked',   value: mxUnchecked, size: 'sm', footnote: 'run "Verify next 500"' },
    { label: 'In a sequence', value: enrolled, size: 'sm' },
    { label: 'Engaged',    value: engaged, size: 'sm', footnote: 'opened or clicked' },
    { label: 'Converted',  value: converted, size: 'sm', status: converted > 0 ? 'green' : undefined, footnote: 'became bookings' },
  ];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/prospects',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Contacts · Prospects"
        subtitle={`${total.toLocaleString()} email leads — nurture via Sequences, never sent to Cloudbeds`}
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:8 }}>
            <TenantLink href="/marketing/prospects/sequences" style={btnGreen}>Sequences →</TenantLink>
            <TenantLink href="/marketing/prospects/scrape"    style={btnLight}>+ Scrape (Apify)</TenantLink>
            <TenantLink href="/marketing/prospects/import"    style={btnLight}>+ Import CSV</TenantLink>
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
const btnLight = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:'#084838', border:'1px solid #084838', borderRadius:4, textDecoration:'none' as const };
