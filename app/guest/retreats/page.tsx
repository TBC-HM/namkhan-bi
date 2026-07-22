// app/guest/retreats/page.tsx
// PBS 2026-07-22 · Newsletter Module backlog §12.5 — retreats catalog.
// Server component. Data via public.fn_retreats_list_active (content schema
// not in pgrst.db_schemas — SECURITY DEFINER RPC bridge is the memory-approved
// pattern for non-exposed schemas). Grid of active retreat cards, each linking
// to /guest/retreats/[slug] where slug = retreat.code.
//
// Design tokens per newsletter spec §11.6: hardcode #FFFFFF backgrounds and
// #E6DFCC hairlines. `var(--paper-warm)` resolves to dark on Namkhan.

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
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

function fmtDuration(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null && min !== max) return min + '–' + max + ' nights';
  const n = (min ?? max) as number;
  return n + ' night' + (n === 1 ? '' : 's');
}

function fmtPricingBasis(basis: string | null): string {
  if (!basis) return '';
  switch (basis) {
    case 'per_person_per_night': return 'per person / night';
    case 'per_couple_per_night': return 'per couple / night';
    case 'per_person': return 'per person';
    case 'per_night': return 'per night';
    default: return basis.replace(/_/g, ' ');
  }
}

interface PageProps { propertyId?: number }

export default async function RetreatsCatalogPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? PROPERTY_ID;

  const { data, error } = await supabase.rpc('fn_retreats_list_active', { p_property_id: pid });
  const rows: RetreatRow[] = (data as RetreatRow[]) ?? [];

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/retreats',
  }));

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Contacts · Retreats"
        subtitle={rows.length + ' active retreat program' + (rows.length === 1 ? '' : 's') + '.'}
        tabs={tabs}
      >
        {error && (
          <div style={{ ...errorBox, gridColumn: '1 / -1' }}>
            Could not load retreats: {error.message}
          </div>
        )}

        {rows.length === 0 && !error && (
          <div style={{ ...emptyState, gridColumn: '1 / -1' }}>
            No active retreat programs for this property.
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ gridColumn: '1 / -1', display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {rows.map((r) => (
              <div key={r.retreat_id} style={card}>
                <div style={cardHead}>
                  <div style={cardTitle}>{r.display_name}</div>
                  <div style={cardMeta}>
                    {fmtDuration(r.min_nights, r.max_nights)}
                    {r.pricing_basis ? ' · ' + fmtPricingBasis(r.pricing_basis) : ''}
                  </div>
                </div>
                {r.short_pitch && (
                  <div style={cardPitch}>{r.short_pitch}</div>
                )}
                {r.ideal_for && r.ideal_for.length > 0 && (
                  <div style={cardTags}>
                    {r.ideal_for.slice(0, 3).map((tag) => (
                      <span key={tag} style={tag_}>{tag.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                )}
                <div style={cardFoot}>
                  <TenantLink href={'/guest/retreats/' + r.code} style={cardCta}>
                    View details &rarr;
                  </TenantLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardPage>
    </div>
  );
}

const card: CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
  padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
};
const cardHead: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const cardTitle: CSSProperties = { fontSize: 15, fontWeight: 700, color: '#1B1B1B', lineHeight: 1.25 };
const cardMeta: CSSProperties = { fontSize: 11, color: '#5A5A5A', letterSpacing: '0.02em' };
const cardPitch: CSSProperties = { fontSize: 12.5, color: '#3A3A3A', lineHeight: 1.5 };
const cardTags: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 };
const tag_: CSSProperties = {
  fontSize: 10, padding: '2px 8px', background: '#F5F1E6', color: '#3A3A3A',
  border: '1px solid #E6DFCC', borderRadius: 999, letterSpacing: '0.02em',
};
const cardFoot: CSSProperties = { marginTop: 'auto', paddingTop: 8 };
const cardCta: CSSProperties = {
  display: 'inline-block', padding: '6px 12px', fontSize: 12, fontWeight: 600,
  background: '#1F3A2E', color: '#FFFFFF', border: '1px solid #1F3A2E',
  borderRadius: 4, textDecoration: 'none',
};
const emptyState: CSSProperties = {
  padding: '16px 20px', fontSize: 12, color: '#5A5A5A',
  background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
};
const errorBox: CSSProperties = {
  padding: 12, background: '#FBE8E4', color: '#8A2419',
  border: '1px solid #E8B7AB', borderRadius: 4, marginBottom: 16, fontSize: 13,
};
