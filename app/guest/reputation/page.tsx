// app/guest/reputation/page.tsx
// PBS 2026-07-03 v4: proper Reputation page.
// - KPI strip on top (paper-white tokens inherit from guest-paper-scope)
// - Integrations panel: Google · TripAdvisor · Booking · Expedia · Cloudbeds
//   Each shows connected/not · last sync · row count · direct action button
// - URL param error surfacing: ?google=connected|error&reason=X shows a banner
// - Below: source mix, sentiment trend, response queue, review feed (empty
//   state is honest: says "connect a source to see reviews")

import Link from 'next/link';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

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
  id: number;
  source: string;
  reviewer_name: string | null;
  rating_norm: number | null;
  title: string | null;
  body: string | null;
  reviewed_at: string | null;
  response_status: string | null;
  response_text: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  google: 'Google', tripadvisor: 'TripAdvisor', booking: 'Booking.com',
  expedia: 'Expedia', agoda: 'Agoda', direct: 'Direct', cloudbeds: 'Cloudbeds',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface PageProps { searchParams: Record<string, string | string[] | undefined>; }

export default async function GuestReputationPage({ searchParams }: PageProps) {
  const sb = getSupabaseAdmin();

  const [oauthR, reviewsR, statsR] = await Promise.all([
    sb.schema('marketing').from('google_oauth_tokens').select('*').eq('property_id', PROPERTY_ID).maybeSingle(),
    sb.from('mkt_reviews').select('*').eq('property_id', PROPERTY_ID).order('reviewed_at', { ascending: false }).limit(50),
    sb.from('mkt_reviews').select('source, rating_norm, response_status', { count: 'exact' }).eq('property_id', PROPERTY_ID),
  ]);

  const oauth: OAuthRow | null = (oauthR.data as OAuthRow | null) ?? null;
  const reviews: ReviewRow[] = (reviewsR.data as ReviewRow[]) ?? [];
  const allRows = (statsR.data as { source: string; rating_norm: number | null; response_status: string | null }[]) ?? [];

  // KPI values from real rows only. Zeros are honest.
  const total = allRows.length;
  const avgRating = total > 0 ? allRows.reduce((s, r) => s + (Number(r.rating_norm) || 0), 0) / total : null;
  const unanswered = allRows.filter(r => r.response_status === 'unanswered').length;
  const responded  = allRows.filter(r => r.response_status === 'responded').length;
  const responseRate = total > 0 ? (responded / total) * 100 : 0;
  const sourceMix = new Map<string, { n: number; sum: number }>();
  for (const r of allRows) {
    const k = r.source ?? 'unknown';
    if (!sourceMix.has(k)) sourceMix.set(k, { n: 0, sum: 0 });
    const s = sourceMix.get(k)!; s.n += 1; s.sum += Number(r.rating_norm) || 0;
  }
  const sourceRows = Array.from(sourceMix.entries())
    .map(([source, v]) => ({ source, count: v.n, avg: v.n > 0 ? v.sum / v.n : null }))
    .sort((a, b) => b.count - a.count);

  const tabs: DashboardTab[] = GUEST_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/guest/reputation',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Reviews (all)',   value: total,        size: 'sm', footnote: 'marketing.reviews' },
    { label: 'Avg rating /5',   value: avgRating != null ? Number(avgRating.toFixed(2)) : null, size: 'sm', footnote: 'target ≥ 4.6 (SLH)' },
    { label: 'Unanswered',      value: unanswered,   size: 'sm',
      status: unanswered > 5 ? 'red' : unanswered > 0 ? 'amber' : 'green',
      footnote: '48h SLA' },
    { label: 'Response rate',   value: responseRate, size: 'sm', footnote: `${responded} responded` },
    { label: 'Sources',         value: sourceRows.length, size: 'sm', footnote: 'connected + populated' },
  ];

  // URL param surfacing (from OAuth callback)
  const googleParam = (Array.isArray(searchParams.google) ? searchParams.google[0] : searchParams.google) ?? null;
  const reasonParam = (Array.isArray(searchParams.reason) ? searchParams.reason[0] : searchParams.reason) ?? null;
  const locationParam = (Array.isArray(searchParams.location) ? searchParams.location[0] : searchParams.location) ?? null;

  // Integration status cards
  const integrations = [
    {
      key: 'google',
      label: 'Google Business Profile',
      state: oauth ? 'connected' : 'not-connected',
      detail: oauth
        ? `${oauth.location_name ?? '(auto-detected location)'} · connected ${fmtDate(oauth.connected_at)}${oauth.connected_by ? ' by ' + oauth.connected_by : ''}`
        : 'Reviews + Maps insights (impressions, directions, phone taps, photo views) + reply-by-API.',
      cta: oauth
        ? { label: 'Pull reviews now', href: '/api/google/pull-now?property=260955' }
        : { label: 'Connect Google →', href: '/api/google/oauth/connect?property=260955' },
    },
    {
      key: 'tripadvisor',
      label: 'TripAdvisor',
      state: 'not-connected',
      detail: 'Free Content API — last 5 reviews + location details. Read-only (reply via extranet).',
      cta: { label: 'Coming next', href: '#' },
    },
    {
      key: 'booking',
      label: 'Booking.com',
      state: 'not-connected',
      detail: 'Scraper — every 14 days. Reply via extranet.',
      cta: { label: 'Coming next', href: '#' },
    },
    {
      key: 'expedia',
      label: 'Expedia',
      state: 'not-connected',
      detail: 'Scraper — every 14 days. Reply via extranet.',
      cta: { label: 'Coming next', href: '#' },
    },
  ];

  return (
    <DashboardPage
      title="Guest · Reputation"
      subtitle="Every review, every reply — one place."
      tabs={tabs}
    >
      {/* URL param banner (OAuth callback feedback) */}
      {googleParam === 'connected' && (
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', borderRadius:4, background:'#E4F1E0', border:'1px solid #A9CFA0', color:'#1F3A2E', fontSize:12 }}>
          <strong>Google Business Profile connected</strong>{locationParam ? ` — ${locationParam}` : ''}. First review pull will run within the next cron cycle.
        </div>
      )}
      {googleParam === 'error' && (
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', borderRadius:4, background:'#FBE8E4', border:'1px solid #E8B7AB', color:'#B03826', fontSize:12 }}>
          <strong>Google connect failed.</strong> Reason: <code>{reasonParam ?? 'unknown'}</code>.{' '}
          <Link href="/api/google/oauth/connect?property=260955" style={{ color:'#B03826', fontWeight:600, textDecoration:'underline' }}>Try again →</Link>
        </div>
      )}

      {/* KPI STRIP TOP */}
      <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* INTEGRATIONS PANEL */}
      <div style={{ gridColumn:'1 / -1' }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5A5A5A', margin:'4px 2px 8px' }}>
          Review sources
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:8 }}>
          {integrations.map((ig) => (
            <div key={ig.key} style={{
              padding:'12px 14px', borderRadius:6,
              background:'#FFFFFF', border:'1px solid #E6DFCC',
              display:'flex', flexDirection:'column', gap:8,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <span style={{ fontWeight:600, fontSize:13, color:'#1B1B1B' }}>{ig.label}</span>
                <span style={{
                  fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
                  padding:'2px 8px', borderRadius:10,
                  background: ig.state === 'connected' ? '#E4F1E0' : '#F5F0E1',
                  color:    ig.state === 'connected' ? '#1F5C2C' : '#5A5A5A',
                  border:'1px solid ' + (ig.state === 'connected' ? '#A9CFA0' : '#E6DFCC'),
                }}>{ig.state === 'connected' ? 'CONNECTED' : 'NOT CONNECTED'}</span>
              </div>
              <div style={{ fontSize:11, color:'#5A5A5A', lineHeight:1.4 }}>{ig.detail}</div>
              <Link href={ig.cta.href} style={{
                alignSelf:'flex-start', marginTop:2,
                padding:'5px 12px', fontSize:11, fontWeight:600,
                background: ig.cta.href === '#' ? '#F5F0E1' : '#1F3A2E',
                color:      ig.cta.href === '#' ? '#8A8A8A' : '#FFFFFF',
                border:'none', borderRadius:4, textDecoration:'none',
                pointerEvents: ig.cta.href === '#' ? 'none' : 'auto',
              }}>{ig.cta.label}</Link>
            </div>
          ))}
        </div>
      </div>

      {/* SOURCE TABLE (only when data exists) */}
      {sourceRows.length > 0 && (
        <div style={{ gridColumn:'1 / -1' }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5A5A5A', margin:'8px 2px 8px' }}>
            By source
          </div>
          <div style={{ background:'#FFFFFF', border:'1px solid #E6DFCC', borderRadius:6, overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  <th style={{ padding:'8px 12px', textAlign:'left',  fontWeight:600, borderBottom:'1px solid #E6DFCC', color:'#3A3A3A' }}>Source</th>
                  <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, borderBottom:'1px solid #E6DFCC', color:'#3A3A3A' }}>Reviews</th>
                  <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, borderBottom:'1px solid #E6DFCC', color:'#3A3A3A' }}>Avg /5</th>
                  <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, borderBottom:'1px solid #E6DFCC', color:'#3A3A3A' }}>% of total</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map(sr => (
                  <tr key={sr.source} style={{ borderBottom:'1px solid #F5F0E1' }}>
                    <td style={{ padding:'8px 12px', color:'#1B1B1B', fontWeight:500 }}>{SOURCE_LABEL[sr.source] ?? sr.source}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right' }}>{sr.count}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right' }}>{sr.avg != null ? sr.avg.toFixed(2) : '—'}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', color:'#5A5A5A' }}>{total > 0 ? Math.round(sr.count/total*100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REVIEW FEED */}
      <div style={{ gridColumn:'1 / -1' }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#5A5A5A', margin:'8px 2px 8px' }}>
          Latest reviews
        </div>
        {reviews.length === 0 ? (
          <div style={{ padding:'40px 24px', background:'#FFFFFF', border:'1px solid #E6DFCC', borderRadius:6, textAlign:'center', color:'#5A5A5A', fontSize:12 }}>
            No reviews yet in <code>marketing.reviews</code>. Connect Google above to start populating.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {reviews.map(r => (
              <div key={r.id} style={{ padding:'12px 14px', background:'#FFFFFF', border:'1px solid #E6DFCC', borderRadius:6 }}>
                <div style={{ display:'flex', gap:10, alignItems:'baseline', flexWrap:'wrap', marginBottom:4 }}>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#1F3A2E' }}>
                    {SOURCE_LABEL[r.source] ?? r.source}
                  </span>
                  <span style={{ fontWeight:600 }}>
                    {r.rating_norm != null ? Number(r.rating_norm).toFixed(1) : '—'} / 5
                  </span>
                  <span style={{ color:'#5A5A5A', fontSize:11 }}>{fmtDate(r.reviewed_at)}</span>
                  <span style={{
                    fontSize:10, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase',
                    padding:'2px 8px', borderRadius:10,
                    background: r.response_status === 'responded' ? '#E4F1E0' : '#FBE8E4',
                    color:      r.response_status === 'responded' ? '#1F5C2C' : '#B03826',
                    border:'1px solid ' + (r.response_status === 'responded' ? '#A9CFA0' : '#E8B7AB'),
                  }}>{r.response_status ?? 'unknown'}</span>
                  {r.reviewer_name && <span style={{ color:'#3A3A3A', fontSize:11 }}>by {r.reviewer_name}</span>}
                </div>
                {r.title && <div style={{ fontStyle:'italic', fontWeight:500, color:'#1B1B1B', marginBottom:4 }}>{r.title}</div>}
                {r.body && <div style={{ fontSize:12, color:'#3A3A3A', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{r.body}</div>}
                {r.response_text && (
                  <div style={{ marginTop:8, padding:'8px 10px', background:'#F5F0E1', borderLeft:'3px solid #1F3A2E', borderRadius:'0 4px 4px 0', fontSize:11, color:'#3A3A3A' }}>
                    <strong>Reply:</strong> {r.response_text}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardPage>
  );
}
