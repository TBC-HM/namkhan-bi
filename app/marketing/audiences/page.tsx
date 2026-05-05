// app/marketing/audiences/page.tsx — NEW
// Marketing · Audiences — bridge between guest pillar and marketing pillar.
// Reads from guest.mv_guest_profile to surface segment counts that drive campaign sends.
// Every count wired off the materialized view. Filters via URL params.

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
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
  match: (p: ProfileRow, ctx: { todayIso: string; yearAgo: string }) => boolean;
}

// Pre-defined segments — every match function wired off real columns. No fabrication.
const SEGMENTS: Segment[] = [
  {
    id: 'all_email',
    label: 'All · with email',
    description: 'Every guest with an email on file (any stay history)',
    match: (p) => !!p.email,
  },
  {
    id: 'repeat_email',
    label: 'Repeat guests · with email',
    description: '≥2 stays · email on file',
    match: (p) => !!p.email && Number(p.stays_count) >= 2,
  },
  {
    id: 'vip',
    label: 'VIP · ≥3 stays + ≥$5k LTV',
    description: 'High-value loyal guests',
    match: (p) => !!p.email && Number(p.stays_count) >= 3 && Number(p.lifetime_revenue || 0) >= 5000,
  },
  {
    id: 'winback',
    label: 'Win-back · repeat + last stay > 1y',
    description: 'Repeat guests slipping away',
    match: (p, { yearAgo }) =>
      !!p.email && Number(p.stays_count) >= 2 && !!p.last_stay_date && p.last_stay_date < yearAgo,
  },
  {
    id: 'upcoming_30d',
    label: 'Upcoming arrivals · ≤30d',
    description: 'For pre-arrival emails / upsell',
    match: (p, { todayIso }) => {
      if (!p.email || !p.upcoming_stay_date) return false;
      const days = Math.floor((new Date(p.upcoming_stay_date).getTime() - new Date(todayIso).getTime()) / 86_400_000);
      return days >= 0 && days <= 30;
    },
  },
  {
    id: 'recent_stay_30d',
    label: 'Recent stay · ≤30d',
    description: 'For post-stay survey / thank-you',
    match: (p, { todayIso }) => {
      if (!p.email || !p.last_stay_date) return false;
      const days = Math.floor((new Date(todayIso).getTime() - new Date(p.last_stay_date).getTime()) / 86_400_000);
      return days >= 0 && days <= 30;
    },
  },
  {
    id: 'one_time_recent',
    label: 'One-timers · last 1y',
    description: '1 stay · last 12 months · with email — convert to repeat',
    match: (p, { todayIso, yearAgo }) =>
      !!p.email && Number(p.stays_count) === 1 && !!p.last_stay_date && p.last_stay_date >= yearAgo,
  },
  {
    id: 'high_readiness',
    label: 'High marketing readiness',
    description: 'Score ≥ 80 (mv_guest_profile.marketing_readiness_score)',
    match: (p) => !!p.email && (p.marketing_readiness_score ?? 0) >= 80,
  },
];

export default async function AudiencesPage({ searchParams }: Props) {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const yearAgo = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);

  const selectedId = (searchParams.seg as string) || 'all_email';
  const selectedSegment = SEGMENTS.find((s) => s.id === selectedId) ?? SEGMENTS[0];

  const { data: profilesR } = await supabase
    .schema('guest')
    .from('mv_guest_profile')
    .select(
      'guest_id, full_name, country, email, bookings_count, stays_count, lifetime_revenue, total_nights, is_repeat, top_source, top_segment, last_stay_date, upcoming_stay_date, marketing_readiness_score',
    )
    .eq('property_id', PROPERTY_ID)
    .limit(5000);
  const profiles = (profilesR ?? []) as ProfileRow[];

  const ctx = { todayIso, yearAgo };

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
  const matchedLtv = matched.reduce((s, p) => s + Number(p.lifetime_revenue || 0), 0);
  const avgLtvMatched = matched.length > 0 ? matchedLtv / matched.length : 0;

  return (
    <>
      <PageHeader
        pillar="Marketing"
        tab="Audiences"
        title={
          <>
            Pick the{' '}
            <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>list</em>{' '}
            — then write the message.
          </>
        }
        lede={`${totalProfiles} guest profiles · ${withEmail} with email · ${SEGMENTS.length} pre-built segments · selected "${selectedSegment.label}" → ${matched.length} guests`}
      />

      <GuestStatusHeader
        top={
          <>
            {/* AGENT on top — campaign_composer not yet registered, falls back to honest stub */}
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
              <span style={metaDim}>{withEmail} email-addressable</span>
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
              href="/marketing/campaigns/new"
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
              + COMPOSE CAMPAIGN
            </Link>
          </>
        }
      />

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
        <KpiBox value={matched.length} unit="count" label={`Segment · ${selectedSegment.label}`} />
        <KpiBox value={matchedLtv} unit="usd" label="Matched LTV total" />
        <KpiBox value={avgLtvMatched} unit="usd" label="Avg LTV / guest" />
        <KpiBox value={byCountry.size} unit="count" label="Distinct countries" />
      </div>

      {/* SEGMENT DETAIL TABLE */}
      <div style={{ marginTop: 18 }}>
        <SectionHead
          title={`Preview · ${selectedSegment.label}`}
          emphasis={`${matched.length} guests`}
          sub={`${selectedSegment.description} · top 50 by LTV · click "compose campaign" to send`}
          source="guest.mv_guest_profile"
        />
        {matched.length === 0 ? (
          <Empty msg="No guests match this segment yet — try another segment from the picker above." />
        ) : (
          <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Guest</th>
                  <th style={th}>Email</th>
                  <th style={th}>Country</th>
                  <th style={th}>Source</th>
                  <th style={{ ...th, textAlign: 'right' }}>Stays</th>
                  <th style={{ ...th, textAlign: 'right' }}>LTV</th>
                  <th style={{ ...th, textAlign: 'right' }}>Last stay</th>
                  <th style={{ ...th, textAlign: 'right' }}>Readiness</th>
                </tr>
              </thead>
              <tbody>
                {matchedSorted.map((p) => (
                  <tr key={p.guest_id}>
                    <td style={td}><strong>{p.full_name || '—'}</strong></td>
                    <td style={{ ...td, color: 'var(--ink-mute)' }}>{p.email || '—'}</td>
                    <td style={{ ...td, color: 'var(--ink-mute)' }}>{p.country || '—'}</td>
                    <td style={{ ...td, color: 'var(--ink-mute)' }}>{p.top_source || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{p.stays_count}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(Number(p.lifetime_revenue || 0), 'USD')}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mute)' }}>{p.last_stay_date || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mute)' }}>
                      {p.marketing_readiness_score != null ? p.marketing_readiness_score : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
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
  const w = 320, lineH = 28, h = segments.length * lineH + 16;
  const labelW = 130, valW = 64, barMaxW = w - labelW - valW - 8;
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
              <span style={{ width: 100, fontFamily: 'var(--mono)', fontSize: 10, color: active ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: active ? 600 : 400 }}>
                {s.label.slice(0, 22)}
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
              <span style={{ width: 50, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-soft)', fontWeight: 600 }}>
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
    return <EmptyCard title="Top countries" sub="of selected segment" msg="No guests in segment" />;
  }
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const w = 320, lineH = 22, h = Math.max(180, rows.length * lineH + 12);
  const labelW = 90, valW = 50, barMaxW = w - labelW - valW - 8;
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Top countries</div>
      <div style={cardSub}>Of selected segment</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
        {rows.map(([c, n], i) => {
          const y = 6 + i * lineH;
          const barW = (n / max) * barMaxW;
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <g key={c}>
              <text x={labelW - 4} y={y + 14} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' }}>
                {String(c).slice(0, 14)}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--paper-deep)" />
              <rect x={labelW} y={y + 4} width={barW} height={14} fill="var(--moss)">
                <title>{`${c} · ${n} · ${pct.toFixed(0)}%`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 14} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)' }}>
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
    return <EmptyCard title="Top sources" sub="of selected segment" msg="No guests in segment" />;
  }
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const w = 320, lineH = 22, h = Math.max(180, rows.length * lineH + 12);
  const labelW = 110, valW = 50, barMaxW = w - labelW - valW - 8;
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Top sources</div>
      <div style={cardSub}>How they originally booked</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
        {rows.map(([c, n], i) => {
          const y = 6 + i * lineH;
          const barW = (n / max) * barMaxW;
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <g key={c}>
              <text x={labelW - 4} y={y + 14} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' }}>
                {String(c).slice(0, 16)}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--paper-deep)" />
              <rect x={labelW} y={y + 4} width={barW} height={14} fill="var(--brass)">
                <title>{`${c} · ${n} · ${pct.toFixed(0)}%`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 14} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)' }}>
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
    <div style={{ padding: 32, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
      {msg}
    </div>
  );
}
function EmptyCard({ title, sub, msg }: { title: string; sub: string; msg: string }) {
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>{title}</div>
      <div style={cardSub}>{sub}</div>
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
        {msg}
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
  fontSize: 12,
  color: 'var(--ink)',
};
