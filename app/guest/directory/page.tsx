// app/guest/directory/page.tsx
// PBS 2026-07-03: proper Guest Directory — KPI strip · searchable table · country
// facets · profile drawer. Currency fields intentionally omitted (guest area rule).

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { supabase as anonClient, PROPERTY_ID } from '@/lib/supabase';
import { DashboardPage, Container, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import DirectoryClient from './_components/DirectoryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface FacetRow {
  country: string;
  guest_count: number;
  total_stays: number;
  repeat_guests: number;
  contactable_email: number;
  contactable_phone: number;
  arriving_30d: number;
}

interface HeadlineRow {
  total: number;
  repeat_guests: number;
  upcoming_total: number;
  next_7: number;
  next_30: number;
  next_90: number;
  contactable: number;
}

interface ProfileRow {
  guest_id: string;
  full_name: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  stays_count: number;
  bookings_count: number;
  cancellations_count: number;
  last_stay_date: string | null;
  upcoming_stay_date: string | null;
  arrival_bucket: string | null;
  top_source: string | null;
  top_segment: string | null;
  is_repeat: boolean;
  marketing_readiness_score: number | null;
}

export default async function GuestDirectoryPage() {
  const sb = createClient();

  const [{ data: facets }, { data: headlineRows }, messyR, { data: profiles }] = await Promise.all([
    sb.schema('guest').from('v_directory_facets')
      .select('country, guest_count, total_stays, repeat_guests, contactable_email, contactable_phone, arriving_30d')
      .order('guest_count', { ascending: false })
      .limit(50),
    sb.schema('guest').rpc('directory_headline'),
    anonClient.schema('guest').from('mv_guest_profile')
      .select('guest_id', { count: 'exact', head: true })
      .eq('property_id', PROPERTY_ID).is('email', null).is('phone', null),
    sb.schema('guest').from('mv_guest_profile')
      .select('guest_id, full_name, country, email, phone, stays_count, bookings_count, cancellations_count, last_stay_date, upcoming_stay_date, arrival_bucket, top_source, top_segment, is_repeat, marketing_readiness_score')
      .eq('property_id', PROPERTY_ID)
      .order('last_stay_date', { ascending: false })
      .limit(5000),
  ]);

  const h = (headlineRows as HeadlineRow[])?.[0] ?? {
    total: 0, repeat_guests: 0, upcoming_total: 0, next_7: 0, next_30: 0, next_90: 0, contactable: 0,
  };
  const noContactCount = messyR.count ?? 0;
  const facetRows = (facets ?? []) as FacetRow[];
  const profileRows = (profiles ?? []) as ProfileRow[];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/guest/directory',
  }));

  const repeatPct  = h.total > 0 ? (h.repeat_guests / h.total) * 100 : 0;
  const contactablePct = h.total > 0 ? (h.contactable / h.total) * 100 : 0;

  const tiles: KpiTileProps[] = [
    { label: 'Total guests', value: h.total, size: 'sm', footnote: 'in the profile store' },
    { label: 'Repeat guests', value: h.repeat_guests, size: 'sm', footnote: `${repeatPct.toFixed(0)}% of base` },
    { label: 'Contactable', value: h.contactable, size: 'sm', footnote: `${contactablePct.toFixed(0)}% have email or phone` },
    { label: 'Unreachable', value: noContactCount, size: 'sm',
      status: noContactCount > 0 ? 'red' : 'green',
      footnote: 'no email + no phone' },
    { label: 'Arriving 7d',  value: h.next_7,  size: 'sm', footnote: `${h.upcoming_total} total upcoming` },
    { label: 'Arriving 30d', value: h.next_30, size: 'sm' },
    { label: 'Arriving 90d', value: h.next_90, size: 'sm' },
  ];

  return (
    <DashboardPage
      title="Guest · Directory"
      subtitle="Search, filter, and open any guest profile"
      tabs={tabs}
    >
      {/* Unreachable banner (paper-white terracotta) */}
      {noContactCount > 0 && (
        <div style={{
          gridColumn: '1 / -1',
          padding: '10px 14px',
          background: '#FBE8E4', border: '1px solid #E8B7AB', borderLeft: '3px solid #B03826',
          borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 12, color: '#1B1B1B' }}>
            <strong>{noContactCount.toLocaleString()}</strong>{' '}
            guest profile{noContactCount === 1 ? ' is' : 's are'} <em>unreachable</em> — no email + no phone.
          </div>
          <Link href="/guest/messy-data" style={{
            padding: '5px 12px', fontSize: 11, fontWeight: 600,
            background: '#B03826', color: '#FFFFFF',
            border: 'none', borderRadius: 4, textDecoration: 'none',
          }}>
            Open messy data →
          </Link>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* Search + filter + results (client component) */}
      <div style={{ gridColumn: '1 / -1' }}>
        <DirectoryClient initialRows={profileRows} facets={facetRows} />
      </div>
    </DashboardPage>
  );
}
