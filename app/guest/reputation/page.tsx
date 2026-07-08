// app/guest/reputation/page.tsx
// PBS 2026-07-04 v7 clean rewrite: source cards driven by
// marketing.review_source_summary (real rating + reviews-on-platform + ranking).
// Sorted by importance: Google · TripAdvisor · Booking · Expedia · Trip.com.
// 5 cards in one row on desktop (minmax 200px).

import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import SourceBadge from '@/components/marketing/SourceBadge';
import ReputationReviewsTabs from './_components/ReputationReviewsTabs';
import SentimentContainer from './_components/SentimentContainer';
import ReportContainer from './_components/ReportContainer';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface OAuthRow {
  property_id: number;
  google_account_id: string | null; location_id: string | null; location_name: string | null;
  connected_by: string | null; connected_at: string | null; scope: string | null;
}
interface ReviewRow {
  id: number; source: string; reviewer_name: string | null;
  rating_norm: number | null; title: string | null; body: string | null;
  reviewed_at: string | null; response_status: string | null; response_text: string | null;
}
interface MapsRow {
  date: string; impressions_search: number | null; impressions_maps: number | null;
  direction_requests: number | null; phone_taps: number | null; website_clicks: number | null;
}
interface ListingRow {
  channel: string; url: string | null; admin_url: string | null;
  external_id: string | null; is_active: boolean; category: string;
}
interface SummaryRow {
  source: string;
  total_reviews_on_platform: number | null;
  ranking_position: number | null;
  ranking_total: number | null;
  ranking_context: string | null;
  score_overall: number | null;
}

const SOURCE_LABEL: Record<string,string> = {
  google:'Google', tripadvisor:'TripAdvisor', booking:'Booking.com', expedia:'Expedia',
  agoda:'Agoda', direct:'Direct', cloudbeds:'Cloudbeds', ctrip:'Trip.com',
};

const SOURCE_PRIORITY: Record<string, number> = {
  google: 1, tripadvisor: 2, booking: 3, expedia: 4, ctrip: 5,
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function sumWindow(rows: MapsRow[], days: number, field: keyof MapsRow) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0,10);
  return rows.filter(r => r.date >= cutoffStr).reduce((s,r) => s + (Number(r[field]) || 0), 0);
}
function fmtNum(n: number): string { return n.toLocaleString('en-US'); }

interface PageProps { searchParams: Record<string, string | string[] | undefined>; propertyId?: number }

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#3A3A3A';
const INK_M = '#5A5A5A';
const GREEN = '#1F3A2E';
const RED   = '#B03826';

export default async function GuestReputationPage({ searchParams, propertyId }: PageProps) {
  const pid = propertyId ?? PROPERTY_ID;
  const sb = getSupabaseAdmin();

  const [oauthR, reviewsR, mapsR, listingsR, summaryR] = await Promise.all([
    sb.schema('marketing').from('google_oauth_tokens').select('*').eq('property_id', pid).maybeSingle(),
    sb.from('mkt_reviews').select('*').eq('property_id', pid).order('reviewed_at', { ascending: false }).limit(50),
    sb.schema('kpi').from('google_maps_daily').select('date, impressions_search, impressions_maps, direction_requests, phone_taps, website_clicks').eq('property_id', pid).order('date', { ascending: false }).limit(400),
    sb.from('v_external_listings').select('*').eq('property_id', pid).eq('category','reputation'),
    sb.from('v_review_source_summary').select('*').eq('property_id', pid),
  ]);

  const oauth: OAuthRow | null = (oauthR.data as OAuthRow | null) ?? null;
  const reviews: ReviewRow[] = (reviewsR.data as ReviewRow[]) ?? [];
  const mapsRows: MapsRow[] = (mapsR.data as MapsRow[]) ?? [];
  const listings: ListingRow[] = ((listingsR.data as ListingRow[]) ?? [])
    .slice().sort((a, b) => (SOURCE_PRIORITY[a.channel] ?? 99) - (SOURCE_PRIORITY[b.channel] ?? 99));
  const summaryArr: SummaryRow[] = (summaryR.data as SummaryRow[]) ?? [];
  const summaryMap: Record<string, SummaryRow> = Object.fromEntries(summaryArr.map(s => [s.source, s]));

  // Aggregate KPI (platform totals, not scraped sample)
  const totalPlatformReviews = summaryArr.reduce((s, r) => s + (r.total_reviews_on_platform ?? 0), 0);
  const weightedAvg = totalPlatformReviews > 0
    ? summaryArr.reduce((s, r) => s + ((r.total_reviews_on_platform ?? 0) * (Number(r.score_overall) || 0)), 0) / totalPlatformReviews
    : null;

  const googleReviews = reviews.filter(r => r.source === 'google');
  const googleAvg = googleReviews.length > 0
    ? googleReviews.reduce((s,r) => s + (Number(r.rating_norm) || 0), 0) / googleReviews.length : null;

  const total = reviews.length;
  const responded  = reviews.filter(r => r.response_status === 'responded').length;
  const unanswered = reviews.filter(r => r.response_status === 'unanswered').length;
  const responseRate = total > 0 ? (responded / total) * 100 : 0;

  // 5 canonical review sources — always shown in the table + tabs even when empty.
  const CANONICAL_SOURCES = ['google', 'tripadvisor', 'booking', 'expedia', 'ctrip'] as const;

  const sourceMix = new Map<string, { n: number; sum: number }>();
  for (const s of CANONICAL_SOURCES) sourceMix.set(s, { n: 0, sum: 0 });   // seed zeros
  for (const r of reviews) {
    const k = r.source ?? 'unknown';
    if (!sourceMix.has(k)) sourceMix.set(k, { n: 0, sum: 0 });
    const s = sourceMix.get(k)!; s.n += 1; s.sum += Number(r.rating_norm) || 0;
  }
  const sourceRows = Array.from(sourceMix.entries())
    .map(([source, v]) => ({ source, count: v.n, avg: v.n > 0 ? v.sum / v.n : null }))
    // Canonical sources first (in fixed order), then everything else by count desc
    .sort((a, b) => {
      const ai = (CANONICAL_SOURCES as readonly string[]).indexOf(a.source);
      const bi = (CANONICAL_SOURCES as readonly string[]).indexOf(b.source);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b.count - a.count;
    });

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/reputation',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Total reviews',   value: totalPlatformReviews, size: 'sm', footnote: 'across 5 platforms' },
    { label: 'Weighted avg /5', value: weightedAvg != null ? weightedAvg.toFixed(2) : '—', size: 'sm', footnote: weightedAvg != null ? '= ' + (weightedAvg*2).toFixed(2) + '/10 · weighted by review count' : 'weighted by review count' },
    { label: 'Sources live',    value: summaryArr.filter(s => s.score_overall != null).length, size: 'sm' },
    { label: 'Unanswered (local)', value: unanswered, size: 'sm', status: unanswered > 5 ? 'red' : unanswered > 0 ? 'amber' : 'green' },
    { label: 'Response rate',   value: responseRate, size: 'sm' },
  ];

  const googleParam = (Array.isArray(searchParams.google) ? searchParams.google[0] : searchParams.google) ?? null;
  const reasonParam = (Array.isArray(searchParams.reason) ? searchParams.reason[0] : searchParams.reason) ?? null;
  const stepParam   = (Array.isArray(searchParams.step)   ? searchParams.step[0]   : searchParams.step)   ?? null;
  const locationParam = (Array.isArray(searchParams.location) ? searchParams.location[0] : searchParams.location) ?? null;

  const mapsWindows = [7, 30, 90, 365].map(w => ({
    days: w,
    impressions: sumWindow(mapsRows, w, 'impressions_search') + sumWindow(mapsRows, w, 'impressions_maps'),
    directions:  sumWindow(mapsRows, w, 'direction_requests'),
    phone:       sumWindow(mapsRows, w, 'phone_taps'),
    website:     sumWindow(mapsRows, w, 'website_clicks'),
  }));

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage title="Contacts · Reputation" subtitle="Every review, every reply — one place." tabs={tabs}>

        {googleParam === 'connected' && (
          <div style={{ gridColumn:'1 / -1', padding:'10px 14px', borderRadius:4, background:'#E4F1E0', border:'1px solid #A9CFA0', color:GREEN, fontSize:12 }}>
            <strong>Google Business Profile connected</strong>{locationParam ? ' — ' + locationParam : ''}. First review + Maps pull will run automatically within a minute.
          </div>
        )}
        {googleParam === 'error' && (
          <div style={{ gridColumn:'1 / -1', padding:'10px 14px', borderRadius:4, background:'#FBE8E4', border:'1px solid #E8B7AB', color:RED, fontSize:12 }}>
            <strong>Google connect failed</strong>{stepParam ? ' at ' + stepParam : ''}. Reason: <code>{reasonParam ?? 'unknown'}</code>.{' '}
            <TenantLink href={`/api/google/oauth/connect?property=${pid}`} style={{ color:RED, fontWeight:600, textDecoration:'underline' }}>Try again →</TenantLink>
          </div>
        )}

        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>


        {oauth && oauth.location_id && (
          <div style={{ gridColumn:'1 / -1', background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <SourceBadge source="google" size="md" />
                  <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M }}>Google Business Profile</span>
                </div>
                <div style={{ fontSize:16, fontWeight:600, color:INK }}>{oauth.location_name ?? 'Location auto-detection pending'}</div>
                <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>Connected {fmtDate(oauth.connected_at)}</div>
              </div>
              <TenantLink href={`/api/google/pull-now?property=${pid}`} style={{ padding:'5px 12px', fontSize:11, fontWeight:600, background:GREEN, color:WHITE, border:'none', borderRadius:4, textDecoration:'none' }}>Pull latest</TenantLink>
            </div>
            <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600, marginBottom:6 }}>Maps insights</div>
            {mapsRows.length === 0 ? (
              <div style={{ padding:'20px 12px', background:'#FAFAF7', border:'1px dashed '+HAIR, borderRadius:4, textAlign:'center', color:INK_M, fontSize:11 }}>
                No Maps insights yet. First pull happens within the minute after Google API access is approved.
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
                {mapsWindows.map(w => (
                  <div key={w.days} style={{ padding:'10px 12px', border:'1px solid '+HAIR, borderRadius:4 }}>
                    <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600, marginBottom:4 }}>Last {w.days}d</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'2px 8px', fontSize:11 }}>
                      <span style={{ color:INK_M }}>Impressions</span>   <span style={{ color:INK, textAlign:'right', fontWeight:500 }}>{fmtNum(w.impressions)}</span>
                      <span style={{ color:INK_M }}>Direction reqs</span> <span style={{ color:INK, textAlign:'right', fontWeight:500 }}>{fmtNum(w.directions)}</span>
                      <span style={{ color:INK_M }}>Phone taps</span>    <span style={{ color:INK, textAlign:'right', fontWeight:500 }}>{fmtNum(w.phone)}</span>
                      <span style={{ color:INK_M }}>Website clicks</span> <span style={{ color:INK, textAlign:'right', fontWeight:500 }}>{fmtNum(w.website)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Source cards — sorted Google · TA · Booking · Expedia · Trip.com */}
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'4px 2px 8px' }}>Review sources</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:6 }}>
            {listings.map(li => {
              const key = li.channel;
              const label = SOURCE_LABEL[key] ?? key;
              const isGoogle = key === 'google';
              // PBS 2026-07-06: fall back to a Google-search link for the hotel when no explicit listing URL exists.
              const linkUrl = li.url || (isGoogle ? 'https://www.google.com/search?q=the+namkhan' : null);
              const hasUrl = !!linkUrl;
              const summary = summaryMap[key];
              const platformReviews = summary?.total_reviews_on_platform ?? null;
              const platformRating = summary?.score_overall != null ? Number(summary.score_overall) : null;
              const rankPos = summary?.ranking_position ?? null;
              const rankTot = summary?.ranking_total ?? null;
              const rankCtx = summary?.ranking_context ?? null;
              const stateLive = platformRating != null;
              const stateGoogleNC = isGoogle && !oauth?.location_id && !stateLive;
              return (
                <div key={key} style={{ padding:'10px 12px', borderRadius:6, background:WHITE, border:'1px solid '+HAIR, display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6 }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontWeight:600, fontSize:12, color:INK }}>
                      <SourceBadge source={key} />{label}
                      {hasUrl && (
                        <a href={linkUrl!} target="_blank" rel="noopener noreferrer" title={'Open ' + label + ' listing'}
                          style={{ fontSize:13, color:INK_M, textDecoration:'none' }}>↗</a>
                      )}
                    </span>
                    <span style={{
                      fontSize:9, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
                      padding:'2px 6px', borderRadius:10,
                      background: stateLive ? '#E4F1E0' : '#F5F0E1',
                      color:    stateLive ? '#1F5C2C' : INK_M,
                      border:'1px solid ' + (stateLive ? '#A9CFA0' : HAIR),
                    }}>{stateLive ? 'LIVE' : (stateGoogleNC ? 'NOT CONNECTED' : 'NO DATA')}</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <div style={{ background:'#FAFAF7', border:'1px solid '+HAIR, borderRadius:4, padding:'6px 8px' }}>
                      <div style={{ fontSize:9, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600 }}>Rating /5</div>
                      <div style={{ fontSize:20, fontWeight:600, color:INK, marginTop:2 }}>{platformRating != null ? platformRating.toFixed(1) : '—'}</div>
                    </div>
                    <div style={{ background:'#FAFAF7', border:'1px solid '+HAIR, borderRadius:4, padding:'6px 8px' }}>
                      <div style={{ fontSize:9, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600 }}>Reviews</div>
                      <div style={{ fontSize:20, fontWeight:600, color:INK, marginTop:2 }}>{platformReviews != null ? platformReviews : '—'}</div>
                    </div>
                  </div>
                  {(rankPos && rankTot) && (
                    <div style={{ fontSize:11, color:INK_S, background:'#E4F1E0', border:'1px solid #A9CFA0', borderRadius:4, padding:'5px 8px', fontWeight:500 }}>
                      Ranked <strong>#{rankPos}</strong> of {rankTot}
                    </div>
                  )}
                  {!rankPos && rankCtx && (
                    <div style={{ fontSize:10, color:INK_M, fontStyle:'italic', lineHeight:1.3 }}>{rankCtx}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {sourceRows.length > 0 && (
          <div style={{ gridColumn:'1 / -1' }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'8px 2px 8px' }}>Local sample · by source (all platforms always shown)</div>
            <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ padding:'8px 12px', textAlign:'left',  fontWeight:600, borderBottom:'1px solid '+HAIR, color:INK_S }}>Source</th>
                    <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, borderBottom:'1px solid '+HAIR, color:INK_S }}>Sample reviews</th>
                    <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, borderBottom:'1px solid '+HAIR, color:INK_S }}>Avg /5</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map(sr => (
                    <tr key={sr.source} style={{ borderBottom:'1px solid #F5F0E1' }}>
                      <td style={{ padding:'8px 12px', color:INK, fontWeight:500 }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                          <SourceBadge source={sr.source} /> {SOURCE_LABEL[sr.source] ?? sr.source}
                        </span>
                      </td>
                      <td style={{ padding:'8px 12px', textAlign:'right' }}>{sr.count}</td>
                      <td style={{ padding:'8px 12px', textAlign:'right' }}>{sr.avg != null ? sr.avg.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PBS 2026-07-06: sentiment + management-report containers side-by-side, expandable,
            under source table + above reviews list. Both feed from live reviews array so any
            new scrape auto-refreshes them. */}
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:12 }}>
          <SentimentContainer reviews={reviews} />
          <ReportContainer reviews={reviews} />
        </div>

        <div style={{ gridColumn:'1 / -1' }}>
          <ReputationReviewsTabs reviews={reviews} />
        </div>
      </DashboardPage>
    </div>
  );
}