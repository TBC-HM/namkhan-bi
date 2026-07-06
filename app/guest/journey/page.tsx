// app/guest/journey/page.tsx
// PBS 2026-07-03 v2: pure white background · redesigned to mirror /guest/reputation.
// Reservation funnel + pre-stay contactability + in-stay engagement + post-stay
// follow-through, all wired to real tables. Honest empty states everywhere.

import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ResRow {
  status: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  booking_date: string | null;
  guest_email: string | null;
  source_name: string | null;
  total_amount: number | null;
}
interface DirRow {
  guest_id: string | null;
  email: string | null;
  phone: string | null;
  upcoming_stay_date: string | null;
  last_stay_date: string | null;
  arrival_bucket: string | null;
  spent_restaurant: boolean | null;
  spent_spa: boolean | null;
  spent_activities: boolean | null;
  spent_retail: boolean | null;
}
interface CampaignRecipient {
  email: string | null;
  sent_at: string | null;
  opened_at: string | null;
  unsubscribed_at: string | null;
}
interface UnsubRow { email: string | null; }
interface EventRow { stage: string | null; event_type: string | null; channel: string | null; occurred_at: string | null; }

function pct(num: number, den: number): number {
  if (!den) return 0;
  return (num / den) * 100;
}
function fmtNum(n: number): string { return n.toLocaleString('en-US'); }

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function GuestJourneyPage({ searchParams }: Props) {
  const daysParam = Array.isArray(searchParams.days) ? searchParams.days[0] : searchParams.days;
  const days = Math.max(7, Math.min(365, Number(daysParam) || 180));
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const last90Iso = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);

  const sb = getSupabaseAdmin();

  const [resR, dirR, eventsR, recipR, unsubR] = await Promise.all([
    sb.from('reservations')
      .select('status, check_in_date, check_out_date, booking_date, guest_email, source_name, total_amount')
      .eq('property_id', PROPERTY_ID)
      .gte('check_in_date', sinceIso),
    sb.schema('guest').from('v_directory_full')
      .select('guest_id, email, phone, upcoming_stay_date, last_stay_date, arrival_bucket, spent_restaurant, spent_spa, spent_activities, spent_retail')
      .eq('property_id', PROPERTY_ID),
    sb.schema('guest').from('journey_events')
      .select('stage, event_type, channel, occurred_at')
      .gte('occurred_at', new Date(Date.now() - days * 86_400_000).toISOString())
      .limit(20000),
    sb.schema('guest').from('campaign_recipients')
      .select('email, sent_at, opened_at, unsubscribed_at')
      .gte('sent_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
      .limit(20000),
    sb.schema('guest').from('unsubscribes')
      .select('email')
      .eq('property_id', PROPERTY_ID),
  ]);

  const all: ResRow[] = (resR.data as ResRow[]) ?? [];
  const dir: DirRow[] = (dirR.data as DirRow[]) ?? [];
  const events: EventRow[] = (eventsR.data as EventRow[]) ?? [];
  const recipients: CampaignRecipient[] = (recipR.data as CampaignRecipient[]) ?? [];
  const unsubs: UnsubRow[] = (unsubR.data as UnsubRow[]) ?? [];

  // ===== Reservation funnel =====
  const totalRes = all.length;
  const confirmed = all.filter(r => r.status && ['confirmed','checked_in','checked_out'].includes(r.status)).length;
  const arrived   = all.filter(r => r.status && ['checked_in','checked_out'].includes(r.status)).length;
  const inHouse   = all.filter(r => r.status === 'checked_in').length;
  const departed  = all.filter(r => r.status === 'checked_out').length;
  const canceled  = all.filter(r => r.status === 'canceled').length;
  const noShow    = all.filter(r => r.status === 'no_show').length;

  const confirmRate = pct(confirmed, totalRes);
  const arriveRate  = pct(arrived, confirmed);
  const cancelRate  = pct(canceled, totalRes);

  // Lead time (booking_date -> check_in_date)
  const leads = all
    .filter(r => r.booking_date && r.check_in_date)
    .map(r => Math.max(0, Math.floor((new Date(r.check_in_date!).getTime() - new Date(r.booking_date!).getTime()) / 86_400_000)));
  leads.sort((a, b) => a - b);
  const medLead = leads.length ? leads[Math.floor(leads.length / 2)] : null;
  const avgLead = leads.length ? leads.reduce((s, n) => s + n, 0) / leads.length : null;

  const leadBuckets = [
    { label: '0-7d',   n: leads.filter(d => d <= 7).length },
    { label: '8-14d',  n: leads.filter(d => d > 7 && d <= 14).length },
    { label: '15-30d', n: leads.filter(d => d > 14 && d <= 30).length },
    { label: '31-60d', n: leads.filter(d => d > 30 && d <= 60).length },
    { label: '61-90d', n: leads.filter(d => d > 60 && d <= 90).length },
    { label: '90+d',   n: leads.filter(d => d > 90).length },
  ];

  // ===== Pre-stay contactability (arrival_bucket populated = upcoming) =====
  const upcoming = dir.filter(d => d.arrival_bucket && ['next_7','next_30','next_90'].includes(d.arrival_bucket));
  const upTotal = upcoming.length;
  const upWithEmail = upcoming.filter(d => !!d.email).length;
  const upWithPhone = upcoming.filter(d => !!d.phone).length;
  const upWithBoth  = upcoming.filter(d => !!d.email && !!d.phone).length;

  // ===== In-stay engagement (guests checked in over the last 90d) =====
  const recentStays = dir.filter(d => d.last_stay_date && d.last_stay_date >= last90Iso && d.last_stay_date <= todayIso);
  const recentTotal = recentStays.length;
  const engRestaurant = recentStays.filter(d => d.spent_restaurant === true).length;
  const engSpa        = recentStays.filter(d => d.spent_spa === true).length;
  const engActivities = recentStays.filter(d => d.spent_activities === true).length;
  const engRetail     = recentStays.filter(d => d.spent_retail === true).length;

  // ===== Post-stay follow-through =====
  const unsubSet = new Set(unsubs.map(u => (u.email ?? '').toLowerCase()).filter(Boolean));
  const postOptedIn = recentStays.filter(d => !!d.email && !unsubSet.has((d.email ?? '').toLowerCase())).length;

  const sentEmailSet = new Set(
    recipients.filter(r => r.sent_at && r.email).map(r => (r.email ?? '').toLowerCase())
  );
  const openedEmailSet = new Set(
    recipients.filter(r => r.opened_at && r.email).map(r => (r.email ?? '').toLowerCase())
  );
  const postReached = recentStays.filter(d => d.email && sentEmailSet.has((d.email ?? '').toLowerCase())).length;
  const postOpened  = recentStays.filter(d => d.email && openedEmailSet.has((d.email ?? '').toLowerCase())).length;

  // ===== Journey events stage counts =====
  const eventsByStage = new Map<string, number>();
  for (const e of events) {
    const k = e.stage || 'unknown';
    eventsByStage.set(k, (eventsByStage.get(k) ?? 0) + 1);
  }
  const orderedStages = ['inquiry','pre_arrival','arrival','in_stay','departure','post_stay'];
  const stageRows = orderedStages
    .map(s => ({ stage: s, n: eventsByStage.get(s) ?? 0 }))
    .filter(r => r.n > 0);

  // Funnel data
  const funnel = [
    { label: 'Reservations', n: totalRes },
    { label: 'Confirmed',    n: confirmed },
    { label: 'Arrived',      n: arrived },
    { label: 'Departed',     n: departed },
  ];
  const funnelMax = Math.max(1, ...funnel.map(f => f.n));

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/journey',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Reservations',    value: totalRes,                              size: 'sm', footnote: `${days}d window` },
    { label: 'Confirm rate',    value: Number(confirmRate.toFixed(1)),        size: 'sm' },
    { label: 'Arrive rate',     value: Number(arriveRate.toFixed(1)),         size: 'sm', footnote: 'arrived / confirmed' },
    { label: 'Cancel rate',     value: Number(cancelRate.toFixed(1)),         size: 'sm', status: cancelRate > 25 ? 'red' : cancelRate > 10 ? 'amber' : 'green' },
    { label: 'Median lead',     value: medLead != null ? medLead : null,      size: 'sm', footnote: avgLead != null ? `avg ${avgLead.toFixed(0)}d` : undefined },
    { label: 'No-shows',        value: noShow,                                size: 'sm', status: noShow > 3 ? 'red' : noShow > 0 ? 'amber' : 'green' },
    { label: 'In-house now',    value: inHouse,                               size: 'sm' },
  ];

  const WHITE = '#FFFFFF';
  const HAIR  = '#E6DFCC';
  const INK   = '#1B1B1B';
  const INK_S = '#3A3A3A';
  const INK_M = '#5A5A5A';
  const GREEN = '#1F3A2E';
  const RED   = '#B03826';
  const AMBER = '#8B5A1C';

  const sectionHead: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: INK_M, margin: '8px 2px 8px',
  };
  const cardStyle: React.CSSProperties = {
    background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: '14px 16px',
  };
  const microTile: React.CSSProperties = {
    padding: '10px 12px', border: '1px solid ' + HAIR, borderRadius: 4, background: WHITE,
  };
  const microLabel: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 600,
  };
  const microValue: React.CSSProperties = {
    fontSize: 20, fontWeight: 600, color: INK, marginTop: 2,
  };
  const microSub: React.CSSProperties = {
    fontSize: 11, color: INK_M, marginTop: 2, fontWeight: 400,
  };

  function CoverageRow({ label, n, den, note }: { label: string; n: number; den: number; note?: string }) {
    const p = pct(n, den);
    const color = p >= 80 ? GREEN : p >= 50 ? AMBER : RED;
    return (
      <div style={microTile}>
        <div style={microLabel}>{label}</div>
        <div style={{ ...microValue, color }}>{p.toFixed(0)}%</div>
        <div style={microSub}>{n} of {den}{note ? ` · ${note}` : ''}</div>
      </div>
    );
  }

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Contacts · Journey"
        subtitle="From inquiry to repeat - every touchpoint, every drop."
        tabs={tabs}
      >
        {/* KPI STRIP TOP */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* FUNNEL + LEAD-TIME (side by side) */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHead}>Reservation funnel &amp; lead-time</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(340px, 1fr))', gap:8 }}>
            <div style={cardStyle}>
              <div style={{ fontSize:12, fontWeight:600, color:INK, marginBottom:2 }}>Reservation funnel</div>
              <div style={{ fontSize:11, color:INK_M, marginBottom:10 }}>Every drop-off across the {days}d window · source: public.reservations</div>
              <FunnelSvg rows={funnel} max={funnelMax} ink={INK} inkSoft={INK_S} inkMute={INK_M} hair={HAIR} green={GREEN} />
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize:12, fontWeight:600, color:INK, marginBottom:2 }}>Lead-time distribution</div>
              <div style={{ fontSize:11, color:INK_M, marginBottom:10 }}>
                booking_date &rarr; check_in_date · median {medLead != null ? `${medLead}d` : '—'} · avg {avgLead != null ? `${avgLead.toFixed(0)}d` : '—'}
              </div>
              <LeadTimeSvg buckets={leadBuckets} ink={INK} inkMute={INK_M} hair={HAIR} green={GREEN} amber={AMBER} red={RED} />
            </div>
          </div>
        </div>

        {/* PRE-STAY CONTACTABILITY */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHead}>Pre-stay contactability</div>
          <div style={cardStyle}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap:8, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:INK }}>Upcoming arrivals: {upTotal}</div>
                <div style={{ fontSize:11, color:INK_M }}>Guests with arrival_bucket in next_7 / next_30 / next_90 · source: guest.v_directory_full</div>
              </div>
            </div>
            {upTotal === 0 ? (
              <div style={{ padding:'20px 12px', background:'#FAFAF7', border:'1px dashed '+HAIR, borderRadius:4, textAlign:'center', color:INK_M, fontSize:11 }}>
                No upcoming arrivals with an arrival_bucket set. Once reservations for the next 90 days are synced, this panel will fill in.
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
                <CoverageRow label="Email on file"     n={upWithEmail} den={upTotal} note="pre-arrival email reach" />
                <CoverageRow label="Phone on file"     n={upWithPhone} den={upTotal} note="SMS + WhatsApp reach" />
                <CoverageRow label="Email &amp; phone" n={upWithBoth}  den={upTotal} note="dual-channel reachable" />
              </div>
            )}
          </div>
        </div>

        {/* IN-STAY ENGAGEMENT */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHead}>In-stay engagement</div>
          <div style={cardStyle}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap:8, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:INK }}>Guests who stayed in last 90d: {recentTotal}</div>
                <div style={{ fontSize:11, color:INK_M }}>Share who spent in each outlet · source: guest.v_directory_full spent_* flags</div>
              </div>
            </div>
            {recentTotal === 0 ? (
              <div style={{ padding:'20px 12px', background:'#FAFAF7', border:'1px dashed '+HAIR, borderRadius:4, textAlign:'center', color:INK_M, fontSize:11 }}>
                No guests with last_stay_date in the last 90 days. Once folios and directory refresh runs, this fills.
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
                <CoverageRow label="Restaurant" n={engRestaurant} den={recentTotal} note="hit F&amp;B" />
                <CoverageRow label="Spa"        n={engSpa}        den={recentTotal} note="hit spa" />
                <CoverageRow label="Activities" n={engActivities} den={recentTotal} note="hit activities" />
                <CoverageRow label="Retail"     n={engRetail}     den={recentTotal} note="hit retail" />
              </div>
            )}
          </div>
        </div>

        {/* POST-STAY FOLLOW-THROUGH */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHead}>Post-stay follow-through</div>
          <div style={cardStyle}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap:8, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:INK }}>Departures in last 90d: {recentTotal}</div>
                <div style={{ fontSize:11, color:INK_M }}>Newsletter reach + open rate · source: guest.campaign_recipients + guest.unsubscribes</div>
              </div>
            </div>
            {recentTotal === 0 ? (
              <div style={{ padding:'20px 12px', background:'#FAFAF7', border:'1px dashed '+HAIR, borderRadius:4, textAlign:'center', color:INK_M, fontSize:11 }}>
                No recent departures — post-stay panel fills in once check-outs land in guest.v_directory_full.
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
                <CoverageRow label="Opted in"          n={postOptedIn}  den={recentTotal} note="email &amp; not unsubscribed" />
                <CoverageRow label="Newsletter sent"   n={postReached}  den={recentTotal} note="last 90d campaigns" />
                <CoverageRow label="Newsletter opened" n={postOpened}   den={recentTotal} note="opened at least once" />
              </div>
            )}
            <div style={{ marginTop:10, padding:'10px 12px', background:'#FAFAF7', border:'1px dashed '+HAIR, borderRadius:4, color:INK_M, fontSize:11, lineHeight:1.5 }}>
              <strong>Not shown yet:</strong> % that left a review will land here once Google Business Profile is connected on
              <code style={{ padding:'0 4px' }}>/guest/reputation</code> and reviews start flowing into <code>marketing.reviews</code>.
            </div>
          </div>
        </div>

        {/* TOUCHPOINTS TABLE */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={sectionHead}>Touchpoints by stage</div>
          {stageRows.length === 0 || events.length === 0 ? (
            <div style={{ padding:'32px 24px', background:WHITE, border:'1px solid '+HAIR, borderRadius:6, textAlign:'center', color:INK_M, fontSize:12, lineHeight:1.5 }}>
              No touchpoint events logged yet — pre-arrival emails, post-stay surveys, and SMS will write to
              <code style={{ padding:'0 4px' }}>guest.journey_events</code> once Make scenarios are wired.
            </div>
          ) : (
            <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ padding:'8px 12px', textAlign:'left',  fontWeight:600, borderBottom:'1px solid '+HAIR, color:INK_S }}>Stage</th>
                    <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, borderBottom:'1px solid '+HAIR, color:INK_S }}>Events</th>
                    <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, borderBottom:'1px solid '+HAIR, color:INK_S }}>% of total</th>
                  </tr>
                </thead>
                <tbody>
                  {stageRows.map(r => (
                    <tr key={r.stage} style={{ borderBottom:'1px solid #F5F0E1' }}>
                      <td style={{ padding:'8px 12px', color:INK, fontWeight:500 }}>{r.stage}</td>
                      <td style={{ padding:'8px 12px', textAlign:'right' }}>{fmtNum(r.n)}</td>
                      <td style={{ padding:'8px 12px', textAlign:'right', color:INK_M }}>{Math.round(pct(r.n, events.length))}%</td>
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

// ===== SVG helpers =====

function FunnelSvg({
  rows, max, ink, inkSoft, inkMute, hair, green,
}: {
  rows: { label: string; n: number }[]; max: number;
  ink: string; inkSoft: string; inkMute: string; hair: string; green: string;
}) {
  const w = 320, lineH = 34, h = rows.length * lineH + 12;
  const labelW = 120, valW = 40, barMaxW = w - labelW - valW - 8;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
      {rows.map((r, i) => {
        const y = 6 + i * lineH;
        const barW = (r.n / max) * barMaxW;
        const dropPct = i > 0 && rows[i - 1].n > 0 ? (r.n / rows[i - 1].n) * 100 : null;
        return (
          <g key={r.label}>
            <text x={labelW - 6} y={y + 18} textAnchor="end" style={{ fontSize: 11, fill: ink, fontWeight: 500 }}>
              {r.label}
            </text>
            <rect x={labelW} y={y + 6} width={barMaxW} height={22} fill="#FAFAF7" stroke={hair} />
            <rect x={labelW} y={y + 6} width={barW} height={22} fill={green}>
              <title>{`${r.label} · ${r.n.toLocaleString()} reservations${dropPct != null ? ` · ${dropPct.toFixed(1)}% of prior stage` : ''}`}</title>
            </rect>
            <text x={labelW + barMaxW + 4} y={y + 21} style={{ fontSize: 11, fill: inkSoft, fontWeight: 600 }}>
              {r.n}
            </text>
            {dropPct != null && barW > 40 && (
              <text x={labelW + 6} y={y + 21} style={{ fontSize: 10, fill: '#FFFFFF', fontWeight: 600 }}>
                {dropPct.toFixed(0)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LeadTimeSvg({
  buckets, ink, inkMute, hair, green, amber, red,
}: {
  buckets: { label: string; n: number }[];
  ink: string; inkMute: string; hair: string; green: string; amber: string; red: string;
}) {
  const total = buckets.reduce((s, b) => s + b.n, 0);
  if (total === 0) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: inkMute, fontSize: 11 }}>
        No reservations in window
      </div>
    );
  }
  const w = 320, h = 200, padL = 8, padR = 4, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...buckets.map(b => b.n));
  const groupW = innerW / buckets.length;
  const barW = groupW * 0.7;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
      {buckets.map((b, i) => {
        const x = padL + i * groupW + (groupW - barW) / 2;
        const bh = (b.n / max) * innerH;
        const y = padT + innerH - bh;
        const fill = i <= 1 ? red : i <= 3 ? amber : green;
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={barW} height={bh} fill={fill}>
              <title>{`${b.label} · ${b.n.toLocaleString()} of ${total.toLocaleString()} · ${((b.n / total) * 100).toFixed(1)}%`}</title>
            </rect>
            {b.n > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" style={{ fontSize: 10, fill: ink, fontWeight: 500 }}>
                {b.n}
              </text>
            )}
            <text x={x + barW / 2} y={h - 12} textAnchor="middle" style={{ fontSize: 10, fill: inkMute }}>
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}