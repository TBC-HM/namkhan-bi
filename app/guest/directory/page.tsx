// app/guest/directory/page.tsx
// PBS 2026-07-03 v3: proper Guest Directory
// - anon .limit() was silently capped at 1000 rows by PostgREST default max_rows
//   → switched to getSupabaseAdmin() so we can load the full 4165-row base.
// - Filters out orphans (no last_stay AND no upcoming_stay) at source.
// - Pulls last-reservation room / rate plan / market segment / ADR / party via
//   guest.v_directory_full_consolidated (new view that LATERALs to guest.v_guest_reservations).
// - KPI tiles compute from the loaded Namkhan-only rows so filter counts match.

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import DirectoryClient from './_components/DirectoryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface FacetRow {
  country: string;
  guest_count: number;
}

export interface DirectoryRow {
  guest_id: string;
  full_name: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  language: string | null;
  bookings_count: number;
  stays_count: number;
  cancellations_count: number;
  last_stay_date: string | null;
  upcoming_stay_date: string | null;
  arrival_bucket: string | null;
  top_source: string | null;
  top_segment: string | null;
  is_repeat: boolean;
  marketing_readiness_score: number | null;
  last_room_type: string | null;
  last_rate_plan: string | null;
  last_segment: string | null;
  last_source: string | null;
  last_adults: number | null;
  last_children: number | null;
  last_nights: number | null;
  last_adr: number | null;
  party_type: string | null;
  spent_restaurant: boolean;
  spent_spa: boolean;
  spent_activities: boolean;
  spent_retail: boolean;
}

export default async function GuestDirectoryPage() {
  const sb = getSupabaseAdmin();

  // Supabase PostgREST caps a single call at max_rows=1000. Chunk-paginate to
  // pull the whole ~3345-row non-orphan Namkhan base. Column projection matches
  // guest.v_directory_full_consolidated 1:1.
  const CHUNK = 1000;
  const MAX   = 10000;
  const projection = 'guest_id, full_name, country, email, phone, city, language, bookings_count, stays_count, cancellations_count, last_stay_date, upcoming_stay_date, arrival_bucket, top_source, top_segment, is_repeat, marketing_readiness_score, last_room_type, last_rate_plan, last_segment, last_source, last_adults, last_children, last_nights, last_adr, party_type, spent_restaurant, spent_spa, spent_activities, spent_retail';
  const profiles: DirectoryRow[] = [];
  for (let offset = 0; offset < MAX; offset += CHUNK) {
    const { data } = await sb.schema('guest')
      .from('v_directory_full_consolidated')
      .select(projection)
      .eq('property_id', PROPERTY_ID)
      .or('last_stay_date.not.is.null,upcoming_stay_date.not.is.null')
      .order('upcoming_stay_date', { ascending: true,  nullsFirst: false })
      .order('last_stay_date',     { ascending: false, nullsFirst: false })
      .range(offset, offset + CHUNK - 1);
    if (!data || data.length === 0) break;
    profiles.push(...(data as DirectoryRow[]));
    if (data.length < CHUNK) break;
  }

  // Facets derived client-side so counts always match what's loaded.
  const facetMap = new Map<string, number>();
  for (const r of profiles) {
    const k = r.country || '—';
    facetMap.set(k, (facetMap.get(k) ?? 0) + 1);
  }
  const facets: FacetRow[] = Array.from(facetMap.entries())
    .map(([country, guest_count]) => ({ country, guest_count }))
    .sort((a, b) => b.guest_count - a.guest_count);

  // KPI tiles from actual loaded (Namkhan-only + non-orphan) rows.
  const total       = profiles.length;
  const repeats     = profiles.filter((r) => r.is_repeat).length;
  const contactable = profiles.filter((r) => r.email || r.phone).length;
  const unreachable = profiles.filter((r) => !r.email && !r.phone).length;
  const next7  = profiles.filter((r) => r.arrival_bucket === 'next_7').length;
  const next30 = profiles.filter((r) => ['next_7','next_30'].includes(r.arrival_bucket ?? '')).length;
  const next90 = profiles.filter((r) => ['next_7','next_30','next_90'].includes(r.arrival_bucket ?? '')).length;

  const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—';

  const tiles: KpiTileProps[] = [
    { label: 'Total guests', value: total, size: 'sm', footnote: 'with a stay or upcoming arrival' },
    { label: 'Repeat guests', value: repeats, size: 'sm', footnote: `${pct(repeats)} of base` },
    { label: 'Contactable', value: contactable, size: 'sm', footnote: `${pct(contactable)} have email or phone` },
    { label: 'Unreachable', value: unreachable, size: 'sm',
      status: unreachable > 0 ? 'red' : 'green',
      footnote: 'no email + no phone' },
    { label: 'Arriving 7d',  value: next7,  size: 'sm' },
    { label: 'Arriving 30d', value: next30, size: 'sm' },
    { label: 'Arriving 90d', value: next90, size: 'sm' },
  ];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/guest/directory',
  }));

  return (
    <DashboardPage
      title="Guest · Directory"
      subtitle={`${total.toLocaleString()} guests · every one has a stay history or an upcoming arrival`}
      tabs={tabs}
    >
      {unreachable > 0 && (
        <div style={{
          gridColumn: '1 / -1',
          padding: '10px 14px',
          background: '#FBE8E4', border: '1px solid #E8B7AB', borderLeft: '3px solid #B03826',
          borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 12, color: '#1B1B1B' }}>
            <strong>{unreachable.toLocaleString()}</strong>{' '}
            guest profile{unreachable === 1 ? ' is' : 's are'} <em>unreachable</em> — no email + no phone.
          </div>
          <Link href="/guest/messy-data" style={{
            padding: '5px 12px', fontSize: 11, fontWeight: 600,
            background: '#B03826', color: '#FFFFFF',
            border: 'none', borderRadius: 4, textDecoration: 'none',
          }}>Open messy data →</Link>
        </div>
      )}

      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <DirectoryClient initialRows={profiles} facets={facets} />
      </div>
    </DashboardPage>
  );
}
