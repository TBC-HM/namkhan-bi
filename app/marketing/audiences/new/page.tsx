// app/marketing/audiences/new/page.tsx
// PBS 2026-07-05: Migrated to new paper-white design. Receives a filter spec
// from /guest/directory, pre-populates an audience preview from
// guest.mv_guest_profile (same query as directory).

import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_S = '#3A3A3A';
const FOREST = '#084838';
const RED    = '#B03826';
const CREAM  = '#F5F0E1';

type FilterSpec = {
  v?: number;
  query?: string | null;
  country?: string | null;
  sort?: string;
  arrival?: 'any' | 'next_7' | 'next_30' | 'next_90';
  stayedSince?: 'any' | '30d' | '90d' | '365d' | '730d';
  repeatOnly?: boolean;
  contactableOnly?: boolean;
  generated_at?: string;
  source?: string;
};

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

const ARRIVAL_BUCKETS: Record<NonNullable<FilterSpec['arrival']>, string[] | null> = {
  any: null,
  next_7: ['next_7'],
  next_30: ['next_7', 'next_30'],
  next_90: ['next_7', 'next_30', 'next_90'],
};

const STAYED_SINCE_DAYS: Record<NonNullable<FilterSpec['stayedSince']>, number | null> = {
  any: null,
  '30d': 30,
  '90d': 90,
  '365d': 365,
  '730d': 730,
};

function decodeFilter(b64?: string | string[] | undefined): FilterSpec | null {
  if (!b64 || Array.isArray(b64)) return null;
  try {
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? padded : padded + '='.repeat(4 - (padded.length % 4));
    const json = Buffer.from(pad, 'base64').toString('utf8');
    return JSON.parse(json) as FilterSpec;
  } catch {
    return null;
  }
}

export default async function NewAudienceFromGuestFilter({ searchParams }: Props) {
  const spec = decodeFilter(searchParams.from_guest_filter);

  let query = supabase
    .schema('guest')
    .from('mv_guest_profile')
    .select(
      'guest_id, full_name, country, email, phone, stays_count, lifetime_revenue, ' +
        'last_stay_date, upcoming_stay_date, days_until_arrival, arrival_bucket, ' +
        'top_source, top_segment, is_repeat, marketing_readiness_score',
      { count: 'exact' }
    )
    .eq('property_id', PROPERTY_ID);

  if (spec?.query && spec.query.trim().length >= 2) {
    query = query.ilike('full_name', `%${spec.query.trim()}%`);
  }
  if (spec?.country) query = query.eq('country', spec.country);
  if (spec?.repeatOnly) query = query.eq('is_repeat', true);
  if (spec?.contactableOnly) query = query.not('email', 'is', null);
  const buckets = spec?.arrival ? ARRIVAL_BUCKETS[spec.arrival] : null;
  if (buckets) query = query.in('arrival_bucket', buckets);
  const days = spec?.stayedSince ? STAYED_SINCE_DAYS[spec.stayedSince] : null;
  if (days) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    query = query.gte('last_stay_date', since);
  }

  const sortRaw = spec?.sort || 'lifetime_revenue.desc.nullslast';
  const [sortField, sortDir, nullsHint] = sortRaw.split('.');
  query = query.order(sortField, {
    ascending: sortDir === 'asc',
    nullsFirst: nullsHint !== 'nullslast',
  });

  const { data, count, error } = await query.range(0, 99);
  const rows = (data as any[]) ?? [];
  const total = count ?? rows.length;

  const matchedLtv = rows.reduce((s, r) => s + Number(r.lifetime_revenue || 0), 0);
  const avgLtv = rows.length > 0 ? matchedLtv / rows.length : 0;
  const addressable = rows.filter((r) => !!r.email).length;

  const filterSummary = summarise(spec);

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/library', // Info hub owns audiences
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Audience size',    value: total,       size: 'sm', footnote: 'matches directory query' },
    { label: 'Total LTV',        value: fmtMoney(matchedLtv, 'USD'), size: 'sm', footnote: 'top-100 preview' },
    { label: 'Avg LTV / guest',  value: fmtMoney(avgLtv, 'USD'),    size: 'sm', footnote: 'matched ÷ count' },
    { label: 'Email addressable',value: addressable, size: 'sm', footnote: 'PMS anonymises today' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Audiences · New"
        subtitle="Build an audience from a directory filter spec — preview + build campaign."
        tabs={tabs}
      >
        {/* Filter spec banner */}
        <div style={{
          gridColumn: '1 / -1',
          padding: '10px 14px',
          background: CREAM,
          border: `1px solid ${HAIR}`,
          borderRadius: 6,
          fontSize: 13,
          color: INK,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div><strong>Filter spec received from /guest/directory.</strong> {filterSummary}</div>
          <TenantLink href="/guest/directory" style={{ ...linkSt, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ← back to directory
          </TenantLink>
        </div>

        {/* KPI tiles */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Preview section header + build CTA */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>
            Preview · top {Math.min(rows.length, 100)} of {total.toLocaleString()}
          </div>
          <TenantLink href={`/marketing/campaigns/new${spec?.country ? `?country=${encodeURIComponent(spec.country)}` : ''}`}
                style={btnPrimary}>
            + Build campaign from this audience
          </TenantLink>
        </div>

        {error && (
          <div style={{
            gridColumn: '1 / -1',
            padding: 14, background: '#FCEBE7', border: `1px solid ${RED}`,
            borderRadius: 6, fontSize: 13, color: RED,
          }}>
            Read failed: {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 32, background: WHITE, border: `1px dashed ${HAIR}`, borderRadius: 8, textAlign: 'center', color: INK_M, fontStyle: 'italic' }}>
            No guests match this filter spec.
          </div>
        ) : (
          <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: CREAM, borderBottom: `1px solid ${HAIR}` }}>
                  <th style={thSt}>Guest</th>
                  <th style={thSt}>Country</th>
                  <th style={thSt}>Email</th>
                  <th style={thSt}>Source</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>Stays</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>LTV</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>Last stay</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>Upcoming</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.guest_id} style={{ borderBottom: `1px solid ${HAIR}` }}>
                    <td style={tdSt}>
                      <strong>{r.full_name || '—'}</strong>
                      {r.is_repeat && (
                        <span style={{ fontSize: 10, color: FOREST, marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          repeat
                        </span>
                      )}
                    </td>
                    <td style={tdMute}>{r.country || '—'}</td>
                    <td style={tdMute}>{r.email || '—'}</td>
                    <td style={tdMute}>{r.top_source || '—'}</td>
                    <td style={{ ...tdSt, textAlign: 'right' }}>{r.stays_count}</td>
                    <td style={{ ...tdSt, textAlign: 'right' }}>{fmtMoney(Number(r.lifetime_revenue || 0), 'USD')}</td>
                    <td style={{ ...tdMute, textAlign: 'right' }}>{r.last_stay_date || '—'}</td>
                    <td style={{ ...tdMute, textAlign: 'right' }}>{r.upcoming_stay_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPage>
    </div>
  );
}

function summarise(spec: FilterSpec | null): string {
  if (!spec) return 'No filter — this is the full guest base.';
  const parts: string[] = [];
  if (spec.country) parts.push(`country=${spec.country}`);
  if (spec.arrival && spec.arrival !== 'any') parts.push(`arrival=${spec.arrival}`);
  if (spec.stayedSince && spec.stayedSince !== 'any') parts.push(`stayed_since=${spec.stayedSince}`);
  if (spec.repeatOnly) parts.push('repeat_only');
  if (spec.contactableOnly) parts.push('contactable_only');
  if (spec.query) parts.push(`query="${spec.query}"`);
  if (spec.sort) parts.push(`sort=${spec.sort}`);
  if (parts.length === 0) return 'No filter — this is the full guest base.';
  return parts.join(' · ');
}

const thSt: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M, fontWeight: 600 };
const tdSt: React.CSSProperties = { padding: '8px 12px', color: INK };
const tdMute: React.CSSProperties = { padding: '8px 12px', color: INK_M };
const linkSt: React.CSSProperties = { color: FOREST, textDecoration: 'none', fontWeight: 600 };
const btnPrimary: React.CSSProperties = { padding: '6px 14px', fontSize: 12, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 4, textDecoration: 'none' };
