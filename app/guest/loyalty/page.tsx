// app/guest/loyalty/page.tsx
// PBS 2026-07-03: pure white background · mirrors reputation page pattern
// Repeat curve · LTV cohorts · recency distribution · winback + VIP tables · tier ladder.

import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ProfileRow {
  guest_id: string;
  full_name: string | null;
  country: string | null;
  email: string | null;
  bookings_count: number | null;
  stays_count: number | null;
  lifetime_revenue: number | null;
  total_nights: number | null;
  avg_adr: number | null;
  first_stay_date: string | null;
  last_stay_date: string | null;
  is_repeat: boolean | null;
  top_source: string | null;
  top_segment: string | null;
  marketing_readiness_score: number | null;
}
interface LoyaltyMemberRow {
  guest_id: string | null;
  program_external_id: string | null;
  tier_label: string | null;
  points_balance: number | null;
  joined_at: string | null;
  status: string | null;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
function daysBetween(iso: string | null, todayMs: number): number | null {
  if (!iso) return null;
  return Math.floor((todayMs - new Date(iso).getTime()) / 86_400_000);
}

export default async function GuestLoyaltyPage() {
  const sb = getSupabaseAdmin();
  const todayMs = Date.now();
  const thisYearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

  const [profilesR, membersR] = await Promise.all([
    sb.schema('guest').from('mv_guest_profile')
      .select('guest_id, full_name, country, email, bookings_count, stays_count, lifetime_revenue, total_nights, avg_adr, first_stay_date, last_stay_date, is_repeat, top_source, top_segment, marketing_readiness_score')
      .eq('property_id', PROPERTY_ID)
      .order('lifetime_revenue', { ascending: false })
      .limit(5000),
    sb.schema('guest').from('loyalty_members')
      .select('guest_id, program_external_id, tier_label, points_balance, joined_at, status')
      .limit(2000),
  ]);

  const profiles: ProfileRow[] = (profilesR.data as ProfileRow[]) ?? [];
  const members:  LoyaltyMemberRow[] = (membersR.data as LoyaltyMemberRow[]) ?? [];

  // ---------- KPIs ----------
  const totalGuests   = profiles.length;
  const stayedGuests  = profiles.filter(p => Number(p.stays_count ?? 0) >= 1);
  const repeatGuests  = profiles.filter(p => Number(p.stays_count ?? 0) >= 2);
  const repeatRate    = stayedGuests.length > 0 ? (repeatGuests.length / stayedGuests.length) * 100 : 0;

  const totalLtv      = profiles.reduce((s, p) => s + Number(p.lifetime_revenue ?? 0), 0);
  const avgLtvAll     = totalGuests > 0 ? totalLtv / totalGuests : 0;
  const totalLtvRep   = repeatGuests.reduce((s, p) => s + Number(p.lifetime_revenue ?? 0), 0);
  const avgLtvRepeat  = repeatGuests.length > 0 ? totalLtvRep / repeatGuests.length : 0;

  const winback = profiles
    .filter(p =>
      Number(p.stays_count ?? 0) >= 2 &&
      p.email && String(p.email).includes('@') &&
      p.last_stay_date &&
      daysBetween(p.last_stay_date, todayMs)! > 365,
    )
    .sort((a, b) => Number(b.lifetime_revenue ?? 0) - Number(a.lifetime_revenue ?? 0))
    .slice(0, 25);
  const winbackTotal = profiles.filter(p =>
    Number(p.stays_count ?? 0) >= 2 &&
    p.email && String(p.email).includes('@') &&
    p.last_stay_date &&
    daysBetween(p.last_stay_date, todayMs)! > 365,
  ).length;

  const vips = repeatGuests
    .sort((a, b) => Number(b.lifetime_revenue ?? 0) - Number(a.lifetime_revenue ?? 0))
    .slice(0, 25);

  // ---------- Retention curve (stays_count buckets, excludes 0-stays) ----------
  const retentionBuckets: { key: string; label: string; n: number }[] = [
    { key: '1',  label: '1 stay',   n: 0 },
    { key: '2',  label: '2 stays',  n: 0 },
    { key: '3',  label: '3 stays',  n: 0 },
    { key: '4',  label: '4 stays',  n: 0 },
    { key: '5+', label: '5+ stays', n: 0 },
  ];
  for (const p of stayedGuests) {
    const s = Number(p.stays_count ?? 0);
    if (s === 1) retentionBuckets[0].n += 1;
    else if (s === 2) retentionBuckets[1].n += 1;
    else if (s === 3) retentionBuckets[2].n += 1;
    else if (s === 4) retentionBuckets[3].n += 1;
    else if (s >= 5) retentionBuckets[4].n += 1;
  }
  const retentionTotal = retentionBuckets.reduce((s, b) => s + b.n, 0);

  // ---------- LTV cohorts ----------
  const ltvCohorts = [
    { label: '0–500',     min: 0,    max: 500,      n: 0, sum: 0 },
    { label: '500–1.5k',  min: 500,  max: 1500,     n: 0, sum: 0 },
    { label: '1.5k–5k',   min: 1500, max: 5000,     n: 0, sum: 0 },
    { label: '5k+',       min: 5000, max: Infinity, n: 0, sum: 0 },
  ];
  for (const p of profiles) {
    const v = Number(p.lifetime_revenue ?? 0);
    const c = ltvCohorts.find(cc => v >= cc.min && v < cc.max);
    if (c) { c.n += 1; c.sum += v; }
  }
  const ltvCohortMax = Math.max(1, ...ltvCohorts.map(c => c.n));

  // ---------- Recency (time since last stay) ----------
  const recencyBuckets = [
    { label: '0–6 mo',  min: 0,   max: 182,      n: 0 },
    { label: '6–12 mo', min: 183, max: 365,      n: 0 },
    { label: '1–2 y',   min: 366, max: 730,      n: 0 },
    { label: '2–5 y',   min: 731, max: 1825,     n: 0 },
    { label: '5 y+',    min: 1826,max: Infinity, n: 0 },
  ];
  for (const p of stayedGuests) {
    const d = daysBetween(p.last_stay_date, todayMs);
    if (d == null) continue;
    const b = recencyBuckets.find(bb => d >= bb.min && d <= bb.max);
    if (b) b.n += 1;
  }
  const recencyTotal = recencyBuckets.reduce((s, b) => s + b.n, 0);
  const recencyMax = Math.max(1, ...recencyBuckets.map(b => b.n));

  // ---------- Tier ladder (from loyalty_members) ----------
  const tierMap = new Map<string, { n: number; joinedYtd: number }>();
  for (const m of members) {
    const t = m.tier_label ?? 'unknown';
    if (!tierMap.has(t)) tierMap.set(t, { n: 0, joinedYtd: 0 });
    const row = tierMap.get(t)!;
    row.n += 1;
    if (m.joined_at && String(m.joined_at).slice(0, 10) >= thisYearStart) row.joinedYtd += 1;
  }
  const tierRows = Array.from(tierMap.entries())
    .map(([tier, v]) => ({ tier, count: v.n, joinedYtd: v.joinedYtd, pct: members.length > 0 ? (v.n / members.length) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/loyalty',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Total guests',       value: totalGuests,               size: 'sm' },
    { label: 'Repeat guests',      value: repeatGuests.length,       size: 'sm', footnote: '≥ 2 stays' },
    { label: 'Repeat rate',        value: repeatRate,                size: 'sm', footnote: 'target ≥ 25%', status: repeatRate >= 25 ? 'green' : repeatRate >= 15 ? 'amber' : 'red' },
    { label: 'Avg LTV',            value: Math.round(avgLtvAll),     size: 'sm', footnote: 'all guests' },
    { label: 'Avg LTV · repeat',   value: Math.round(avgLtvRepeat),  size: 'sm', footnote: '≥ 2 stays' },
    { label: 'Win-back',           value: winbackTotal,              size: 'sm', footnote: 'last stay > 1y · email', status: winbackTotal > 0 ? 'amber' : 'green' },
    { label: 'Loyalty members',    value: members.length,            size: 'sm', footnote: 'guest.loyalty_members' },
  ];

  const WHITE = '#FFFFFF';
  const HAIR  = '#E6DFCC';
  const INK   = '#1B1B1B';
  const INK_S = '#3A3A3A';
  const INK_M = '#5A5A5A';
  const GREEN = '#1F3A2E';
  const RED   = '#B03826';
  const AMBER = '#8B5A1C';

  const sectionH: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, margin: '8px 2px 8px' };
  const cardBox: React.CSSProperties = { background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: '14px 16px' };
  const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid ' + HAIR, color: INK_S, fontSize: 11 };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #F5F0E1', color: INK, fontSize: 12 };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' };

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Contacts · Loyalty"
        subtitle="Who comes back — and who is about to slip."
        tabs={tabs}
      >
        {/* KPI STRIP TOP */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* THREE CHARTS ROW */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 8 }}>

          {/* Retention curve */}
          <div style={cardBox}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 4 }}>Retention curve</div>
            <div style={{ fontSize: 11, color: INK_M, marginBottom: 12 }}>Guests by number of stays · {fmtNum(retentionTotal)} guests who stayed</div>
            {retentionTotal === 0 ? (
              <EmptyBox text="No stays yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {retentionBuckets.map(b => {
                  const pct = retentionTotal > 0 ? (b.n / retentionTotal) * 100 : 0;
                  const barPct = Math.max(0, Math.min(100, pct));
                  return (
                    <div key={b.key} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 90px', gap: 8, alignItems: 'center', fontSize: 11 }}>
                      <span style={{ color: INK_S }}>{b.label}</span>
                      <div style={{ position: 'relative', height: 14, background: '#FAF6EB', border: '1px solid ' + HAIR, borderRadius: 3 }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: barPct + '%', background: b.key === '1' ? '#B8AE93' : b.key === '2' ? GREEN : b.key === '5+' ? '#0F2A1E' : '#2D5941' }} />
                      </div>
                      <span style={{ textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(b.n)} · {pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LTV cohorts */}
          <div style={cardBox}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 4 }}>LTV cohorts</div>
            <div style={{ fontSize: 11, color: INK_M, marginBottom: 12 }}>Guests bucketed by lifetime revenue</div>
            {totalGuests === 0 ? (
              <EmptyBox text="No profiles yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ltvCohorts.map((c, i) => {
                  const pct = totalGuests > 0 ? (c.n / totalGuests) * 100 : 0;
                  const barPct = Math.max(0, Math.min(100, (c.n / ltvCohortMax) * 100));
                  return (
                    <div key={c.label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 130px', gap: 8, alignItems: 'center', fontSize: 11 }}>
                      <span style={{ color: INK_S }}>{c.label}</span>
                      <div style={{ position: 'relative', height: 14, background: '#FAF6EB', border: '1px solid ' + HAIR, borderRadius: 3 }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: barPct + '%', background: i === 0 ? '#B8AE93' : i === 1 ? '#8FA37F' : i === 2 ? GREEN : '#0F2A1E' }} />
                      </div>
                      <span style={{ textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(c.n)} · {pct.toFixed(0)}% · Σ{fmtNum(c.sum)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recency */}
          <div style={cardBox}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 4 }}>Recency</div>
            <div style={{ fontSize: 11, color: INK_M, marginBottom: 12 }}>Time since last stay · win-back zone right of centre</div>
            {recencyTotal === 0 ? (
              <EmptyBox text="No stays recorded." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recencyBuckets.map((b, i) => {
                  const pct = recencyTotal > 0 ? (b.n / recencyTotal) * 100 : 0;
                  const barPct = Math.max(0, Math.min(100, (b.n / recencyMax) * 100));
                  const fill = i === 0 ? GREEN : i === 1 ? '#2D5941' : i === 2 ? AMBER : i === 3 ? '#A34527' : RED;
                  return (
                    <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 90px', gap: 8, alignItems: 'center', fontSize: 11 }}>
                      <span style={{ color: INK_S }}>{b.label}</span>
                      <div style={{ position: 'relative', height: 14, background: '#FAF6EB', border: '1px solid ' + HAIR, borderRadius: 3 }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: barPct + '%', background: fill }} />
                      </div>
                      <span style={{ textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(b.n)} · {pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* WIN-BACK TABLE */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={sectionH}>Win-back candidates · top 25 by LTV</div>
          {winback.length === 0 ? (
            <div style={{ padding: '32px 24px', background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, textAlign: 'center', color: INK_M, fontSize: 12 }}>
              No win-back candidates — every repeat guest has stayed within the last 12 months, or has no email on file.
            </div>
          ) : (
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Guest</th>
                    <th style={th}>Country</th>
                    <th style={th}>Source</th>
                    <th style={thR}>Stays</th>
                    <th style={thR}>Last stay</th>
                    <th style={thR}>Days since</th>
                    <th style={thR}>LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {winback.map(r => {
                    const days = daysBetween(r.last_stay_date, todayMs);
                    return (
                      <tr key={r.guest_id}>
                        <td style={td}>
                          <div style={{ fontWeight: 600, color: INK }}>{r.full_name ?? '—'}</div>
                          {r.email && <div style={{ fontSize: 11, color: INK_M }}>{r.email}</div>}
                        </td>
                        <td style={{ ...td, color: INK_S }}>{r.country ?? '—'}</td>
                        <td style={{ ...td, color: INK_S }}>{r.top_source ?? '—'}</td>
                        <td style={tdR}>{r.stays_count ?? 0}</td>
                        <td style={tdR}>{fmtDate(r.last_stay_date)}</td>
                        <td style={{ ...tdR, color: days != null && days > 730 ? RED : days != null && days > 365 ? AMBER : INK_M }}>
                          {days != null ? days + 'd' : '—'}
                        </td>
                        <td style={{ ...tdR, fontWeight: 600 }}>{fmtNum(Number(r.lifetime_revenue ?? 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* VIP TABLE */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={sectionH}>VIP guests · top 25 by LTV (≥ 2 stays)</div>
          {vips.length === 0 ? (
            <div style={{ padding: '32px 24px', background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, textAlign: 'center', color: INK_M, fontSize: 12 }}>
              No repeat guests yet.
            </div>
          ) : (
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Guest</th>
                    <th style={th}>Country</th>
                    <th style={thR}>Stays</th>
                    <th style={thR}>Nights</th>
                    <th style={thR}>Avg ADR</th>
                    <th style={thR}>Last stay</th>
                    <th style={thR}>LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {vips.map(r => (
                    <tr key={r.guest_id}>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: INK }}>{r.full_name ?? '—'}</div>
                        {r.email && <div style={{ fontSize: 11, color: INK_M }}>{r.email}</div>}
                      </td>
                      <td style={{ ...td, color: INK_S }}>{r.country ?? '—'}</td>
                      <td style={tdR}>{r.stays_count ?? 0}</td>
                      <td style={tdR}>{r.total_nights ?? 0}</td>
                      <td style={{ ...tdR, color: INK_S }}>{r.avg_adr != null ? fmtNum(Number(r.avg_adr)) : '—'}</td>
                      <td style={tdR}>{fmtDate(r.last_stay_date)}</td>
                      <td style={{ ...tdR, fontWeight: 600 }}>{fmtNum(Number(r.lifetime_revenue ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TIER LADDER */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={sectionH}>Loyalty programme · tier ladder</div>
          {tierRows.length === 0 ? (
            <div style={{ padding: '32px 24px', background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, textAlign: 'center', color: INK_M, fontSize: 12 }}>
              No members enrolled in <code>guest.loyalty_members</code> yet. Programme not launched.
            </div>
          ) : (
            <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Tier</th>
                    <th style={thR}>Members</th>
                    <th style={thR}>% of total</th>
                    <th style={thR}>Joined YTD</th>
                  </tr>
                </thead>
                <tbody>
                  {tierRows.map(r => (
                    <tr key={r.tier}>
                      <td style={{ ...td, fontWeight: 600, textTransform: 'capitalize' }}>{r.tier}</td>
                      <td style={tdR}>{fmtNum(r.count)}</td>
                      <td style={{ ...tdR, color: INK_M }}>{r.pct.toFixed(1)}%</td>
                      <td style={tdR}>{fmtNum(r.joinedYtd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </DashboardPage>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 12px', background: '#FAFAF7', border: '1px dashed #E6DFCC', borderRadius: 4, textAlign: 'center', color: '#5A5A5A', fontSize: 11 }}>
      {text}
    </div>
  );
}