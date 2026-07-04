// app/guest/reputation/page.tsx
// PBS 2026-07-03 v6: clean rewrite. Pure-white · KPI strip · Google dashboard
// (when connected) · data-driven integrations from v_external_listings · source
// table · review feed. SourceBadge on every source-related card/row.

import Link from 'next/link';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import SourceBadge from '@/components/marketing/SourceBadge';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface OAuthRow {
  property_id: number;
  google_account_id: string | null;
  location_id: string | null;
  location_name: string | null;
  connected_by: string | null;
  connected_at: string | null;
  scope: string | null;
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
interface ScrapeStatusRow { source: string; last_scraped_at: string | null; next_due_at: string | null; is_active: boolean; }

const SOURCE_LABEL: Record<string,string> = {
  google:'Google', tripadvisor:'TripAdvisor', booking:'Booking.com', expedia:'Expedia',
  agoda:'Agoda', direct:'Direct', cloudbeds:'Cloudbeds', ctrip:'Trip.com',
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

interface PageProps { searchParams: Record<string, string | string[] | undefined>; }

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#3A3A3A';
const INK_M = '#5A5A5A';
const GREEN = '#1F3A2E';
const RED   = '#B03826';

export default async function GuestReputationPage({ searchParams }: PageProps) {
  const sb = getSupabaseAdmin();

  const [oauthR, reviewsR, mapsR, listingsR, scrapeR, summaryR] = await Promise.all([
    sb.schema('marketing').from('google_oauth_tokens').select('*').eq('property_id', PROPERTY_ID).maybeSingle(),
    sb.from('mkt_reviews').select('*').eq('property_id', PROPERTY_ID).order('reviewed_at', { ascending: false }).limit(50),
    sb.schema('kpi').from('google_maps_daily').select('date, impressions_search, impressions_maps, direction_requests, phone_taps, website_clicks').eq('property_id', PROPERTY_ID).order('date', { ascending: false }).limit(400),
    sb.from('v_external_listings').select('*').eq('property_id', PROPERTY_ID).eq('category','reputation').order('channel'),
    sb.schema('marketing').from('review_scrape_targets').select('source, last_scraped_at, next_due_at, is_active').eq('property_id', PROPERTY_ID),
    sb.from('v_review_source_summary').select('*').eq('property_id', PROPERTY_ID),
  ]);

  const oauth: OAuthRow | null = (oauthR.data as OAuthRow | null) ?? null;
  const reviews: ReviewRow[] = (reviewsR.data as ReviewRow[]) ?? [];
  const mapsRows: MapsRow[] = (mapsR.data as MapsRow[]) ?? [];
  const listings: ListingRow[] = (listingsR.data as ListingRow[]) ?? [];
  const scrapeArr: ScrapeStatusRow[] = (scrapeR.data as ScrapeStatusRow[]) ?? [];
  const scrapeStatus: Record<string, ScrapeStatusRow> = Object.fromEntries(scrapeArr.map(s => [s.source, s]));
  const summaryArr: any[] = (summaryR.data as any[]) ?? [];
  const summaryMap: Record<string, any> = Object.fromEntries(summaryArr.map(s => [s.source, s]));

  const googleReviews = reviews.filter(r => r.source === 'google');
  const googleAvg = googleReviews.length > 0
    ? googleReviews.reduce((s,r) => s + (Number(r.rating_norm) || 0), 0) / googleReviews.length : null;

  const total = reviews.length;
  const avgRating = total > 0 ? reviews.reduce((s,r) => s + (Number(r.rating_norm) || 0), 0) / total : null;
  const unanswered = reviews.filter(r => r.response_status === 'unanswered').length;
  const responded  = reviews.filter(r => r.response_status === 'responded').length;
  const responseRate = total > 0 ? (responded / total) * 100 : 0;

  const sourceMix = new Map<string, { n: number; sum: number }>();
  for (const r of reviews) {
    const k = r.source ?? 'unknown';
    if (!sourceMix.has(k)) sourceMix.set(k, { n: 0, sum: 0 });
    const s = sourceMix.get(k)!; s.n += 1; s.sum += Number(r.rating_norm) || 0;
  }
  const sourceRows = Array.from(sourceMix.entries())
    .map(([source, v]) => ({ source, count: v.n, avg: v.n > 0 ? v.sum / v.n : null }))
    .sort((a, b) => b.count - a.count);

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/reputation',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Reviews (all)', value: total, size: 'sm' },
    { label: 'Avg rating /5', value: avgRating != null ? Number(avgRating.toFixed(2)) : null, size: 'sm', footnote: 'target ≥ 4.6' },
    { label: 'Unanswered',    value: unanswered, size: 'sm', status: unanswered > 5 ? 'red' : unanswered > 0 ? 'amber' : 'green' },
    { label: 'Response rate', value: responseRate, size: 'sm' },
    { label: 'Sources',       value: sourceRows.length, size: 'sm', footnote: 'populated' },
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
      <DashboardPage
        title="Guest · Reputation"
        subtitle="Every review, every reply — one place."
        tabs={tabs}
      >
        {googleParam === 'connected' && (
          <div style={{ gridColumn:'1 / -1', padding:'10px 14px', borderRadius:4, background:'#E4F1E0', border:'1px solid #A9CFA0', color:GREEN, fontSize:12 }}>
            <strong>Google Business Profile connected</strong>{locationParam ? ' — ' + locationParam : ''}. First review + Maps pull will run automatically within a minute.
          </div>
        )}
        {googleParam === 'error' && (
          <div style={{ gridColumn:'1 / -1', padding:'10px 14px', borderRadius:4, background:'#FBE8E4', border:'1px solid #E8B7AB', color:RED, fontSize:12 }}>
            <strong>Google connect failed</strong>{stepParam ? ' at ' + stepParam : ''}. Reason: <code>{reasonParam ?? 'unknown'}</code>.{' '}
            <Link href="/api/google/oauth/connect?property=260955" style={{ color:RED, fontWeight:600, textDecoration:'underline' }}>Try again →</Link>
          </div>
        )}

        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {oauth && (
          <div style={{ gridColumn:'1 / -1', background:WHITE, border:'1px solid '+HAIR, borderRadius:6, padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <SourceBadge source="google" size="md" />
                  <span style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M }}>Google Business Profile</span>
                </div>
                <div style={{ fontSize:16, fontWeight:600, color:INK }}>{oauth.location_name ?? 'Location auto-detection pending — click Pull to fetch'}</div>
                <div style={{ fontSize:11, color:INK_M, marginTop:2 }}>
                  Connected {fmtDate(oauth.connected_at)}
                  {oauth.google_account_id ? ' · account ' + oauth.google_account_id.split('/').pop() : ''}
                </div>
              </div>
              <Link href="/api/google/oauth/connect?property=260955" style={{ padding:'5px 12px', fontSize:11, fontWeight:600, background:'#F5F0E1', color:INK_S, border:'1px solid '+HAIR, borderRadius:4, textDecoration:'none' }}>Reconnect</Link>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8, marginBottom:12 }}>
              <div style={{ padding:'10px 12px', border:'1px solid '+HAIR, borderRadius:4 }}>
                <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600 }}>Avg rating</div>
                <div style={{ fontSize:20, fontWeight:600, color:INK, marginTop:2 }}>{googleAvg != null ? googleAvg.toFixed(2) : '—'} <span style={{ fontSize:11, color:INK_M, fontWeight:400 }}>/5</span></div>
              </div>
              <div style={{ padding:'10px 12px', border:'1px solid '+HAIR, borderRadius:4 }}>
                <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600 }}>Reviews (Google)</div>
                <div style={{ fontSize:20, fontWeight:600, color:INK, marginTop:2 }}>{googleReviews.length}</div>
              </div>
              <div style={{ padding:'10px 12px', border:'1px solid '+HAIR, borderRadius:4 }}>
                <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600 }}>Days of insights</div>
                <div style={{ fontSize:20, fontWeight:600, color:INK, marginTop:2 }}>{mapsRows.length}</div>
              </div>
            </div>

            <div style={{ fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600, marginBottom:6 }}>Maps insights</div>
            {mapsRows.length === 0 ? (
              <div style={{ padding:'20px 12px', background:'#FAFAF7', border:'1px dashed '+HAIR, borderRadius:4, textAlign:'center', color:INK_M, fontSize:11 }}>
                No Maps insights yet. First pull happens within the minute after connect.
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

        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'4px 2px 8px' }}>Review sources</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:8 }}>
            {listings.map(li => {
              const key = li.channel;
              const label = SOURCE_LABEL[key] ?? key;
              const isGoogle = key === 'google';
              const hasUrl = !!li.url;
              const summary = summaryMap[key];
              const platformReviews = summary?.total_reviews_on_platform ?? null;
              const platformRating = summary?.score_overall ? Number(summary.score_overall) : null;
              const rankPos = summary?.ranking_position ?? null;
              const rankTot = summary?.ranking_total ?? null;
              const rankCtx = summary?.ranking_context ?? null;
              const stateConnected = platformRating != null;
              const scrapedEmpty = false;
              const lastSync = scrape?.last_scraped_at;
              const nextDue = scrape?.next_due_at;
              return (
                <div key={key} style={{ padding:'12px 14px', borderRadius:6, background:WHITE, border:'1px solid '+HAIR, display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:8, fontWeight:600, fontSize:13, color:INK }}>
                      <SourceBadge source={key} />{label}
                      {hasUrl && (
                        <a href={li.url!} target="_blank" rel="noopener noreferrer" title={"Open " + label + " listing"}
                          style={{ fontSize:14, color:INK_M, textDecoration:'none', marginLeft:2 }}>↗</a>
                      )}
                    </span>
                    <span style={{
                      fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
                      padding:'2px 8px', borderRadius:10,
                      background: stateConnected ? '#E4F1E0' : (scrapedEmpty ? '#FBEBB4' : '#F5F0E1'),
                      color:    stateConnected ? '#1F5C2C' : (scrapedEmpty ? '#8B5A1C' : INK_M),
                      border:'1px solid ' + (stateConnected ? '#A9CFA0' : (scrapedEmpty ? '#E8C89B' : HAIR)),
                    }}>{stateConnected ? 'LIVE' : (scrapedEmpty ? 'NO DATA YET' : 'NOT CONNECTED')}</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <div style={{ background:'#FAFAF7', border:'1px solid '+HAIR, borderRadius:4, padding:'6px 10px' }}>
                      <div style={{ fontSize:9, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600 }}>Rating /5</div>
                      <div style={{ fontSize:20, fontWeight:600, color:INK, marginTop:2 }}>{platformRating != null ? platformRating.toFixed(1) : '—'}</div>
                    </div>
                    <div style={{ background:'#FAFAF7', border:'1px solid '+HAIR, borderRadius:4, padding:'6px 10px' }}>
                      <div style={{ fontSize:9, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, fontWeight:600 }}>Reviews on platform</div>
                      <div style={{ fontSize:20, fontWeight:600, color:INK, marginTop:2 }}>{platformReviews != null ? platformReviews : '—'}</div>
                    </div>
                  </div>
                  {(rankPos && rankTot) && (
                    <div style={{ fontSize:11, color:INK_S, background:'#E4F1E0', border:'1px solid #A9CFA0', borderRadius:4, padding:'6px 10px', fontWeight:500 }}>
                      Ranked <strong>#{rankPos}</strong> of {rankTot} · {rankCtx ?? ''}
                    </div>
                  )}
                  {!rankPos && rankCtx && (
                    <div style={{ fontSize:10, color:INK_M, fontStyle:'italic' }}>{rankCtx}</div>
                  )}
                  {isGoogle && (
                    <Link href={oauth ? '/api/google/pull-now?property=260955' : '/api/google/oauth/connect?property=260955'}
                      style={{ alignSelf:'flex-start', padding:'5px 12px', fontSize:11, fontWeight:600, background:GREEN, color:WHITE, border:'none', borderRadius:4, textDecoration:'none' }}>
                      {oauth ? 'Pull latest' : 'Connect Google →'}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {sourceRows.length > 0 && (
          <div style={{ gridColumn:'1 / -1' }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'8px 2px 8px' }}>By source</div>
            <div style={{ background:WHITE, border:'1px solid '+HAIR, borderRadius:6, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ padding:'8px 12px', textAlign:'left',  fontWeight:600, borderBottom:'1px solid '+HAIR, color:INK_S }}>Source</th>
                    <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, borderBottom:'1px solid '+HAIR, color:INK_S }}>Reviews</th>
                    <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, borderBottom:'1px solid '+HAIR, color:INK_S }}>Avg /5</th>
                    <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, borderBottom:'1px solid '+HAIR, color:INK_S }}>% of total</th>
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
                      <td style={{ padding:'8px 12px', textAlign:'right', color:INK_M }}>{total > 0 ? Math.round(sr.count/total*100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, margin:'8px 2px 8px' }}>Latest reviews</div>
          {reviews.length === 0 ? (
            <div style={{ padding:'40px 24px', background:WHITE, border:'1px solid '+HAIR, borderRadius:6, textAlign:'center', color:INK_M, fontSize:12 }}>
              No reviews yet in <code>marketing.reviews</code>. Connect a source above → first pull runs within a minute.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {reviews.map(r => (
                <div key={r.id} style={{ padding:'12px 14px', background:WHITE, border:'1px solid '+HAIR, borderRadius:6 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'baseline', flexWrap:'wrap', marginBottom:4 }}>
                    <SourceBadge source={r.source} />
                    <span style={{ fontWeight:600 }}>
                      {r.rating_norm != null ? Number(r.rating_norm).toFixed(1) : '—'} / 5
                    </span>
                    <span style={{ color:INK_M, fontSize:11 }}>{fmtDate(r.reviewed_at)}</span>
                    <span style={{
                      fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
                      padding:'2px 8px', borderRadius:10,
                      background: r.response_status === 'responded' ? '#E4F1E0' : '#FBE8E4',
                      color:      r.response_status === 'responded' ? '#1F5C2C' : RED,
                      border:'1px solid ' + (r.response_status === 'responded' ? '#A9CFA0' : '#E8B7AB'),
                    }}>{r.response_status ?? 'unknown'}</span>
                    {r.reviewer_name && <span style={{ color:INK_S, fontSize:11 }}>by {r.reviewer_name}</span>}
                  </div>
                  {r.title && <div style={{ fontStyle:'italic', fontWeight:500, color:INK, marginBottom:4 }}>{r.title}</div>}
                  {r.body && <div style={{ fontSize:12, color:INK_S, lineHeight:1.5, whiteSpace:'pre-wrap' }}>{r.body}</div>}
                  {r.response_text && (
                    <div style={{ marginTop:8, padding:'8px 10px', background:'#F5F0E1', borderLeft:'3px solid '+GREEN, borderRadius:'0 4px 4px 0', fontSize:11, color:INK_S }}>
                      <strong>Reply:</strong> {r.response_text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardPage>
    </div>
  );
}
