// app/guest/retreats/[slug]/page.tsx
// PBS 2026-07-22 · Newsletter Module backlog §12.5 — per-retreat detail page.
// Server component. Slug = retreat.code. Data via public.fn_retreats_list_active RPC.
// Booking CTA URL from marketing.internal_link_catalog anchor_hint='Book your retreat'.
// Hero image best-effort from media.media_assets WHERE retreat_id matches.

import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../../_subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RetreatRow {
  retreat_id: number;
  code: string;
  display_name: string;
  short_pitch: string | null;
  long_description: string | null;
  ideal_for: string[] | null;
  min_nights: number | null;
  max_nights: number | null;
  min_age: number | null;
  pricing_basis: string | null;
  eligible_room_types: string[] | null;
  excluded_seasons: string[] | null;
  essential_inclusions: string[] | null;
  immersion_inclusions: string[] | null;
}

const DEFAULT_BOOKING_URL =
  'https://hotels.cloudbeds.com/en/reservation/lKAMWp?promo=retreat&currency=usd';

function fmtDuration(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null && min !== max) return min + '–' + max + ' nights';
  const n = (min ?? max) as number;
  return n + ' night' + (n === 1 ? '' : 's');
}

function fmtPricingBasis(basis: string | null): string {
  if (!basis) return '—';
  switch (basis) {
    case 'per_person_per_night': return 'Per person, per night';
    case 'per_couple_per_night': return 'Per couple, per night';
    case 'per_person': return 'Per person (package)';
    case 'per_night': return 'Per night';
    default: return basis.replace(/_/g, ' ');
  }
}

interface PageProps {
  params: { slug: string };
  propertyId?: number;
}

export async function generateStaticParams() {
  const { data } = await supabase.rpc('fn_retreats_list_active', { p_property_id: PROPERTY_ID });
  const rows = (data as RetreatRow[]) ?? [];
  return rows.map((r) => ({ slug: r.code }));
}

export default async function RetreatDetailPage({ params, propertyId }: PageProps) {
  const pid = propertyId ?? PROPERTY_ID;
  const { data } = await supabase.rpc('fn_retreats_list_active', { p_property_id: pid });
  const rows: RetreatRow[] = (data as RetreatRow[]) ?? [];
  const retreat = rows.find((row) => row.code === params.slug);
  if (!retreat) notFound();
  const r = retreat as RetreatRow;

  let bookingUrl = DEFAULT_BOOKING_URL;
  try {
    const linkRes = await supabase.from('internal_link_catalog').select('url')
      .eq('property_id', pid).eq('section', 'booking')
      .eq('anchor_hint', 'Book your retreat').eq('active', true).limit(1);
    const url = (linkRes.data as Array<{ url: string }> | null)?.[0]?.url;
    if (url) bookingUrl = url;
  } catch { /* fallback */ }

  let heroUrl: string | null = null;
  try {
    const mediaRes = await supabase.schema('media').from('media_assets')
      .select('master_path,raw_path').eq('property_id', pid)
      .eq('retreat_id', r.retreat_id).eq('status', 'ready').limit(1);
    const rowM = (mediaRes.data as Array<{ master_path: string | null; raw_path: string | null }> | null)?.[0];
    heroUrl = rowM?.master_path || rowM?.raw_path || null;
  } catch { heroUrl = null; }

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/retreats',
  }));

  const essentials = r.essential_inclusions ?? [];
  const immersions = r.immersion_inclusions ?? [];

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage title={'Contacts · ' + r.display_name}
        subtitle={fmtDuration(r.min_nights, r.max_nights) + ' · ' + fmtPricingBasis(r.pricing_basis)}
        tabs={tabs}>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <TenantLink href="/guest/retreats" style={backLink}>&larr; All retreats</TenantLink>
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer" style={bookCta}>Book your retreat &rarr;</a>
        </div>

        {heroUrl && (
          <div style={{ gridColumn: '1 / -1' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroUrl} alt={r.display_name}
              style={{ width: '100%', maxHeight: 340, objectFit: 'cover', borderRadius: 6, border: '1px solid #E6DFCC' }} />
          </div>
        )}

        {r.short_pitch && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={pitchBox}>{r.short_pitch}</div>
          </div>
        )}

        {r.long_description && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={sectionHeader}>About this retreat</div>
            <div style={longText}>{r.long_description}</div>
          </div>
        )}

        <div style={{ gridColumn: '1 / -1', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {essentials.length > 0 && (
            <div style={panel}>
              <div style={sectionHeader}>Essential inclusions</div>
              <ul style={ulList}>{essentials.map((item, idx) => (<li key={idx} style={liItem}>{item}</li>))}</ul>
            </div>
          )}
          {immersions.length > 0 && (
            <div style={panel}>
              <div style={sectionHeader}>Immersion inclusions</div>
              <ul style={ulList}>{immersions.map((item, idx) => (<li key={idx} style={liItem}>{item}</li>))}</ul>
            </div>
          )}
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div style={panel}>
            <div style={sectionHeader}>Duration</div>
            <div style={infoText}>{fmtDuration(r.min_nights, r.max_nights)}</div>
          </div>
          <div style={panel}>
            <div style={sectionHeader}>Pricing basis</div>
            <div style={infoText}>{fmtPricingBasis(r.pricing_basis)}</div>
          </div>
          {r.min_age != null && (
            <div style={panel}>
              <div style={sectionHeader}>Minimum age</div>
              <div style={infoText}>{r.min_age}+ years</div>
            </div>
          )}
          {r.ideal_for && r.ideal_for.length > 0 && (
            <div style={panel}>
              <div style={sectionHeader}>Ideal for</div>
              <div style={cardTags}>{r.ideal_for.map((t) => (<span key={t} style={tag_}>{t.replace(/_/g, ' ')}</span>))}</div>
            </div>
          )}
          {r.eligible_room_types && r.eligible_room_types.length > 0 && (
            <div style={panel}>
              <div style={sectionHeader}>Eligible room types</div>
              <ul style={ulList}>{r.eligible_room_types.map((rt) => (<li key={rt} style={liItem}>{rt}</li>))}</ul>
            </div>
          )}
          {r.excluded_seasons && r.excluded_seasons.length > 0 && (
            <div style={panel}>
              <div style={sectionHeader}>Excluded seasons</div>
              <ul style={ulList}>{r.excluded_seasons.map((s) => (<li key={s} style={liItem}>{s}</li>))}</ul>
            </div>
          )}
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer" style={bookCtaLarge}>Book {r.display_name} &rarr;</a>
        </div>
      </DashboardPage>
    </div>
  );
}

const backLink: CSSProperties = { fontSize: 12, color: '#3A3A3A', textDecoration: 'none', padding: '4px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF' };
const bookCta: CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 600, background: '#1F3A2E', color: '#FFFFFF', border: '1px solid #1F3A2E', borderRadius: 4, textDecoration: 'none' };
const bookCtaLarge: CSSProperties = { padding: '10px 22px', fontSize: 14, fontWeight: 700, background: '#1F3A2E', color: '#FFFFFF', border: '1px solid #1F3A2E', borderRadius: 6, textDecoration: 'none' };
const pitchBox: CSSProperties = { padding: '14px 18px', background: '#F5F1E6', border: '1px solid #E6DFCC', borderRadius: 6, fontSize: 14, color: '#1B1B1B', lineHeight: 1.5, fontStyle: 'italic' };
const sectionHeader: CSSProperties = { fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600, margin: '0 0 8px' };
const longText: CSSProperties = { fontSize: 13, color: '#1B1B1B', lineHeight: 1.6, whiteSpace: 'pre-wrap' };
const panel: CSSProperties = { background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6, padding: 14 };
const ulList: CSSProperties = { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 };
const liItem: CSSProperties = { fontSize: 12.5, color: '#1B1B1B', lineHeight: 1.5 };
const infoText: CSSProperties = { fontSize: 13, color: '#1B1B1B', fontWeight: 500 };
const cardTags: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 };
const tag_: CSSProperties = { fontSize: 10, padding: '2px 8px', background: '#F5F1E6', color: '#3A3A3A', border: '1px solid #E6DFCC', borderRadius: 999, letterSpacing: '0.02em' };
