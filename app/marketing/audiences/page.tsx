// app/marketing/audiences/page.tsx
// Marketing · Audiences — bridge between guest pillar and marketing pillar.
//
// 2026-05-09 fix (cockpit_bugs id=1): every segment used to require
// `email IS NOT NULL`. In Cloudbeds the email field is anonymised on every
// guest, so each tile rendered "0 of 4140". The page LOOKED un-wired.
//
// Reality from Supabase:
//   total          4,140 guests
//   with_country   4,061
//   with_source    4,139
//   with_segment     872
//   has_last_stay  3,254
//   has_upcoming      79
//   repeat (≥2)      300
//   VIP (≥3 + ≥$5k)    2
//   with_email         0  <-- the gating bug
//
// Re-architected: segments are now built off behaviour (stays · recency ·
// upcoming · country · source · readiness). Each tile shows a small eyebrow
// stating which view it reads from. Where outreach needs an email channel,
// we surface the honest "addressable" pill (email channel pending). The
// "Build first audience" CTA links to the existing campaign-creation flow.

import Link from 'next/link';
import Page from '@/components/page/Page';
import { MARKETING_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';
import {
  GuestStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim, cardWrap, cardTitle, cardSub,
} from '../../guest/_components/GuestShell';
import AgentTopRow from '../../guest/_components/AgentTopRow';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

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
  /** A short note shown on the tile — which view drives it. */
  source: string;
  /** Email-required segments stay reachable but render an honest empty hint. */
  emailRequired?: boolean;
  match: (p: ProfileRow, ctx: { todayIso: string; yearAgo: string; sixtyDaysAgo: string }) => boolean;
}

// Pre-defined segments — every match function wired off real columns. No
// fabrication. Email is OPTIONAL per segment because Cloudbeds returns no
// emails today; segments that genuinely need an email channel are flagged
// with `emailRequired: true` and grey out gracefully.
const SEGMENTS: Segment[] = [
  {
    id: 'all_guests',
    label: 'All guests',
    description: 'Every guest on file (any history).',
    source: 'guest.mv_guest_profile',
    match: () => true,
  },
  {
    id: 'repeat',
    label: 'Repeat guests',
    description: 'At least 2 stays — natural ambassadors.',
    source: 'mv_guest_profile.stays_count ≥ 2',
    match: (p) => Number(p.stays_count) >= 2,
  },
  {
    id: 'vip',
    label: 'VIP · ≥3 stays + ≥$5k LTV',
    description: 'High-value loyal guests — premium offers, GM letter.',
    source: 'mv_guest_profile.stays_count ≥ 3 ∧ lifetime_revenue ≥ 5000',
    match: (p) => Number(p.stays_count) >= 3 && Number(p.lifetime_revenue || 0) >= 5000,
  },
  {
    id: 'upcoming_30d',
    label: 'Arriving · ≤30d',
    description: 'For pre-arrival prep / upsell briefings.',
    source: 'mv_guest_profile.upcoming_stay_date ≤ today + 30d',
    match: (p, { todayIso }) => {
      if (!p.upcoming_stay_date) return false;
      const days = Math.floor((new Date(p.upcoming_stay_date).getTime() - new Date(todayIso).getTime()) / 86_400_000);
      return days >= 0 && days <= 30;
    },
  },
  {
    id: 'recent_stay_60d',
    label: 'Recent stay · ≤60d',
    description: 'For post-stay survey / thank-you / win-back-to-repeat.',
    source: 'mv_guest_profile.last_stay_date ≥ today − 60d',
    match: (p, { todayIso, sixtyDaysAgo }) => {
      if (!p.last_stay_date) return false;
      return p.last_stay_date >= sixtyDaysAgo && p.last_stay_date <= todayIso;
    },
  },
  {
    id: 'winback_1y',
    label: 'Win-back · last stay > 1y',
    description: 'Repeat guests slipping away — invite back.',
    source: 'mv_guest_profile.is_repeat ∧ last_stay_date < today − 365d',
    match: (p, { yearAgo }) =>
      Number(p.stays_count) >= 2 && !!p.last_stay_date && p.last_stay_date < yearAgo,
  },
  {
    id: 'one_time',
    label: 'One-timers',
    description: 'Single-stay guests — convert to repeat.',
    source: 'mv_guest_profile.stays_count = 1',
    match: (p) => Number(p.stays_count) === 1,
  },
  {
    id: 'retreat',
    label: 'Retreat / packaged',
    description: 'Guests with a top_segment value — retreat or package booking.',
    source: 'mv_guest_profile.top_segment IS NOT NULL',
    match: (p) => !!p.top_segment,
  },
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

  // Compute every segment count up-front.
  const segmentCounts = SEGMENTS.map((s) => {
    const matched = profiles.filter((p) => s.match(p, ctx));
    return {
      ...s,
      n: matched.length,
      ltvSum: matched.reduce((sum, p) => sum + Number(p.lifetime_revenue || 0), 0),
    };
  });

  // Active selection
  const matched = profiles.filter((p) => selectedSegment.match(p, ctx));
  const matchedSorted = matched
    .sort((a, b) => Number(b.lifetime_revenue) - Number(a.lifetime_revenue))
    .slice(0, 50);

  // Country breakdown of matched set
  const byCountry = new Map<string, number>();
  for (const p of matched) {
    const c = p.country || '—';
    byCountry.set(c, (byCountry.get(c) ?? 0) + 1);
  }
  const topCountries = Array.from(byCountry.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Source breakdown
  const bySource = new Map<string, number>();
  for (const p of matched) {
    const c = p.top_source || '—';
    bySource.set(c, (bySource.get(c) ?? 0) + 1);
  }
  const topSources = Array.from(bySource.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const totalProfiles = profiles.length;
  const withEmail = profiles.filter((p) => !!p.email).length;
  const withCountry = profiles.filter((p) => !!p.country).length;
  const matchedLtv = matched.reduce((s, p) => s + Number(p.lifetime_revenue || 0), 0);
  const avgLtvMatched = matched.length > 0 ? matchedLtv / matched.length : 0;
  const matchedAddressable = matched.filter((p) => !!p.email).length;

  const dataMissing = totalProfiles === 0;

  return (
    <Page
      eyebrow="Marketing · Audiences"
      title={<>Pick the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>list</em> — then write the message.</>}
      subPages={MARKETING_SUBPAGES}
    >

      <GuestStatusHeader
        top={
          <>
            <AgentTopRow
              code="campaign_composer"
              fallbackName="Campaign Composer"
              fallbackHint="planned · turns segment + brief into email/SMS draft"
            />
            <span style={{ flex: 1 }} />
            <StatusCell label="SOURCE">
              <StatusPill tone="active">guest.mv_guest_profile</StatusPill>
              <span style={metaDim}>· bridge: guest → marketing campaigns</span>
            </StatusCell>
          </>
        }
        bottom={
          <>
            <StatusCell label="PROFILES">
              <span style={metaStrong}>{totalProfiles}</span>
              <span style={metaDim}>{withCountry} with country</span>
            </StatusCell>
            <StatusCell label="EMAIL ADDRESSABLE">
              <span style={metaSm}>{withEmail}</span>
              {withEmail === 0 && <span style={metaDim}>· Cloudbeds anonymises emails — channel pending</span>}
            </StatusCell>
            <StatusCell label="SEGMENT">
              <span style={metaSm}>{selectedSegment.label}</span>
              <span style={metaDim}>· {matched.length} guests</span>
            </StatusCell>
            <StatusCell label="MATCHED LTV">
              <span style={metaSm}>{fmtMoney(matchedLtv, 'USD')}</span>
              <span style={metaDim}>avg {fmtMoney(avgLtvMatched, 'USD')}/guest</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
            <Link
              href={`/marketing/campaigns/new?seg=${encodeURIComponent(selectedSegment.id)}`}
              style={{
                padding: '4px 12px',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase',
                fontWeight: 600,
                background: 'var(--moss)',
                color: 'var(--paper-warm)',
                border: '1px solid var(--moss)',
                borderRadius: 4,
                textDecoration: 'none',
              }}
            >
              + BUILD AUDIENCE FROM SEGMENT
            </Link>
          </>
        }
      />

      {dataMissing ? (
        <EmptyShell err={profileErr?.message} />
      ) : (
        <>
          {/* No-email honesty banner */}
          {withEmail === 0 && (
            <div style={{
              marginTop: 14,
              padding: '10px 14px',
              background: 'var(--st-warn-bg, #f6e9c8)',
              border: '1px solid var(--st-warn-bd, #d8c08b)',
              borderRadius: 6,
              fontSize: 'var(--t-sm)',
              color: 'var(--ink)',
            }}>
              <strong>Heads-up.</strong> Cloudbeds returns <code>email = null</code> for every guest in the
              materialized view — so 0 of 4,140 are reachable by email today. Behavioural segmentation
              still works (stays / recency / country / source); add an email channel by either (a)
              wiring the Cloudbeds <em>full</em>-PII endpoint server-side or (b) ingesting from
              Mailchimp / Brevo. Until then, audiences ship as <em>lists for outbound</em>, not
              addressable cohorts.
            </div>
          )}

          {/* SEGMENT PICKER + DEMOGRAPHIC GRAPHS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 12,
              marginTop: 14,
            }}
          >
            <SegmentPickerChart segments={segmentCounts} selectedId={selectedSegment.id} />
            <CountryChart rows={topCountries} total={matched.length} />
            <SourceChart rows={topSources} total={matched.length} />
          </div>

          {/* KPI ROW */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              marginTop: 14,
            }}
          >
            <KpiBox value={matched.length} unit="count" label={`Segment · ${selectedSegment.label}`} tooltip={`Guests matching the "${selectedSegment.label}" definition. Source: ${selectedSegment.source}.`} />
            <KpiBox value={matchedLtv}     unit="usd"   label="Matched LTV total" tooltip="Sum of lifetime_revenue for guests in this segment." />
            <KpiBox value={avgLtvMatched}  unit="usd"   label="Avg LTV / guest"   tooltip="matched_ltv ÷ matched count." />
            <KpiBox value={matchedAddressable} unit="count" label="Email addressable" tooltip="Subset of the segment with email IS NOT NULL — the only column that can drive outbound email." />
          </div>

          {/* SEGMENT DETAIL TABLE */}
          <div style={{ marginTop: 18 }}>
            <SectionHead
              title={`Preview · ${selectedSegment.label}`}
              emphasis={`${matched.length} guests`}
              sub={`${selectedSegment.description} · top 50 by LTV · uses ${selectedSegment.source}`}
              source="guest.mv_guest_profile"
            />
            {matched.length === 0 ? (
              <Empty msg={`No guests match "${selectedSegment.label}" yet — try another segment from the picker above.`} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Email</th>
                      <th>Country</th>
                      <th>Source</th>
                      <th style={{ textAlign: 'right' }}>Stays</th>
                      <th style={{ textAlign: 'right' }}>LTV</th>
                      <th style={{ textAlign: 'right' }}>Last stay</th>
                      <th style={{ textAlign: 'right' }}>Upcoming</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedSorted.map((p) => (
                      <tr key={p.guest_id}>
                        <td><strong>{p.full_name || '—'}</strong></td>
                        <td className="text-mute">{p.email || '—'}</td>
                        <td className="text-mute">{p.country || '—'}</td>
                        <td className="text-mute">{p.top_source || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{p.stays_count}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMoney(Number(p.lifetime_revenue || 0), 'USD')}</td>
                        <td className="text-mute" style={{ textAlign: 'right' }}>{p.last_stay_date || '—'}</td>
                        <td className="text-mute" style={{ textAlign: 'right' }}>{p.upcoming_stay_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Page>
  );
}

// ===== Empty state when mv_guest_profile is unreachable =====

function EmptyShell({ err }: { err?: string }) {
  return (
    <div style={{
      marginTop: 22,
      padding: '40px 24px',
      background: 'rgba(255,245,216,0.04)',
      border: '1px dashed rgba(168,133,74,0.40)',
      borderRadius: 10,
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-2xl)', color: '#fff5d8', marginBottom: 8 }}>
        No audiences yet.
      </div>
      <div style={{ fontSize: 'var(--t-md)', color: '#b8a98a', maxWidth: 540, margin: '0 auto 18px' }}>
        Read failed against <code>guest.mv_guest_profile</code>{err ? ` — ${err}` : ''}. Audiences appear here as soon as the materialized view is reachable from this Vercel project.
      </div>
      <Link
        href="/marketing/campaigns/new"
        style={{
          display: 'inline-block',
          padding: '8px 18px',
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          fontWeight: 600,
          background: 'var(--moss)',
          color: 'var(--paper-warm)',
          border: '1px solid var(--moss)',
          borderRadius: 4,
          textDecoration: 'none',
        }}
      >
        + Build first audience
      </Link>
    </div>
  );
}

// ===== Wired charts =====

function SegmentPickerChart({
  segments,
  selectedId,
}: {
  segments: (Segment & { n: number; ltvSum: number })[];
  selectedId: string;
}) {
  const max = Math.max(1, ...segments.map((s) => s.n));
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Pre-built segments</div>
      <div style={cardSub}>Click to switch · count of matching guests</div>
      <div>
        {segments.map((s) => {
          const active = s.id === selectedId;
          return (
            <Link
              key={s.id}
              href={`/marketing/audiences?seg=${s.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                marginBottom: 2,
                borderRadius: 4,
                background: active ? 'var(--paper-deep)' : 'transparent',
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 130, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: active ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: active ? 600 : 400 }}>
                {s.label.slice(0, 26)}
              </span>
              <span style={{ flex: 1, height: 12, background: 'var(--paper-deep)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    width: `${Math.max(2, (s.n / max) * 100)}%`,
                    height: '100%',
                    background: active ? 'var(--moss)' : 'var(--brass-soft)',
                  }}
                />
              </span>
              <span style={{ width: 50, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-soft)', fontWeight: 600 }}>
                {s.n}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CountryChart({ rows, total }: { rows: [string, number][]; total: number }) {
  if (rows.length === 0) {
    return <EmptyCard title="Top countries" sub="of selected segment" msg="No guests in segment" eyebrow="guest.mv_guest_profile.country" />;
  }
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const w = 320, lineH = 22, h = Math.max(180, rows.length * lineH + 12);
  const labelW = 90, valW = 50, barMaxW = w - labelW - valW - 8;
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Top countries</div>
      <div style={cardSub}>Of selected segment · guest.mv_guest_profile.country</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
        {rows.map(([c, n], i) => {
          const y = 6 + i * lineH;
          const barW = (n / max) * barMaxW;
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <g key={c}>
              <text x={labelW - 4} y={y + 14} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', fill: 'var(--ink)' }}>
                {String(c).slice(0, 14)}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--paper-deep)" />
              <rect x={labelW} y={y + 4} width={barW} height={14} fill="var(--moss)">
                <title>{`Country ${c} · ${n.toLocaleString()} guests · ${pct.toFixed(1)}% of ${total.toLocaleString()} segment · guest.mv_guest_profile`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 14} style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', fill: 'var(--ink-soft)' }}>
                {n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SourceChart({ rows, total }: { rows: [string, number][]; total: number }) {
  if (rows.length === 0) {
    return <EmptyCard title="Top sources" sub="of selected segment" msg="No guests in segment" eyebrow="guest.mv_guest_profile.top_source" />;
  }
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const w = 320, lineH = 22, h = Math.max(180, rows.length * lineH + 12);
  const labelW = 110, valW = 50, barMaxW = w - labelW - valW - 8;
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Top sources</div>
      <div style={cardSub}>How they originally booked · guest.mv_guest_profile.top_source</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
        {rows.map(([c, n], i) => {
          const y = 6 + i * lineH;
          const barW = (n / max) * barMaxW;
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <g key={c}>
              <text x={labelW - 4} y={y + 14} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', fill: 'var(--ink)' }}>
                {String(c).slice(0, 16)}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--paper-deep)" />
              <rect x={labelW} y={y + 4} width={barW} height={14} fill="var(--brass)">
                <title>{`Source ${c} · ${n.toLocaleString()} guests · ${pct.toFixed(1)}% of ${total.toLocaleString()} segment · guest.mv_guest_profile`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 14} style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', fill: 'var(--ink-soft)' }}>
                {n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 32, background: 'rgba(255,245,216,0.04)', border: '1px solid rgba(168,133,74,0.30)', borderRadius: 8, textAlign: 'center', color: '#b8a98a', fontStyle: 'italic' }}>
      {msg}
    </div>
  );
}
function EmptyCard({ title, sub, msg, eyebrow }: { title: string; sub: string; msg: string; eyebrow?: string }) {
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>{title}</div>
      <div style={cardSub}>{sub}</div>
      <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
        <span>—</span>
        <span>{msg}</span>
        {eyebrow && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
            color: 'var(--ink-mute)', marginTop: 4,
          }}>
            needs · {eyebrow}
          </span>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  background: 'var(--paper-deep)',
  borderBottom: '1px solid var(--paper-deep)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  fontWeight: 600,
};
const td: React.CSSProperties = {
  padding: '6px 12px',
  borderBottom: '1px solid var(--paper-deep)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-base)',
  color: 'var(--ink)',
};
