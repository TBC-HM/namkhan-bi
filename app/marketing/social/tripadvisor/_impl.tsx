// app/marketing/social/tripadvisor/_impl.tsx
// TripAdvisor analytics — full channel page.
// Data: mkt_reviews (source=tripadvisor) + v_review_source_summary.
// DataForSEO can enrich subcategory ratings (Value/Rooms/Location/Cleanliness/
// Service/Sleep Quality) via a scheduled pull; placeholder shown until wired.
//
// Review replies: TripAdvisor has no public management API — "Reply" links open
// the Management Center. Response state comes from response_status in mkt_reviews.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import ReviewsVelocityChart from '../google-business/_client/ReviewsVelocityChart';
import TaChannelPanel from './_client/TaChannelPanel';
import { getSocialPrograms, getSocialChannelRules, type SocialProgram, type SocialChannelRule } from '@/lib/marketing';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ─── Palette ──────────────────────────────────────────────────────────────
const WHITE  = '#FFFFFF';
const CREAM  = '#F5F0E1';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#3A3A3A';
const INK_M  = '#5A5A5A';
const INK_D  = '#8A8A8A';
const GREEN  = '#1F3A2E';
const FOREST = '#084838';
const RED    = '#B03826';
const AMBER  = '#C28F2C';
// TripAdvisor brand
const TA_GREEN  = '#00AF87';
const TA_FOREST = '#007A60';

// ─── Types ────────────────────────────────────────────────────────────────
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
interface SummaryRow {
  source: string;
  total_reviews_on_platform: number | null;
  ranking_position: number | null;
  ranking_total: number | null;
  ranking_context: string | null;
  score_overall: number | null;
}
interface WeeklyPoint {
  week: string;
  received: number;
  responded: number;
  avgHours: number | null;
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
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  if (days < 365) return Math.floor(days / 30) + 'mo ago';
  return Math.floor(days / 365) + 'y ago';
}

function buildVelocity(reviews: ReviewRow[], daysBack: number): WeeklyPoint[] {
  const now = new Date();
  const start = new Date(now); start.setDate(start.getDate() - daysBack);
  const weekKey = (d: Date): string => {
    const mon = new Date(d);
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    return mon.toISOString().slice(0, 10);
  };
  const weeks = new Map<string, { received: number; responded: number }>();
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

// ─── Style constants ───────────────────────────────────────────────────────
const sectionHead: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: INK, marginBottom: 10,
  display: 'flex', alignItems: 'baseline', gap: 8,
};
const sectionNote: React.CSSProperties = {
  fontSize: 11, fontWeight: 400, color: INK_M,
};

// ─── Page ─────────────────────────────────────────────────────────────────
export default async function TripAdvisorPage({
  propertyId,
  searchParams: _sp,
}: {
  propertyId?: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pid = propertyId ?? PROPERTY_ID;
  const sb = getSupabaseAdmin();

  const [reviewsR, summaryR, subcatR, taPrograms, taRules] = await Promise.all([
    sb.from('mkt_reviews')
      .select('id, source, reviewer_name, rating_norm, title, body, reviewed_at, response_status, response_text')
      .eq('property_id', pid)
      .eq('source', 'tripadvisor')
      .order('reviewed_at', { ascending: false })
      .limit(500),
    sb.from('v_review_source_summary')
      .select('*')
      .eq('property_id', pid)
      .eq('source', 'tripadvisor')
      .maybeSingle(),
    sb.from('v_ta_subcategory_latest')
      .select('*')
      .eq('property_id', pid)
      .maybeSingle(),
    getSocialPrograms(pid),
    getSocialChannelRules(pid),
  ]);

  const reviews: ReviewRow[] = (reviewsR.data as ReviewRow[]) ?? [];
  const summary: SummaryRow | null = (summaryR.data as SummaryRow | null) ?? null;
  const subcat = subcatR.data as Record<string, number | null> | null;
  const taPrograms_: SocialProgram[] = (taPrograms as SocialProgram[]).filter((p) => p.platform === 'tripadvisor');
  const taRule: SocialChannelRule | null = ((taRules as SocialChannelRule[]).find((r) => r.platform === 'tripadvisor')) ?? null;

  // ── KPI derivations ─────────────────────────────────────────────────────
  const score = summary?.score_overall != null ? Number(summary.score_overall) : null;
  const totalOnPlatform = summary?.total_reviews_on_platform ?? reviews.length;
  const cutoff30 = Date.now() - 30 * 86400_000;
  const new30d = reviews.filter((r) => r.reviewed_at && new Date(r.reviewed_at).getTime() >= cutoff30).length;
  const responded = reviews.filter((r) => r.response_status === 'responded').length;
  const responseRate = reviews.length > 0 ? (responded / reviews.length) * 100 : null;
  const ranking = summary?.ranking_position != null ? `#${summary.ranking_position}${summary.ranking_total != null ? ' of ' + fmtNum(summary.ranking_total) : ''}` : null;
  const rankingCtx = summary?.ranking_context ?? null;

  // ── Rating distribution ─────────────────────────────────────────────────
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    label: star === 5 ? 'Excellent' : star === 4 ? 'Very Good' : star === 3 ? 'Average' : star === 2 ? 'Poor' : 'Terrible',
    count: reviews.filter((r) => r.rating_norm != null && Math.round(Number(r.rating_norm)) === star).length,
  }));
  const maxDist = Math.max(...dist.map((d) => d.count), 1);

  // ── Review velocity ──────────────────────────────────────────────────────
  const velocity = buildVelocity(reviews, 90);

  // ── Review slices ────────────────────────────────────────────────────────
  const needsReply = reviews.filter((r) => r.response_status !== 'responded').slice(0, 10);
  const recent = reviews.slice(0, 20);

  // ── DashboardPage tabs ───────────────────────────────────────────────────
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: { href: string; label: string }) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/social',
  }));

  // ── KPI tiles ────────────────────────────────────────────────────────────
  const tiles: KpiTileProps[] = [
    { label: 'TA Score',       value: score != null ? score.toFixed(1) : '—',                       size: 'sm', footnote: 'out of 5 · weighted', status: score != null && score < 4.0 ? 'amber' : undefined },
    { label: 'Total reviews',  value: fmtNum(totalOnPlatform),                                       size: 'sm', footnote: 'on TripAdvisor platform' },
    { label: 'In our DB',      value: fmtNum(reviews.length),                                        size: 'sm', footnote: 'scraped reviews' },
    { label: 'New · 30d',      value: fmtNum(new30d),                                                size: 'sm', footnote: 'trailing 30 days' },
    { label: 'Response rate',  value: responseRate != null ? responseRate.toFixed(0) + '%' : '—',   size: 'sm', footnote: 'replied vs total', status: responseRate != null && responseRate < 60 ? 'amber' : undefined },
    { label: 'Ranking',        value: ranking ?? '—',                                                  size: 'sm', footnote: rankingCtx ?? 'from summary view' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="TripAdvisor"
        subtitle="Review analytics · response tracking · rating distribution · subcategory scores"
        tabs={tabs}
      >

        {/* ── Header strip ─────────────────────────────────────────── */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, borderTop: `3px solid ${TA_GREEN}` }}>
            <span style={{ fontSize: 28 }}>🦉</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>TripAdvisor — Analytics &amp; Reviews</div>
              <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
                Data from <code>mkt_reviews</code> ({reviews.length} scraped) · summary from <code>v_review_source_summary</code>
                {score != null && <span> · Overall score <strong style={{ color: TA_FOREST }}>{score.toFixed(1)}</strong></span>}
                {ranking && rankingCtx && <span> · Ranked <strong style={{ color: TA_FOREST }}>{ranking}</strong> {rankingCtx}</span>}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <a href="https://www.tripadvisor.com/ManagementCenter" target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', padding: '6px 14px', fontSize: 11, fontWeight: 600, background: TA_GREEN, color: WHITE, borderRadius: 4, textDecoration: 'none' }}>
                Manage on TripAdvisor →
              </a>
            </div>
          </div>
        </div>

        {/* ── KPI strip ─────────────────────────────────────────────── */}
        <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 14px' }}>
          <div style={sectionHead}>Performance snapshot <span style={sectionNote}>trailing 30 days · from scraped reviews</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </div>

        {/* ── Rating distribution + Subcategory ratings ─────────────── */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>

          {/* Rating distribution */}
          <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
            <div style={sectionHead}>Rating distribution <span style={sectionNote}>from {reviews.length} scraped reviews</span></div>
            {reviews.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: INK_M, fontSize: 12 }}>No reviews scraped yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dist.map(({ star, label, count }) => {
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  const barW = maxDist > 0 ? (count / maxDist) * 100 : 0;
                  const barColor = star >= 4 ? TA_GREEN : star === 3 ? AMBER : RED;
                  return (
                    <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 64, fontSize: 11, color: INK_S, flexShrink: 0 }}>{label}</span>
                      <div style={{ flex: 1, background: HAIR, borderRadius: 2, height: 10, overflow: 'hidden' }}>
                        <div style={{ width: barW + '%', height: '100%', background: barColor, borderRadius: 2, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ width: 28, fontSize: 11, color: INK_M, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                      <span style={{ width: 34, fontSize: 10, color: INK_D, textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
                <div style={{ marginTop: 4, fontSize: 10, color: INK_D, fontStyle: 'italic' }}>
                  Computed from {reviews.length} local sample. Platform total: {fmtNum(totalOnPlatform)}.
                </div>
              </div>
            )}
          </div>

          {/* Subcategory ratings — DataForSEO enrichment */}
          <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
            <div style={sectionHead}>
              Subcategory ratings
              <span style={sectionNote}>Value · Rooms · Location · Cleanliness · Service · Sleep Quality</span>
              {subcat?.scraped_at && (
                <span style={{ ...sectionNote, marginLeft: 'auto' }}>
                  via DataForSEO · {new Date(String(subcat.scraped_at)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            {subcat ? (
              <SubcategoryGrid subcat={subcat} />
            ) : (
              <SubcategoryPlaceholder />
            )}
          </div>
        </div>

        {/* ── Review velocity chart ──────────────────────────────────── */}
        <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={sectionHead}>Review velocity <span style={sectionNote}>90 days · weekly buckets · response tracking</span></div>
          {velocity.every((w) => w.received === 0) ? (
            <div style={{ padding: '32px 24px', background: WHITE, border: `1px dashed ${HAIR}`, borderRadius: 6, textAlign: 'center', color: INK_M, fontSize: 12 }}>
              No TripAdvisor reviews in the trailing 90 days. Pull latest to refresh.
            </div>
          ) : (
            <ReviewsVelocityChart data={velocity} />
          )}
        </div>

        {/* ── Needs reply ────────────────────────────────────────────── */}
        {needsReply.length > 0 && (
          <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ ...sectionHead, justifyContent: 'space-between' }}>
              <span>
                Needs reply <span style={sectionNote}>unanswered · most recent first</span>
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, background: '#FBE8E4', color: RED, border: `1px solid #E8B7AB`, borderRadius: 99, padding: '2px 8px' }}>
                {needsReply.length} open
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {needsReply.map((r) => <ReviewCard key={r.id} r={r} compact />)}
            </div>
          </div>
        )}

        {/* ── Full review feed ──────────────────────────────────────── */}
        <div style={{ gridColumn: '1 / -1', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={{ ...sectionHead, justifyContent: 'space-between' }}>
            <span>
              Recent reviews <span style={sectionNote}>latest {Math.min(recent.length, 20)} scraped · reply via Management Center</span>
            </span>
            <a href="https://www.tripadvisor.com/ManagementCenter" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: TA_FOREST, textDecoration: 'underline' }}>
              Reply on TripAdvisor →
            </a>
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: '32px 24px', background: WHITE, border: `1px dashed ${HAIR}`, borderRadius: 6, textAlign: 'center', color: INK_M, fontSize: 12 }}>
              No TripAdvisor reviews in the database yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map((r) => <ReviewCard key={r.id} r={r} />)}
            </div>
          )}
        </div>

        {/* ── Channel settings: guardrails + programs ───────────────── */}
        <TaChannelPanel
          propertyId={pid}
          initialRule={taRule}
          initialPrograms={taPrograms_}
        />

        {/* ── DataForSEO pull section ────────────────────────────────── */}
        <div style={{ gridColumn: '1 / -1', background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={sectionHead}>DataForSEO enrichment <span style={sectionNote}>Business Data API · TripAdvisor Reviews endpoint · wired</span></div>
          <div style={{ fontSize: 12, color: INK_S, lineHeight: 1.6, marginBottom: 8 }}>
            Pulls up to <strong>4,490 reviews</strong> (45 pages × 100) with subcategory ratings (Value / Rooms / Location / Cleanliness / Service / Sleep Quality). Two cron routes are deployed — apply the SQL migrations then schedule:
          </div>
          <ol style={{ fontSize: 11, color: INK_S, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            <li>Apply migrations in <code>db/proposed/ta-dataforseo-enrichment-v1/</code> via Supabase MCP.</li>
            <li>Run <code>/api/cron/ta-urlpath-discover</code> once — discovers and caches the property&apos;s TA <code>url_path</code>.</li>
            <li>Schedule <code>/api/cron/ta-reviews-dataforseo</code> weekly (Mon 04:00 UTC) via pg_cron — pulls reviews + subcategory data.</li>
            <li>Subcategory ratings section above auto-populates after first run.</li>
          </ol>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div style={{ gridColumn: '1 / -1', padding: '10px 12px', fontSize: 11, color: INK_M, fontStyle: 'italic', borderTop: `1px solid ${HAIR}` }}>
          Data: <code>public.mkt_reviews</code> (source=tripadvisor) + <code>public.v_review_source_summary</code>. Review replies require TripAdvisor Management Center — no direct API available. DataForSEO enrichment adds subcategory ratings + deeper history (up to 4,490 reviews).
        </div>
      </DashboardPage>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

const WHITE2  = '#FFFFFF';
const HAIR2   = '#E6DFCC';
const INK2    = '#1B1B1B';
const INK_S2  = '#3A3A3A';
const INK_M2  = '#5A5A5A';
const GREEN2  = '#1F3A2E';
const RED2    = '#B03826';
const TA_G2   = '#00AF87';
const TA_F2   = '#007A60';

function ReviewCard({ r, compact = false }: { r: ReviewRow; compact?: boolean }) {
  const rating = r.rating_norm != null ? Number(r.rating_norm) : null;
  const replied = r.response_status === 'responded';
  const ratingColor = rating != null ? (rating >= 4 ? TA_G2 : rating <= 2 ? RED2 : '#C28F2C') : INK_M2;

  return (
    <div style={{
      padding: '10px 12px',
      background: replied ? WHITE2 : '#FDF7E6',
      border: `1px solid ${replied ? HAIR2 : '#E8CB84'}`,
      borderRadius: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: INK_M2 }}>🦉</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: INK2 }}>{r.reviewer_name ?? 'Anonymous'}</span>
          {rating != null && (
            <span style={{ fontSize: 11, fontWeight: 700, color: ratingColor }}>{rating.toFixed(1)} ★</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
            padding: '2px 8px', borderRadius: 99,
            background: replied ? '#E4F1E0' : '#FBE8E4',
            color:      replied ? '#1F5C2C' : RED2,
            border: `1px solid ${replied ? '#A9CFA0' : '#E8B7AB'}`,
          }}>
            {replied ? '✓ replied' : 'no reply'}
          </span>
          <span style={{ fontSize: 10, color: INK_M2 }}>{fmtRelative(r.reviewed_at)}</span>
        </div>
      </div>
      {r.title && <div style={{ fontSize: 12, fontWeight: 600, color: INK2, marginBottom: 3 }}>{r.title}</div>}
      {!compact && r.body && (
        <div style={{ fontSize: 11, color: INK_S2, lineHeight: 1.5, marginBottom: 6 }}>
          {r.body.length > 260 ? r.body.slice(0, 260) + '…' : r.body}
        </div>
      )}
      {!replied && (
        <a href="https://www.tripadvisor.com/ManagementCenter" target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', marginTop: 4, padding: '4px 10px', fontSize: 11, fontWeight: 600, background: TA_G2, color: WHITE2, borderRadius: 3, textDecoration: 'none' }}>
          Reply on TripAdvisor →
        </a>
      )}
      {replied && r.response_text && !compact && (
        <div style={{ marginTop: 6, fontSize: 11, color: INK_S2, fontStyle: 'italic', paddingLeft: 8, borderLeft: `2px solid ${TA_G2}` }}>
          {r.response_text.length > 200 ? r.response_text.slice(0, 200) + '…' : r.response_text}
        </div>
      )}
    </div>
  );
}

function SubcategoryGrid({ subcat }: { subcat: Record<string, number | null> }) {
  const CATS: { label: string; key: string }[] = [
    { label: 'Value',         key: 'value_rating' },
    { label: 'Rooms',         key: 'rooms_rating' },
    { label: 'Location',      key: 'location_rating' },
    { label: 'Cleanliness',   key: 'cleanliness_rating' },
    { label: 'Service',       key: 'service_rating' },
    { label: 'Sleep Quality', key: 'sleep_quality_rating' },
  ];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
        {CATS.map(({ label, key }) => {
          const score = subcat[key] != null ? Number(subcat[key]) : null;
          const color = score == null ? INK_D : score >= 4.5 ? TA_FOREST : score >= 4.0 ? TA_GREEN : score >= 3.0 ? AMBER : RED;
          return (
            <div key={key} style={{ padding: '8px 10px', background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: INK_M, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color }}>
                {score != null ? score.toFixed(1) : '—'}
              </div>
              {score != null && (
                <div style={{ fontSize: 9, color: INK_D, marginTop: 2 }}>/ 5.0</div>
              )}
            </div>
          );
        })}
      </div>
      {subcat.total_reviews_pulled != null && (
        <div style={{ fontSize: 10, color: INK_D, marginTop: 4 }}>
          Aggregated from {Number(subcat.total_reviews_pulled).toLocaleString()} reviews pulled via DataForSEO.
        </div>
      )}
    </div>
  );
}

function SubcategoryPlaceholder() {
  const CATS = ['Value', 'Rooms', 'Location', 'Cleanliness', 'Service', 'Sleep Quality'];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {CATS.map((cat) => (
          <div key={cat} style={{ padding: '8px 10px', background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: INK_M, marginBottom: 4 }}>{cat}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: INK_D }}>—</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 12px', background: '#EEF7F4', border: `1px solid #B0DDD3`, borderRadius: 4, fontSize: 11, color: TA_FOREST, lineHeight: 1.5 }}>
        <strong>Wire DataForSEO enrichment</strong> to populate subcategory scores. The Reviews endpoint returns per-review <code>review_highlights</code> (Value / Rooms / Location / Cleanliness / Service / Sleep Quality) — aggregate them into a nightly cron job and scores appear here automatically.
      </div>
    </div>
  );
}
