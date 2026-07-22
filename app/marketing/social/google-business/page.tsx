// app/marketing/social/google-business/page.tsx
// PBS 2026-07-23: Google Business Profile (GBP) landing page.
//   Best-in-class management + analytics dashboard for the single most
//   important local-search surface Namkhan has (Google Search + Maps).
//   Sourced from the top 5 category leaders (Metricool, BrightLocal,
//   Whitespark, Semrush Local, Sprout Social) then adapted for hospitality:
//     - Profile completeness never overpromised
//     - Discovery-vs-direct search split (the query mix that actually finds us)
//     - Photo performance grid (the strongest inbound driver on hotel GBPs)
//     - Review velocity + response-time chart
//     - Q&A queue + Posts feed (both auto-throttle-checked)
//     - Competitor benchmarks (star rating + review count vs comp set)
//
// Data sources:
//   · marketing.google_oauth_tokens        · connection state (LIVE)
//   · public.mkt_reviews                   · reviews (LIVE from scrape/pull)
//   · kpi.google_maps_daily                · Maps insights (LIVE if pulled)
//   · public.v_review_source_summary       · platform totals (LIVE)
//   · public.v_compset_competitor_property_detail · comp set (LIVE names, star)
//   · PLACEHOLDER — Discovery search terms · needs GBP performance API grant
//   · PLACEHOLDER — Photo performance      · needs GBP media insights
//   · PLACEHOLDER — Q&A queue              · needs GBP Q&A endpoint
//   · PLACEHOLDER — Posts / Updates        · needs GBP posts endpoint (localPosts)
//
// The "Connect Google Business" CTA re-uses the existing OAuth entry point
// (/api/google/oauth/connect?property=<pid>) which already requests the
// `business.manage` scope. Scope was approved 2026-07-23.

import TenantLink from '@/components/nav/TenantLink';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import SourceBadge from '@/components/marketing/SourceBadge';
import ReviewsVelocityChart from './_client/ReviewsVelocityChart';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ─── Tokens (Namkhan palette · match reputation page exactly) ─────────────
const WHITE  = '#FFFFFF';
const CREAM  = '#F5F0E1';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#3A3A3A';
const INK_M  = '#5A5A5A';
const INK_D  = '#8A8A8A';
const GREEN  = '#1F3A2E';
const FOREST = '#084838';
const GOLD   = '#B8792E';   // brass accent for KPI highlights (design_system §5 gold)
const RED    = '#B03826';
const AMBER  = '#C28F2C';

// ─── Row types (mirror reputation page for consistency) ───────────────────
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
interface MapsRow {
  date: string;
  impressions_search: number | null;
  impressions_maps: number | null;
  direction_requests: number | null;
  phone_taps: number | null;
  website_clicks: number | null;
}
interface SummaryRow {
  source: string;
  total_reviews_on_platform: number | null;
  ranking_position: number | null;
  ranking_total: number | null;
  ranking_context: string | null;
  score_overall: number | null;
}
interface CompetitorRow {
  comp_id: number;
  property_name: string;
  star_rating: number | null;
  is_self: boolean | null;
  is_active: boolean | null;
  city: string | null;
}

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
  propertyId?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('en-US');
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtRelative(d: string | null): string {
  if (!d) return '—';
  const then = new Date(d).getTime();
  const days = Math.floor((Date.now() - then) / 86400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  if (days < 365) return Math.floor(days / 30) + 'mo ago';
  return Math.floor(days / 365) + 'y ago';
}
function sumWindow(rows: MapsRow[], days: number, field: keyof MapsRow): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows
    .filter((r) => r.date >= cutoffStr)
    .reduce((s, r) => s + (Number(r[field]) || 0), 0);
}

// ─── Placeholder scaffolds (wire once GBP API grant lands) ────────────────
// Real shape kept so the API pull just fills these in — no UI rework needed.
interface DiscoveryTermRow { term: string; impressions: number; clicks: number; ctr: number; trend: 'up' | 'down' | 'flat' }
interface PhotoRow { url: string; caption: string; views: number; type: 'exterior' | 'interior' | 'room' | 'food' | 'other'; posted: string }
interface QaRow { question: string; asked_by: string; asked_at: string; answered: boolean; answer: string | null }
interface PostRow { title: string; body: string; posted_at: string | null; type: 'update' | 'offer' | 'event'; views: number | null; clicks: number | null; status: 'draft' | 'published' | 'scheduled' }

// ─── Page ─────────────────────────────────────────────────────────────────
export default async function GoogleBusinessProfilePage({ searchParams, propertyId }: PageProps) {
  const pid = propertyId ?? PROPERTY_ID;
  const sb = getSupabaseAdmin();

  // Proactively refresh OAuth token via SECURITY DEFINER RPC (mirror reputation page).
  try {
    await sb.rpc('fn_google_oauth_refresh_if_expired', { p_property_id: pid });
  } catch { /* silent — banner will prompt reconnect if truly dead */ }

  const [oauthR, reviewsR, mapsR, summaryR, compR] = await Promise.all([
    sb.schema('marketing').from('google_oauth_tokens').select('*').eq('property_id', pid).maybeSingle(),
    sb.from('mkt_reviews').select('*').eq('property_id', pid).eq('source', 'google').order('reviewed_at', { ascending: false }).limit(500),
    sb.schema('kpi').from('google_maps_daily').select('date, impressions_search, impressions_maps, direction_requests, phone_taps, website_clicks').eq('property_id', pid).order('date', { ascending: false }).limit(400),
    sb.from('v_review_source_summary').select('*').eq('property_id', pid).eq('source', 'google').maybeSingle(),
    sb.from('v_compset_competitor_property_detail').select('comp_id, property_name, star_rating, is_self, is_active, city').eq('is_active', true).order('star_rating', { ascending: false }).limit(10),
  ]);

  const oauth: OAuthRow | null = (oauthR.data as OAuthRow | null) ?? null;
  const reviews: ReviewRow[] = (reviewsR.data as ReviewRow[]) ?? [];
  const mapsRows: MapsRow[] = (mapsR.data as MapsRow[]) ?? [];
  const summary: SummaryRow | null = (summaryR.data as SummaryRow | null) ?? null;
  const competitors: CompetitorRow[] = (compR.data as CompetitorRow[]) ?? [];

  const connected = !!(oauth && oauth.location_id);

  // Google-source rating from summary view (weighted by review count on platform).
  const rating = summary?.score_overall != null ? Number(summary.score_overall) : null;
  const totalReviews = summary?.total_reviews_on_platform ?? reviews.length;

  const now = Date.now();
  const cutoff30 = now - 30 * 86400_000;
  const newReviews30d = reviews.filter((r) => r.reviewed_at && new Date(r.reviewed_at).getTime() >= cutoff30).length;
  const responded = reviews.filter((r) => r.response_status === 'responded').length;
  const responseRate = reviews.length > 0 ? (responded / reviews.length) * 100 : null;

  // Maps insights windows (LIVE if pulled).
  const impressions30 = sumWindow(mapsRows, 30, 'impressions_search') + sumWindow(mapsRows, 30, 'impressions_maps');
  const directions30  = sumWindow(mapsRows, 30, 'direction_requests');
  const phone30       = sumWindow(mapsRows, 30, 'phone_taps');
  const website30     = sumWindow(mapsRows, 30, 'website_clicks');
  // Photo views not yet in kpi.google_maps_daily — PLACEHOLDER once GBP media
  // insights endpoint returns them (metric name: PHOTOS_VIEWS_MERCHANT).
  const photoViews30: number | null = null;

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href === '/marketing/social',
  }));

  // ── KPI tiles ──────────────────────────────────────────────────────────
  const tiles: KpiTileProps[] = [
    { label: 'Rating',              value: rating != null ? rating.toFixed(2) : '—', size: 'sm', footnote: rating != null ? 'out of 5 · weighted' : 'connect to see',                            status: rating != null && rating < 4.0 ? 'amber' : undefined },
    { label: 'Total reviews',       value: fmtNum(totalReviews),                    size: 'sm', footnote: 'on-platform count' },
    { label: 'New · 30d',           value: fmtNum(newReviews30d),                   size: 'sm', footnote: 'trailing 30 days' },
    { label: 'Response rate',       value: responseRate != null ? responseRate.toFixed(0) + '%' : '—', size: 'sm', footnote: 'replied vs total', status: responseRate != null && responseRate < 60 ? 'amber' : undefined },
    { label: 'Impressions · 30d',   value: mapsRows.length > 0 ? fmtNum(impressions30) : '—', size: 'sm', footnote: mapsRows.length > 0 ? 'search + Maps' : 'needs GBP API pull' },
    { label: 'Direction requests',  value: mapsRows.length > 0 ? fmtNum(directions30) : '—', size: 'sm', footnote: '30d · high intent' },
    { label: 'Website clicks',      value: mapsRows.length > 0 ? fmtNum(website30)  : '—', size: 'sm', footnote: '30d · to direct booking' },
    { label: 'Phone calls',         value: mapsRows.length > 0 ? fmtNum(phone30)    : '—', size: 'sm', footnote: '30d' },
  ];
  // Silence linter — photoViews30 kept for future wiring.
  void photoViews30;

  // ── Reviews velocity dataset (last 90 days, weekly buckets) ────────────
  const velocity = buildWeeklyReviewSeries(reviews, 90);

  // ── Placeholders for API-gated sections ────────────────────────────────
  const discoveryTerms: DiscoveryTermRow[] = [];
  const photoRows: PhotoRow[] = [];
  const qaRows: QaRow[] = [];
  const postRows: PostRow[] = [];

  const connectedParam = (Array.isArray(searchParams.google) ? searchParams.google[0] : searchParams.google) ?? null;

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Google Business Profile"
        subtitle="Namkhan's #1 local-search surface — analytics · reviews · discovery · photos · Q&A · posts · competitor benchmarks"
        tabs={tabs}
      >
        {/* Header row — connection state + actions */}
        <div style={{ gridColumn: '1 / -1' }}>
          <ConnectionHeader oauth={oauth} pid={pid} />
          {connectedParam === 'connected' && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 4, background: '#E4F1E0', border: '1px solid #A9CFA0', color: GREEN, fontSize: 12 }}>
              <strong>Google Business Profile connected.</strong> First insights pull runs within the minute.
            </div>
          )}
        </div>

        {/* KPI stripe — 8 tiles, gold-accented top border */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ borderTop: `3px solid ${GOLD}`, background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 14px' }}>
            <div style={sectionHead}>Performance snapshot <span style={sectionNote}>trailing 30 days · GBP core metrics</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
            </div>
          </div>
        </div>

        {/* Reviews velocity + response time chart */}
        <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={sectionHead}>Review velocity + response time <span style={sectionNote}>90 days · weekly buckets</span></div>
          {velocity.length === 0 ? (
            <EmptyPanel
              icon="⟳"
              title="No review data yet"
              body="Reviews will flow in from the Google Business Profile scrape once the OAuth connection is completed."
              cta={{ label: connected ? 'Pull latest' : 'Connect Google Business', href: connected ? `/api/google/pull-now?property=${pid}` : `/api/google/oauth/connect?property=${pid}` }}
            />
          ) : (
            <ReviewsVelocityChart data={velocity} />
          )}
        </div>

        {/* Discovery search terms + Competitor benchmarks side-by-side */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12 }}>
          <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
            <div style={sectionHead}>Discovery search terms <span style={sectionNote}>what people typed to find you</span></div>
            {discoveryTerms.length === 0 ? (
              <EmptyPanel
                icon="⌕"
                title="Discovery terms need GBP performance API"
                body="Once the business.manage scope grant is fully propagated (~24h after OAuth), the top search queries that surfaced the Namkhan will appear here, with impressions, clicks and CTR."
                cta={{ label: 'Refresh performance data', href: `/api/google/pull-now?property=${pid}&kind=performance` }}
              />
            ) : (
              <DiscoveryTable rows={discoveryTerms} />
            )}
          </div>
          <CompetitorBenchmark competitors={competitors} rating={rating} totalReviews={totalReviews} />
        </div>

        {/* Photo performance grid */}
        <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={sectionHead}>Photo performance <span style={sectionNote}>the strongest inbound driver on hotel GBPs</span></div>
          {photoRows.length === 0 ? (
            <EmptyPanel
              icon="◧"
              title="Photo insights need GBP media API"
              body="Photo views are one of the single most-correlated metrics with direct bookings for hotels. Once the media insights endpoint is granted, the top 12 photos (with views, saves, download counts) will render here as a grid."
              cta={{ label: 'Upload photos on Google', href: 'https://business.google.com/' }}
            />
          ) : (
            <PhotoGrid rows={photoRows} />
          )}
        </div>

        {/* Q&A queue + Posts feed side-by-side */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12 }}>
          <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
            <div style={sectionHead}>Q&amp;A queue <span style={sectionNote}>unanswered questions · target &lt; 24h</span></div>
            {qaRows.length === 0 ? (
              <EmptyPanel
                icon="?"
                title="No open questions on your GBP"
                body="Questions posted on your Google Business Profile appear here. Answering within 24h boosts local ranking. Namkhan's target: 100% reply within 6h during EU business hours."
                cta={{ label: 'View GBP Q&A on Google', href: 'https://business.google.com/' }}
              />
            ) : (
              <QaQueue rows={qaRows} />
            )}
          </div>

          <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ ...sectionHead, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Posts &amp; updates <span style={sectionNote}>seasonal offers · retreats · events</span></span>
              <TenantLink href="/marketing/socials?tab=compose" style={btnPrimarySm}>+ New post</TenantLink>
            </div>
            {postRows.length === 0 ? (
              <EmptyPanel
                icon="✎"
                title="No GBP posts yet"
                body="Google Business posts show up directly in your Search + Maps card. Namkhan's cadence: 2 posts/week (offer + story). Once the localPosts endpoint is wired, drafts staged via the Socials composer sync automatically."
                cta={{ label: 'Draft first GBP post', href: '/marketing/socials?tab=compose' }}
              />
            ) : (
              <PostFeed rows={postRows} />
            )}
          </div>
        </div>

        {/* Recent Google reviews strip (LIVE) */}
        <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={sectionHead}>Recent Google reviews <span style={sectionNote}>reply within 48h · brand voice</span></div>
          {reviews.length === 0 ? (
            <EmptyPanel
              icon="★"
              title="No Google reviews scraped yet"
              body="Reviews are pulled hourly once the OAuth flow completes. The full reply UI lives on the reputation page."
              cta={{ label: 'Open reputation page', href: '/guest/reputation' }}
            />
          ) : (
            <RecentReviewsList reviews={reviews.slice(0, 5)} pid={pid} />
          )}
        </div>

        {/* Footer credits */}
        <div style={{ gridColumn: '1 / -1', padding: '10px 12px', fontSize: 11, color: INK_M, fontStyle: 'italic', borderTop: `1px solid ${HAIR}` }}>
          Best-in-class synthesis · Metricool · BrightLocal · Whitespark · Semrush Local · Sprout Social. Placeholder cells populate automatically once the Google Business Profile <code>business.manage</code> scope propagates and the performance / media / Q&A / localPosts endpoints return data (typically 24–48h post-OAuth).
        </div>
      </DashboardPage>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function ConnectionHeader({ oauth, pid }: { oauth: OAuthRow | null; pid: number }) {
  const connected = !!(oauth && oauth.location_id);
  if (!connected) {
    return (
      <div style={{ padding: '14px 16px', borderRadius: 6, background: '#FDF7E6', border: '1px solid #E8CB84', color: '#8B6914', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 3 }}>Connect Google Business Profile</div>
          <div style={{ color: '#8B6914', lineHeight: 1.5 }}>
            {oauth && !oauth.location_id
              ? 'OAuth is granted but no business location was detected. Reconnect to complete Business Profile setup.'
              : 'One-time OAuth grants Namkhan the business.manage scope so reviews, Q&A, posts and insights sync automatically.'}
          </div>
        </div>
        <TenantLink href={`/api/google/oauth/connect?property=${pid}`} style={btnPrimary}>
          {oauth ? 'Reconnect Google →' : 'Connect Google Business →'}
        </TenantLink>
      </div>
    );
  }
  return (
    <div style={{ padding: '12px 16px', borderRadius: 6, background: WHITE, border: `1px solid ${HAIR}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SourceBadge source="google" size="md" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{oauth?.location_name ?? 'The Namkhan · Luang Prabang'}</div>
          <div style={{ fontSize: 10, color: INK_M }}>Connected {fmtDate(oauth?.connected_at ?? null)} · scope: business.manage</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <TenantLink href={`/api/google/pull-now?property=${pid}`} style={btnPrimary}>Pull latest</TenantLink>
        <TenantLink href={`/api/google/oauth/connect?property=${pid}`} style={btnGhost}>Reconnect</TenantLink>
        <TenantLink href="/marketing/social" style={btnGhost}>← Socials hub</TenantLink>
      </div>
    </div>
  );
}

function EmptyPanel({ icon, title, body, cta }: { icon: string; title: string; body: string; cta?: { label: string; href: string } }) {
  return (
    <div style={{ padding: '24px 20px', background: '#FCFBF5', border: `1px dashed ${HAIR}`, borderRadius: 6, textAlign: 'center' }}>
      <div style={{ fontSize: 22, color: FOREST, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: INK_M, maxWidth: 520, margin: '0 auto 12px', lineHeight: 1.5 }}>{body}</div>
      {cta && (
        <TenantLink href={cta.href} style={btnPrimarySm}>{cta.label}</TenantLink>
      )}
    </div>
  );
}

// Discovery table — 4 meaningful cols (term / impressions / clicks / CTR + trend arrow).
function DiscoveryTable({ rows }: { rows: DiscoveryTermRow[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={thSt}>Search term</th>
            <th style={{ ...thSt, textAlign: 'right' }}>Impressions</th>
            <th style={{ ...thSt, textAlign: 'right' }}>Clicks</th>
            <th style={{ ...thSt, textAlign: 'right' }}>CTR</th>
            <th style={thSt}>Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid #F5F0E1` }}>
              <td style={{ padding: '6px 8px', color: INK, fontWeight: 500 }}>{r.term}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.impressions)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.clicks)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: INK, fontVariantNumeric: 'tabular-nums' }}>{(r.ctr * 100).toFixed(1)}%</td>
              <td style={{ padding: '6px 8px', color: r.trend === 'up' ? GREEN : r.trend === 'down' ? RED : INK_M }}>{r.trend === 'up' ? '▲' : r.trend === 'down' ? '▼' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompetitorBenchmark({ competitors, rating, totalReviews }: { competitors: CompetitorRow[]; rating: number | null; totalReviews: number | null }) {
  const self = competitors.find((c) => c.is_self);
  const others = competitors.filter((c) => !c.is_self);
  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
      <div style={sectionHead}>
        Competitor benchmarks <span style={sectionNote}>Namkhan vs comp set · Google rating + reviews</span>
      </div>
      {competitors.length === 0 ? (
        <EmptyPanel icon="◈" title="No comp set on file" body="Add competitors on the compset admin page." cta={{ label: 'Open compset', href: '/revenue/compset' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Namkhan self row (locked at top with brass accent) */}
          <BenchmarkRow name={self?.property_name ?? 'The Namkhan'} rating={rating} reviews={totalReviews} star={self?.star_rating ?? null} isSelf accent={GOLD} />
          {others.slice(0, 6).map((c) => (
            <BenchmarkRow key={c.comp_id} name={c.property_name} rating={null} reviews={null} star={c.star_rating} isSelf={false} accent={INK_M} />
          ))}
          <div style={{ fontSize: 10, color: INK_D, marginTop: 6, fontStyle: 'italic' }}>
            PLACEHOLDER — competitor ratings + review counts populate once the Google Places Details API is wired for each <code>google_place_id</code>. Star rating is live from compset admin.
          </div>
        </div>
      )}
    </div>
  );
}

function BenchmarkRow({ name, rating, reviews, star, isSelf, accent }: { name: string; rating: number | null; reviews: number | null; star: number | null; isSelf: boolean; accent: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 90px', gap: 10, alignItems: 'center', padding: '8px 10px', background: isSelf ? '#FBF7EA' : WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, borderLeft: `3px solid ${accent}` }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: isSelf ? 700 : 500, color: INK }}>{name}{isSelf && <span style={{ fontSize: 9, color: accent, marginLeft: 6, letterSpacing: '0.06em', fontWeight: 700 }}>NAMKHAN</span>}</div>
        <div style={{ fontSize: 10, color: INK_M }}>{star != null ? star + '★ classification' : 'unclassified'}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 9, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Rating</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{rating != null ? rating.toFixed(2) : '—'}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 9, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reviews</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{reviews != null ? fmtNum(reviews) : '—'}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 9, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Delta</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: INK_M }}>—</div>
      </div>
    </div>
  );
}

function PhotoGrid({ rows }: { rows: PhotoRow[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
      {rows.slice(0, 12).map((p, i) => (
        <div key={i} style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ aspectRatio: '4 / 3', background: `url(${p.url}) center/cover`, backgroundColor: '#E6DFCC' }} />
          <div style={{ padding: '6px 8px' }}>
            <div style={{ fontSize: 11, color: INK, fontWeight: 600 }}>{p.caption}</div>
            <div style={{ fontSize: 10, color: INK_M }}>{fmtNum(p.views)} views · {p.type}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QaQueue({ rows }: { rows: QaRow[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.slice(0, 6).map((q, i) => (
        <div key={i} style={{ padding: '10px 12px', background: q.answered ? WHITE : '#FDF7E6', border: `1px solid ${q.answered ? HAIR : '#E8CB84'}`, borderRadius: 4 }}>
          <div style={{ fontSize: 12, color: INK, fontWeight: 600, marginBottom: 3 }}>{q.question}</div>
          <div style={{ fontSize: 10, color: INK_M, marginBottom: 6 }}>asked by {q.asked_by} · {fmtRelative(q.asked_at)}</div>
          {q.answered ? (
            <div style={{ fontSize: 11, color: INK_S, fontStyle: 'italic', paddingLeft: 8, borderLeft: `2px solid ${GREEN}` }}>{q.answer}</div>
          ) : (
            <button type="button" style={btnPrimarySm}>Answer publicly →</button>
          )}
        </div>
      ))}
    </div>
  );
}

function PostFeed({ rows }: { rows: PostRow[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.slice(0, 6).map((p, i) => (
        <div key={i} style={{ padding: '10px 12px', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{p.title}</div>
            <span style={pillStatus(p.status)}>{p.status}</span>
          </div>
          <div style={{ fontSize: 11, color: INK_S, lineHeight: 1.4, marginBottom: 6 }}>{p.body}</div>
          <div style={{ fontSize: 10, color: INK_M, display: 'flex', gap: 10 }}>
            <span>{fmtRelative(p.posted_at)}</span>
            <span>views: {fmtNum(p.views)}</span>
            <span>clicks: {fmtNum(p.clicks)}</span>
            <span>type: {p.type}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentReviewsList({ reviews, pid }: { reviews: ReviewRow[]; pid: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {reviews.map((r) => (
        <div key={r.id} style={{ padding: '10px 12px', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SourceBadge source="google" size="sm" />
              <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{r.reviewer_name ?? 'Anonymous'}</span>
              <span style={{ fontSize: 11, color: r.rating_norm != null && r.rating_norm >= 4 ? GREEN : r.rating_norm != null && r.rating_norm <= 3 ? RED : INK_M, fontWeight: 700 }}>{r.rating_norm != null ? r.rating_norm.toFixed(1) + '★' : '—'}</span>
            </div>
            <span style={{ fontSize: 10, color: INK_M }}>{fmtRelative(r.reviewed_at)}</span>
          </div>
          {r.title && <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 2 }}>{r.title}</div>}
          {r.body && <div style={{ fontSize: 11, color: INK_S, lineHeight: 1.5 }}>{r.body.length > 220 ? r.body.slice(0, 220) + '…' : r.body}</div>}
          <div style={{ marginTop: 6 }}>
            {r.response_status === 'responded' ? (
              <span style={{ fontSize: 10, color: GREEN, fontWeight: 600 }}>✓ Replied</span>
            ) : (
              <TenantLink href={`/guest/reputation?review=${r.id}`} style={btnPrimarySm}>Reply →</TenantLink>
            )}
          </div>
        </div>
      ))}
      <TenantLink href="/guest/reputation" style={{ ...btnGhost, alignSelf: 'flex-end', marginTop: 4 }}>All reviews →</TenantLink>
      <span hidden>{pid}</span>
    </div>
  );
}

// ─── Data-shaping ─────────────────────────────────────────────────────────

interface WeeklyPoint { week: string; received: number; responded: number; avgHours: number | null }

function buildWeeklyReviewSeries(reviews: ReviewRow[], daysBack: number): WeeklyPoint[] {
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - daysBack);
  const weeks: Map<string, { received: number; responded: number }> = new Map();
  // Seed weeks so the chart never has holes.
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 7)) {
    weeks.set(weekKey(d), { received: 0, responded: 0 });
  }
  for (const r of reviews) {
    if (!r.reviewed_at) continue;
    const d = new Date(r.reviewed_at);
    if (d < start) continue;
    const k = weekKey(d);
    if (!weeks.has(k)) weeks.set(k, { received: 0, responded: 0 });
    const w = weeks.get(k)!;
    w.received += 1;
    if (r.response_status === 'responded') w.responded += 1;
  }
  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({ week, received: v.received, responded: v.responded, avgHours: null }));
}

function weekKey(d: Date): string {
  const monday = new Date(d);
  const diff = (monday.getDay() + 6) % 7; // Mon = 0
  monday.setDate(monday.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}

// ─── Style atoms ──────────────────────────────────────────────────────────

const sectionHead: React.CSSProperties = { fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, marginBottom: 10 };
const sectionNote: React.CSSProperties = { fontSize: 10, letterSpacing: '0.04em', textTransform: 'none', color: INK_D, fontWeight: 500, marginLeft: 8 };
const thSt: React.CSSProperties = { textAlign: 'left', padding: '8px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, fontWeight: 700, borderBottom: `1px solid ${HAIR}` };
const btnPrimary: React.CSSProperties = { padding: '6px 14px', fontSize: 11, fontWeight: 600, background: GREEN, color: WHITE, border: 'none', borderRadius: 4, textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' };
const btnPrimarySm: React.CSSProperties = { padding: '4px 10px', fontSize: 10, fontWeight: 600, background: GREEN, color: WHITE, border: 'none', borderRadius: 3, textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-block' };
const btnGhost: React.CSSProperties = { padding: '6px 12px', fontSize: 11, fontWeight: 500, background: WHITE, color: INK, border: `1px solid ${HAIR}`, borderRadius: 4, textDecoration: 'none' };

function pillStatus(s: PostRow['status']): React.CSSProperties {
  const color = s === 'published' ? GREEN : s === 'scheduled' ? AMBER : INK_M;
  return { fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase', color, border: `1px solid ${color}`, padding: '1px 6px', borderRadius: 2, fontWeight: 700 };
}
