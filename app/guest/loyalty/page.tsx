// app/guest/loyalty/page.tsx — NEW
// Guest · Loyalty — repeat distribution + LTV cohorts + win-back candidates.
// Sources: guest.mv_guest_profile + public.v_repeat_guests + guest.loyalty_members.
// Every value wired. No invented cohorts.

import Link from 'next/link';
import Page from '@/components/page/Page';
import { GUEST_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';
import {
  GuestStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim, cardWrap, cardTitle, cardSub,
} from '../_components/GuestShell';
import AgentTopRow from '../_components/AgentTopRow';

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
  avg_adr: number | null;
  first_stay_date: string | null;
  last_stay_date: string | null;
  is_repeat: boolean;
  top_source: string | null;
  top_segment: string | null;
  marketing_readiness_score: number | null;
}

export default async function LoyaltyPage() {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const [profilesR, repeatR, loyaltyMembersR] = await Promise.all([
    supabase
      .schema('guest')
      .from('mv_guest_profile')
      .select(
        'guest_id, full_name, country, email, bookings_count, stays_count, lifetime_revenue, total_nights, avg_adr, first_stay_date, last_stay_date, is_repeat, top_source, top_segment, marketing_readiness_score',
      )
      .eq('property_id', PROPERTY_ID)
      .order('lifetime_revenue', { ascending: false })
      .limit(2000),
    supabase
      .from('v_repeat_guests')
      .select('repeat_count, total_guests, repeat_pct')
      .eq('property_id', PROPERTY_ID)
      .order('repeat_count'),
    supabase
      .schema('guest')
      .from('loyalty_members')
      .select('guest_id, program_external_id, tier_label, points_balance, joined_at, status')
      .limit(1000),
  ]);

  const profiles = (profilesR.data ?? []) as ProfileRow[];
  const repeatRows = (repeatR.data ?? []) as { repeat_count: number; total_guests: number; repeat_pct: number }[];
  const loyaltyMembers = (loyaltyMembersR.data ?? []) as any[];

  // ---- Repeat-stay distribution from v_repeat_guests ----
  const distMap = new Map<string, number>();
  let totalGuests = 0;
  for (const r of repeatRows) {
    const k = r.repeat_count >= 5 ? '5+' : String(r.repeat_count);
    distMap.set(k, (distMap.get(k) ?? 0) + Number(r.total_guests));
    totalGuests += Number(r.total_guests);
  }
  const distOrder = ['1', '2', '3', '4', '5+'];
  const distribution = distOrder
    .map((k) => ({ k, n: distMap.get(k) ?? 0 }))
    .filter((r) => r.n > 0);

  const repeatGuests = repeatRows
    .filter((r) => r.repeat_count >= 2)
    .reduce((s, r) => s + Number(r.total_guests), 0);
  const oneTimers = repeatRows
    .filter((r) => r.repeat_count === 1)
    .reduce((s, r) => s + Number(r.total_guests), 0);
  const repeatPct = totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0;

  // ---- LTV cohorts ($0–500, 500–1500, 1500–5000, 5000+) ----
  const cohorts = [
    { label: '$0–500',     min: 0,    max: 500,    n: 0, sum: 0 },
    { label: '$500–1.5k',  min: 500,  max: 1500,   n: 0, sum: 0 },
    { label: '$1.5k–5k',   min: 1500, max: 5000,   n: 0, sum: 0 },
    { label: '$5k+',       min: 5000, max: Infinity, n: 0, sum: 0 },
  ];
  for (const p of profiles) {
    const v = Number(p.lifetime_revenue || 0);
    const c = cohorts.find((cc) => v >= cc.min && v < cc.max);
    if (c) {
      c.n += 1;
      c.sum += v;
    }
  }

  // ---- Win-back candidates: repeat=true OR stays>=2, last_stay > 365d ago, has email ----
  const yearAgo = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const winback = profiles
    .filter((p) =>
      p.email &&
      p.last_stay_date &&
      p.last_stay_date < yearAgo &&
      Number(p.stays_count) >= 2,
    )
    .sort((a, b) => Number(b.lifetime_revenue) - Number(a.lifetime_revenue))
    .slice(0, 25);

  // ---- VIP: top 10 by lifetime_revenue with stays >= 2 ----
  const vips = profiles
    .filter((p) => Number(p.stays_count) >= 2)
    .slice(0, 25);

  // ---- Loyalty member counts (guest.loyalty_members table) ----
  const programMembers = loyaltyMembers.length;
  const tierCounts = new Map<string, number>();
  for (const m of loyaltyMembers) {
    const t = m.tier_label || 'unknown';
    tierCounts.set(t, (tierCounts.get(t) ?? 0) + 1);
  }

  // ---- KPI numbers ----
  const totalRevenue = profiles.reduce((s, p) => s + Number(p.lifetime_revenue || 0), 0);
  const avgLtv = profiles.length > 0 ? totalRevenue / profiles.length : 0;
  const avgLtvRepeat = repeatGuests > 0
    ? profiles.filter((p) => Number(p.stays_count) >= 2).reduce((s, p) => s + Number(p.lifetime_revenue || 0), 0) / Math.max(1, profiles.filter((p) => Number(p.stays_count) >= 2).length)
    : 0;

  return (
    <Page
      eyebrow="Guest · Loyalty"
      title={<>Who comes <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>back</em> — and who's about to slip.</>}
      subPages={GUEST_SUBPAGES}
    >

      <GuestStatusHeader
        top={
          <>
            {/* AGENT on top — NPS Agent fits loyalty (post-stay survey + tier-trigger) */}
            <AgentTopRow code="nps_agent" fallbackName="NPS Agent" />
            <span style={{ flex: 1 }} />
            <StatusCell label="SOURCE">
              <StatusPill tone="active">guest.mv_guest_profile</StatusPill>
              <span style={metaDim}>· v_repeat_guests · loyalty_members</span>
            </StatusCell>
          </>
        }
        bottom={
          <>
            <StatusCell label="GUESTS">
              <span style={metaStrong}>{totalGuests}</span>
            </StatusCell>
            <StatusCell label="REPEAT">
              <StatusPill tone={repeatPct >= 30 ? 'active' : repeatPct >= 15 ? 'pending' : 'inactive'}>
                {repeatPct.toFixed(0)}%
              </StatusPill>
              <span style={metaDim}>{repeatGuests} guests</span>
            </StatusCell>
            <StatusCell label="WIN-BACK">
              <StatusPill tone={winback.length > 0 ? 'pending' : 'inactive'}>{winback.length}</StatusPill>
              <span style={metaDim}>last stay &gt; 1y · with email</span>
            </StatusCell>
            <StatusCell label="LOYALTY">
              <span style={metaSm}>{programMembers}</span>
              <span style={metaDim}>members enrolled</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
            <Link
              href="/marketing/audiences"
              style={{
                padding: '4px 10px',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase',
                fontWeight: 600,
                background: 'var(--paper)',
                color: 'var(--ink-soft)',
                border: '1px solid var(--paper-deep)',
                borderRadius: 4,
                textDecoration: 'none',
              }}
            >
              SEND TO MARKETING →
            </Link>
          </>
        }
      />

      {/* 3 GRAPHS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 12,
          marginTop: 14,
        }}
      >
        <RepeatDistChart rows={distribution} total={totalGuests} />
        <LtvCohortChart rows={cohorts} />
        <RecencyChart profiles={profiles} todayIso={todayIso} />
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
        <KpiBox value={totalGuests} unit="count" label="Total guests" />
        <KpiBox value={repeatGuests} unit="count" label="Repeat guests" tooltip="≥2 stays" />
        <KpiBox value={repeatPct} unit="pct" label="Repeat rate" />
        <KpiBox value={avgLtv} unit="usd" label="Avg LTV" tooltip="Across all guests" />
        <KpiBox value={avgLtvRepeat} unit="usd" label="Avg LTV · repeat" tooltip="Repeat guests only" />
        <KpiBox value={winback.length} unit="count" label="Win-back candidates" />
      </div>

      {/* WIN-BACK TABLE */}
      <div style={{ marginTop: 18 }}>
        <SectionHead
          title="Win-back candidates"
          emphasis={`${winback.length}`}
          sub="Repeat guests · last stay > 1 year ago · email on file · sorted by lifetime revenue"
          source="guest.mv_guest_profile"
        />
        {winback.length === 0 ? (
          <Empty msg="No win-back candidates — every repeat guest has stayed within the last 12 months, or has no email on file." />
        ) : (
          <GuestTable rows={winback} todayIso={todayIso} />
        )}
      </div>

      {/* VIP TABLE */}
      <div style={{ marginTop: 18 }}>
        <SectionHead
          title="VIP guests"
          emphasis={`${vips.length}`}
          sub="≥2 stays · sorted by lifetime revenue"
          source="guest.mv_guest_profile"
        />
        {vips.length === 0 ? (
          <Empty msg="No repeat guests yet." />
        ) : (
          <GuestTable rows={vips} todayIso={todayIso} />
        )}
      </div>
    </Page>
  );
}

// ===== Wired charts =====

function RepeatDistChart({ rows, total }: { rows: { k: string; n: number }[]; total: number }) {
  if (rows.length === 0) {
    return <EmptyCard title="Repeat distribution" sub="stays per guest · v_repeat_guests" msg="No guests yet" />;
  }
  const w = 320, h = 200, padL = 8, padR = 4, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...rows.map((r) => r.n));
  const groupW = innerW / rows.length;
  const barW = groupW * 0.7;
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Repeat distribution</div>
      <div style={cardSub}>Stays per guest · {total} guests total</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        {rows.map((r, i) => {
          const x = padL + i * groupW + (groupW - barW) / 2;
          const bh = (r.n / max) * innerH;
          const y = padT + innerH - bh;
          const fill = r.k === '1' ? 'var(--ink-mute)' : r.k === '2' ? 'var(--brass-soft)' : r.k === '3' ? 'var(--brass)' : 'var(--moss)';
          const pct = total > 0 ? (r.n / total) * 100 : 0;
          return (
            <g key={r.k}>
              <rect x={x} y={y} width={barW} height={bh} fill={fill}>
                <title>{`${r.k}× · ${r.n} guests · ${pct.toFixed(0)}%`}</title>
              </rect>
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink)' }}>
                {r.n}
              </text>
              <text x={x + barW / 2} y={h - 14} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-mute)' }}>
                {r.k}×
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LtvCohortChart({ rows }: { rows: { label: string; n: number; sum: number }[] }) {
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (total === 0) {
    return <EmptyCard title="LTV cohorts" sub="lifetime revenue buckets" msg="No revenue data yet" />;
  }
  const w = 320, lineH = 26, h = rows.length * lineH + 16;
  const labelW = 90, valW = 90, barMaxW = w - labelW - valW - 8;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>LTV cohorts</div>
      <div style={cardSub}>guests by lifetime revenue · sum per band</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
        {rows.map((r, i) => {
          const y = 8 + i * lineH;
          const barW = (r.n / max) * barMaxW;
          const pct = total > 0 ? (r.n / total) * 100 : 0;
          const fill = i === 0 ? 'var(--ink-mute)' : i === 1 ? 'var(--brass-soft)' : i === 2 ? 'var(--brass)' : 'var(--moss)';
          return (
            <g key={r.label}>
              <text x={labelW - 4} y={y + 16} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' }}>
                {r.label}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={18} fill="var(--paper-deep)" />
              <rect x={labelW} y={y + 4} width={barW} height={18} fill={fill}>
                <title>{`${r.label} · ${r.n} guests · sum ${fmtMoney(r.sum, 'USD')}`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 16} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)' }}>
                {r.n} · {pct.toFixed(0)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RecencyChart({ profiles, todayIso }: { profiles: ProfileRow[]; todayIso: string }) {
  // Bucket by last_stay recency: 0–90d, 91–180d, 181–365d, 1–2y, 2y+
  const buckets = [
    { label: '0–90d',  min: 0,    max: 90 },
    { label: '91–180', min: 91,   max: 180 },
    { label: '181–365', min: 181, max: 365 },
    { label: '1–2y',   min: 366,  max: 730 },
    { label: '2y+',    min: 731,  max: Infinity },
  ].map((b) => ({ ...b, n: 0 }));

  const today = new Date(todayIso).getTime();
  for (const p of profiles) {
    if (!p.last_stay_date) continue;
    const days = Math.floor((today - new Date(p.last_stay_date).getTime()) / 86_400_000);
    const b = buckets.find((bb) => days >= bb.min && days <= bb.max);
    if (b) b.n += 1;
  }
  const total = buckets.reduce((s, b) => s + b.n, 0);
  if (total === 0) {
    return <EmptyCard title="Recency" sub="time since last stay" msg="No stays recorded" />;
  }
  const w = 320, h = 200, padL = 8, padR = 4, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...buckets.map((b) => b.n));
  const groupW = innerW / buckets.length;
  const barW = groupW * 0.7;

  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Recency · last stay</div>
      <div style={cardSub}>Time since last visit · win-back priority right of center</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        {buckets.map((b, i) => {
          const x = padL + i * groupW + (groupW - barW) / 2;
          const bh = (b.n / max) * innerH;
          const y = padT + innerH - bh;
          const fill = i === 0 ? 'var(--moss)' : i === 1 ? 'var(--brass-soft)' : i <= 3 ? 'var(--brass)' : 'var(--st-bad)';
          return (
            <g key={b.label}>
              <rect x={x} y={y} width={barW} height={bh} fill={fill}>
                <title>{`${b.label} · ${b.n} guests · ${total > 0 ? ((b.n / total) * 100).toFixed(0) : 0}%`}</title>
              </rect>
              {b.n > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink)' }}>
                  {b.n}
                </text>
              )}
              <text x={x + barW / 2} y={h - 14} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function GuestTable({ rows, todayIso }: { rows: ProfileRow[]; todayIso: string }) {
  const today = new Date(todayIso).getTime();
  return (
    <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={th}>Guest</th>
            <th style={th}>Country</th>
            <th style={th}>Source</th>
            <th style={{ ...th, textAlign: 'right' }}>Stays</th>
            <th style={{ ...th, textAlign: 'right' }}>Nights</th>
            <th style={{ ...th, textAlign: 'right' }}>LTV</th>
            <th style={{ ...th, textAlign: 'right' }}>Avg ADR</th>
            <th style={{ ...th, textAlign: 'right' }}>Last stay</th>
            <th style={{ ...th, textAlign: 'right' }}>Days since</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const days = r.last_stay_date ? Math.floor((today - new Date(r.last_stay_date).getTime()) / 86_400_000) : null;
            return (
              <tr key={r.guest_id}>
                <td style={td}>
                  <strong>{r.full_name || '—'}</strong>
                  {r.email && (
                    <div style={{ color: 'var(--ink-mute)', fontSize: 11 }}>{r.email}</div>
                  )}
                </td>
                <td style={{ ...td, color: 'var(--ink-mute)' }}>{r.country || '—'}</td>
                <td style={{ ...td, color: 'var(--ink-mute)' }}>{r.top_source || '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.stays_count}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.total_nights}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(Number(r.lifetime_revenue || 0), 'USD')}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mute)' }}>
                  {r.avg_adr != null ? `$${Math.round(Number(r.avg_adr))}` : '—'}
                </td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mute)' }}>{r.last_stay_date || '—'}</td>
                <td style={{ ...td, textAlign: 'right', color: days != null && days > 365 ? 'var(--st-bad)' : 'var(--ink-mute)' }}>
                  {days != null ? `${days}d` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
