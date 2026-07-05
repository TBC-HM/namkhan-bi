// app/marketing/audiences/page.tsx
// PBS 2026-07-05: Migrated to new paper-white design (DashboardPage + KpiTile
// + MARKETING_SUBPAGES tabs). Same data source: guest.mv_guest_profile.
// Preserves IcpCockpit + 8 pre-built segments logic. 2026-05-09 email-null
// honesty banner retained.

import Link from 'next/link';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import IcpCockpit from './_components/IcpCockpit';
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
const AMBER  = '#C28F2C';

type IcpView = 'roster' | 'analytics' | 'discovery' | 'create' | 'contacts';
function parseIcpView(v: string | string[] | undefined): IcpView {
  const s = typeof v === 'string' ? v : 'roster';
  return (['roster', 'analytics', 'discovery', 'create', 'contacts'] as string[]).includes(s) ? (s as IcpView) : 'roster';
}

interface ProfileRow {
  guest_id: string;
  full_name: string | null;
  country: string | null;
  email: string | null;
  bookings_count: number;
  stays_count: number;
  lifetime_revenue: number;
  total_nights: number;
  is_repeat: boolean;
  top_source: string | null;
  top_segment: string | null;
  last_stay_date: string | null;
  upcoming_stay_date: string | null;
  marketing_readiness_score: number | null;
}

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

interface Segment {
  id: string;
  label: string;
  description: string;
  source: string;
  emailRequired?: boolean;
  match: (p: ProfileRow, ctx: { todayIso: string; yearAgo: string; sixtyDaysAgo: string }) => boolean;
}

const SEGMENTS: Segment[] = [
  { id: 'all_guests', label: 'All guests', description: 'Every guest on file (any history).', source: 'guest.mv_guest_profile', match: () => true },
  { id: 'repeat', label: 'Repeat guests', description: 'At least 2 stays — natural ambassadors.', source: 'mv_guest_profile.stays_count ≥ 2', match: (p) => Number(p.stays_count) >= 2 },
  { id: 'vip', label: 'VIP · ≥3 stays + ≥$5k LTV', description: 'High-value loyal guests — premium offers, GM letter.', source: 'mv_guest_profile.stays_count ≥ 3 ∧ lifetime_revenue ≥ 5000', match: (p) => Number(p.stays_count) >= 3 && Number(p.lifetime_revenue || 0) >= 5000 },
  {
    id: 'upcoming_30d', label: 'Arriving · ≤30d', description: 'For pre-arrival prep / upsell briefings.', source: 'mv_guest_profile.upcoming_stay_date ≤ today + 30d',
    match: (p, { todayIso }) => {
      if (!p.upcoming_stay_date) return false;
      const days = Math.floor((new Date(p.upcoming_stay_date).getTime() - new Date(todayIso).getTime()) / 86_400_000);
      return days >= 0 && days <= 30;
    },
  },
  {
    id: 'recent_stay_60d', label: 'Recent stay · ≤60d', description: 'For post-stay survey / thank-you / win-back-to-repeat.', source: 'mv_guest_profile.last_stay_date ≥ today − 60d',
    match: (p, { todayIso, sixtyDaysAgo }) => {
      if (!p.last_stay_date) return false;
      return p.last_stay_date >= sixtyDaysAgo && p.last_stay_date <= todayIso;
    },
  },
  {
    id: 'winback_1y', label: 'Win-back · last stay > 1y', description: 'Repeat guests slipping away — invite back.', source: 'mv_guest_profile.is_repeat ∧ last_stay_date < today − 365d',
    match: (p, { yearAgo }) => Number(p.stays_count) >= 2 && !!p.last_stay_date && p.last_stay_date < yearAgo,
  },
  { id: 'one_time', label: 'One-timers', description: 'Single-stay guests — convert to repeat.', source: 'mv_guest_profile.stays_count = 1', match: (p) => Number(p.stays_count) === 1 },
  { id: 'retreat', label: 'Retreat / packaged', description: 'Guests with a top_segment value — retreat or package booking.', source: 'mv_guest_profile.top_segment IS NOT NULL', match: (p) => !!p.top_segment },
];

export default async function AudiencesPage({ searchParams }: Props) {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const yearAgo = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const sixtyDaysAgo = new Date(today.getTime() - 60 * 86_400_000).toISOString().slice(0, 10);

  const selectedId = (searchParams.seg as string) || 'all_guests';
  const selectedSegment = SEGMENTS.find((s) => s.id === selectedId) ?? SEGMENTS[0];

  const { data: profilesR, error: profileErr } = await supabase
    .schema('guest')
    .from('mv_guest_profile')
    .select(
      'guest_id, full_name, country, email, bookings_count, stays_count, lifetime_revenue, total_nights, is_repeat, top_source, top_segment, last_stay_date, upcoming_stay_date, marketing_readiness_score',
    )
    .eq('property_id', PROPERTY_ID)
    .limit(5000);
  const profiles = (profilesR ?? []) as ProfileRow[];

  const ctx = { todayIso, yearAgo, sixtyDaysAgo };

  const segmentCounts = SEGMENTS.map((s) => {
    const matched = profiles.filter((p) => s.match(p, ctx));
    return {
      ...s,
      n: matched.length,
      ltvSum: matched.reduce((sum, p) => sum + Number(p.lifetime_revenue || 0), 0),
    };
  });

  const matched = profiles.filter((p) => selectedSegment.match(p, ctx));
  const matchedSorted = matched
    .sort((a, b) => Number(b.lifetime_revenue) - Number(a.lifetime_revenue))
    .slice(0, 50);

  const byCountry = new Map<string, number>();
  for (const p of matched) {
    const c = p.country || '—';
    byCountry.set(c, (byCountry.get(c) ?? 0) + 1);
  }
  const topCountries = Array.from(byCountry.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const bySource = new Map<string, number>();
  for (const p of matched) {
    const c = p.top_source || '—';
    bySource.set(c, (bySource.get(c) ?? 0) + 1);
  }
  const topSources = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const totalProfiles = profiles.length;
  const withEmail = profiles.filter((p) => !!p.email).length;
  const withCountry = profiles.filter((p) => !!p.country).length;
  const matchedLtv = matched.reduce((s, p) => s + Number(p.lifetime_revenue || 0), 0);
  const avgLtvMatched = matched.length > 0 ? matchedLtv / matched.length : 0;
  const matchedAddressable = matched.filter((p) => !!p.email).length;

  const dataMissing = totalProfiles === 0;

  const icpView = parseIcpView(searchParams?.view);
  const topCountry = topCountries[0]?.[0] ?? undefined;
  const topSource  = topSources[0]?.[0]  ?? undefined;

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/library', // Info hub owns audiences
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Profiles',          value: totalProfiles.toLocaleString(), size: 'sm', footnote: 'guest.mv_guest_profile' },
    { label: 'With country',      value: withCountry.toLocaleString(),   size: 'sm', footnote: `${((withCountry/(totalProfiles||1))*100).toFixed(0)}% of base` },
    { label: 'Email addressable', value: withEmail.toLocaleString(),     size: 'sm', footnote: withEmail === 0 ? 'PMS anonymises' : 'reachable' },
    { label: 'Segment',           value: matched.length.toLocaleString(), size: 'sm', footnote: selectedSegment.label.slice(0, 24) },
    { label: 'Matched LTV',       value: fmtMoney(matchedLtv, 'USD'),    size: 'sm', footnote: 'sum lifetime_revenue' },
    { label: 'Avg LTV',           value: fmtMoney(avgLtvMatched, 'USD'), size: 'sm', footnote: 'per guest' },
    { label: 'Segments',          value: SEGMENTS.length,                 size: 'sm', footnote: 'pre-built' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Audiences"
        subtitle="ICP cockpit + 8 pre-built behavioural segments from guest.mv_guest_profile"
        tabs={tabs}
      >
        {/* KPI band */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* IcpCockpit — Roster · Analytics · Discovery · Create · Contacts */}
        <div style={{ gridColumn: '1 / -1' }}>
          <IcpCockpit
            view={icpView}
            liveCounts={{ totalProfiles, withCountry, withEmail, topCountry, topSource }}
          />
        </div>

        {icpView !== 'contacts' && (
          <div style={{ gridColumn: '1 / -1', padding: '10px 12px', fontSize: 11, color: INK_M, fontStyle: 'italic', borderTop: `1px solid ${HAIR}` }}>
            Live guest data ({totalProfiles.toLocaleString('en-US')} profiles · {withCountry} with country · {withEmail} email-addressable) drives the cockpit. Open <a href="?view=contacts" style={{ color: FOREST }}>Guest contacts</a> to browse the source rows.
          </div>
        )}

        {icpView === 'contacts' && (
          <>
            {dataMissing ? (
              <EmptyShell err={profileErr?.message} />
            ) : (
              <>
                {withEmail === 0 && (
                  <div style={{
                    gridColumn: '1 / -1',
                    padding: '10px 14px',
                    background: '#FFF4D6',
                    border: `1px solid ${AMBER}`,
                    borderRadius: 6,
                    fontSize: 12,
                    color: INK,
                  }}>
                    <strong>Heads-up.</strong> PMS returns <code>email = null</code> for every guest in the
                    materialized view — so 0 of {totalProfiles.toLocaleString()} are reachable by email today.
                    Behavioural segmentation still works (stays / recency / country / source); add an email
                    channel by either (a) wiring the PMS <em>full</em>-PII endpoint server-side or (b)
                    ingesting from Mailchimp / Brevo. Until then, audiences ship as <em>lists for outbound</em>,
                    not addressable cohorts.
                  </div>
                )}

                {/* Segment picker + demographics */}
                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
                  <SegmentPickerChart segments={segmentCounts} selectedId={selectedSegment.id} />
                  <CountryChart rows={topCountries} total={matched.length} />
                  <SourceChart rows={topSources} total={matched.length} />
                </div>

                {/* Preview table */}
                <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                        Preview · {selectedSegment.label} · {matched.length} guests
                      </div>
                      <div style={{ fontSize: 11, color: INK_M, marginTop: 3 }}>
                        {selectedSegment.description} · top 50 by LTV · uses {selectedSegment.source}
                      </div>
                    </div>
                    <Link
                      href={`/marketing/campaigns/new?seg=${encodeURIComponent(selectedSegment.id)}`}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 4, textDecoration: 'none' }}
                    >
                      + Build audience from segment
                    </Link>
                  </div>

                  {matched.length === 0 ? (
                    <div style={{ padding: 24, background: CREAM, border: `1px dashed ${HAIR}`, borderRadius: 8, textAlign: 'center', color: INK_M, fontStyle: 'italic' }}>
                      No guests match &quot;{selectedSegment.label}&quot; yet — try another segment from the picker above.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: CREAM, borderBottom: `1px solid ${HAIR}` }}>
                            <th style={thSt}>Guest</th>
                            <th style={thSt}>Email</th>
                            <th style={thSt}>Country</th>
                            <th style={thSt}>Source</th>
                            <th style={{ ...thSt, textAlign: 'right' }}>Stays</th>
                            <th style={{ ...thSt, textAlign: 'right' }}>LTV</th>
                            <th style={{ ...thSt, textAlign: 'right' }}>Last stay</th>
                            <th style={{ ...thSt, textAlign: 'right' }}>Upcoming</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchedSorted.map((p) => (
                            <tr key={p.guest_id} style={{ borderBottom: `1px solid ${HAIR}` }}>
                              <td style={tdSt}><strong>{p.full_name || '—'}</strong></td>
                              <td style={tdMute}>{p.email || '—'}</td>
                              <td style={tdMute}>{p.country || '—'}</td>
                              <td style={tdMute}>{p.top_source || '—'}</td>
                              <td style={{ ...tdSt, textAlign: 'right' }}>{p.stays_count}</td>
                              <td style={{ ...tdSt, textAlign: 'right' }}>{fmtMoney(Number(p.lifetime_revenue || 0), 'USD')}</td>
                              <td style={{ ...tdMute, textAlign: 'right' }}>{p.last_stay_date || '—'}</td>
                              <td style={{ ...tdMute, textAlign: 'right' }}>{p.upcoming_stay_date || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </DashboardPage>
    </div>
  );
}

function EmptyShell({ err }: { err?: string }) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      padding: '40px 24px',
      background: CREAM,
      border: `1px dashed ${HAIR}`,
      borderRadius: 10,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: INK, marginBottom: 8 }}>
        No audiences yet.
      </div>
      <div style={{ fontSize: 13, color: INK_M, maxWidth: 540, margin: '0 auto 18px' }}>
        Read failed against <code>guest.mv_guest_profile</code>{err ? ` — ${err}` : ''}. Audiences appear here as soon as the materialized view is reachable from this Vercel project.
      </div>
      <Link href="/marketing/campaigns/new" style={{ display: 'inline-block', padding: '8px 18px', fontSize: 12, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 4, textDecoration: 'none' }}>
        + Build first audience
      </Link>
    </div>
  );
}

function SegmentPickerChart({ segments, selectedId }: { segments: (Segment & { n: number; ltvSum: number })[]; selectedId: string }) {
  const max = Math.max(1, ...segments.map((s) => s.n));
  return (
    <div style={cardSt}>
      <div style={cardTitleSt}>Pre-built segments</div>
      <div style={cardSubSt}>Click to switch · count of matching guests</div>
      <div style={{ marginTop: 10 }}>
        {segments.map((s) => {
          const active = s.id === selectedId;
          return (
            <Link key={s.id} href={`/marketing/audiences?view=contacts&seg=${s.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', marginBottom: 2, borderRadius: 4,
                background: active ? CREAM : 'transparent',
                textDecoration: 'none', color: 'inherit', cursor: 'pointer',
              }}>
              <span style={{ width: 130, fontSize: 11, color: active ? INK : INK_S, fontWeight: active ? 600 : 400 }}>
                {s.label.slice(0, 26)}
              </span>
              <span style={{ flex: 1, height: 12, background: CREAM, borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${Math.max(2, (s.n / max) * 100)}%`, height: '100%', background: active ? FOREST : AMBER }} />
              </span>
              <span style={{ width: 50, textAlign: 'right', fontSize: 11, color: INK_S, fontWeight: 600 }}>{s.n}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CountryChart({ rows, total }: { rows: [string, number][]; total: number }) {
  if (rows.length === 0) return <EmptyCard title="Top countries" sub="of selected segment" msg="No guests in segment" eyebrow="guest.mv_guest_profile.country" />;
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const w = 320, lineH = 22, h = Math.max(180, rows.length * lineH + 12);
  const labelW = 90, valW = 50, barMaxW = w - labelW - valW - 8;
  return (
    <div style={cardSt}>
      <div style={cardTitleSt}>Top countries</div>
      <div style={cardSubSt}>Of selected segment · guest.mv_guest_profile.country</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, marginTop: 8 }}>
        {rows.map(([c, n], i) => {
          const y = 6 + i * lineH;
          const barW = (n / max) * barMaxW;
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <g key={c}>
              <text x={labelW - 4} y={y + 14} textAnchor="end" style={{ fontSize: 11, fill: INK }}>
                {String(c).slice(0, 14)}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill={CREAM} />
              <rect x={labelW} y={y + 4} width={barW} height={14} fill={FOREST}>
                <title>{`${c} · ${n.toLocaleString()} guests · ${pct.toFixed(1)}% of ${total.toLocaleString()} segment`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 14} style={{ fontSize: 11, fill: INK_S }}>{n}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SourceChart({ rows, total }: { rows: [string, number][]; total: number }) {
  if (rows.length === 0) return <EmptyCard title="Top sources" sub="of selected segment" msg="No guests in segment" eyebrow="guest.mv_guest_profile.top_source" />;
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const w = 320, lineH = 22, h = Math.max(180, rows.length * lineH + 12);
  const labelW = 110, valW = 50, barMaxW = w - labelW - valW - 8;
  return (
    <div style={cardSt}>
      <div style={cardTitleSt}>Top sources</div>
      <div style={cardSubSt}>How they originally booked · guest.mv_guest_profile.top_source</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, marginTop: 8 }}>
        {rows.map(([c, n], i) => {
          const y = 6 + i * lineH;
          const barW = (n / max) * barMaxW;
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <g key={c}>
              <text x={labelW - 4} y={y + 14} textAnchor="end" style={{ fontSize: 11, fill: INK }}>
                {String(c).slice(0, 16)}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill={CREAM} />
              <rect x={labelW} y={y + 4} width={barW} height={14} fill={AMBER}>
                <title>{`${c} · ${n.toLocaleString()} guests · ${pct.toFixed(1)}% of ${total.toLocaleString()} segment`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 14} style={{ fontSize: 11, fill: INK_S }}>{n}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EmptyCard({ title, sub, msg, eyebrow }: { title: string; sub: string; msg: string; eyebrow?: string }) {
  return (
    <div style={cardSt}>
      <div style={cardTitleSt}>{title}</div>
      <div style={cardSubSt}>{sub}</div>
      <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: INK_M, fontStyle: 'italic', fontSize: 12 }}>
        <span>—</span>
        <span>{msg}</span>
        {eyebrow && (
          <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M, marginTop: 4 }}>
            needs · {eyebrow}
          </span>
        )}
      </div>
    </div>
  );
}

const cardSt: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' };
const cardTitleSt: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: INK };
const cardSubSt: React.CSSProperties = { fontSize: 10, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 3 };
const thSt: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M, fontWeight: 600 };
const tdSt: React.CSSProperties = { padding: '8px 12px', color: INK };
const tdMute: React.CSSProperties = { padding: '8px 12px', color: INK_M };
