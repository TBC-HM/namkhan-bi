// app/marketing/overview/page.tsx
// PBS 2026-07-11 pm — Real Marketing Overview dashboard (server component).
// Reads from mkt_v_media_by_tier, mkt_reviews, mkt_social_accounts, mkt_campaigns,
// mkt_yt_publications, mkt_yt_render_jobs, v_yt_channel_connections, v_marketing_media_page.
// All columns verified against information_schema before writing.
import Link from 'next/link';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const NAMKHAN_PROPERTY_ID = 260955;

interface PageProps { propertyId?: number }

// ─── design tokens (paper-white light theme) ──────────────────────────────
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_S  = '#3A3A3A';
const FOREST = '#084838';
const AMBER  = '#B48A3A';

const CARD: React.CSSProperties = {
  background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20,
};
const SECTION_H: React.CSSProperties = {
  fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M,
  marginBottom: 12, fontWeight: 500,
};
const KPI_LABEL: React.CSSProperties = {
  fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em',
};
const KPI_VALUE: React.CSSProperties = {
  fontSize: 24, color: INK, fontWeight: 500, lineHeight: 1.1, marginTop: 4,
};
const KPI_CAPTION: React.CSSProperties = {
  fontSize: 11, color: INK_M, marginTop: 6, lineHeight: 1.4,
};
const LINK_S: React.CSSProperties = {
  color: FOREST, textDecoration: 'none', fontWeight: 500,
};

// ─── helpers ──────────────────────────────────────────────────────────────
function nfmt(n: number | null | undefined): string {
  if (n == null) return '0';
  return n.toLocaleString();
}
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!t) return '—';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

interface TierRow    { primary_tier: string | null; total: number | null; photos: number | null; videos: number | null }
interface ReviewRow  { id: number; source: string | null; rating_norm: number | null; body: string | null; title: string | null; reviewer_name: string | null; reviewed_at: string | null; response_status: string | null }
interface SocialRow  { id: number; platform: string | null; handle: string | null; display_name: string | null; followers: number | null; url: string | null; active: boolean | null }
interface MediaRow   { asset_id: string; original_filename: string | null; primary_tier: string | null; public_url: string | null; created_at: string | null }
interface YtConnRow  { channel_id: string | null; channel_title: string | null; channel_handle: string | null; subscriber_count: number | null }

// ─── loader ────────────────────────────────────────────────────────────────
async function loadOverview(pid: number) {
  const sb = getSupabaseAdmin();

  const [tiers, reviewsAgg, unresponded, latestReviews, socials, campaignsAgg,
         ytConn, ytPubs, ytPubsMonth, ytRenderReady, media8] = await Promise.all([
    sb.from('mkt_v_media_by_tier').select('primary_tier,total,photos,videos'),
    sb.from('mkt_reviews').select('id, rating_norm, reviewed_at', { count: 'exact', head: false })
      .eq('property_id', pid)
      .gte('reviewed_at', new Date(Date.now() - 30 * 86400_000).toISOString()),
    sb.from('mkt_reviews').select('id, source, rating_norm, title, body, reviewer_name, reviewed_at, response_status')
      .eq('property_id', pid)
      .eq('response_status', 'unanswered')
      .order('reviewed_at', { ascending: false })
      .limit(5),
    sb.from('mkt_reviews').select('id, source, rating_norm, title, body, reviewer_name, reviewed_at, response_status')
      .eq('property_id', pid)
      .order('reviewed_at', { ascending: false })
      .limit(5),
    sb.from('mkt_social_accounts').select('id, platform, handle, display_name, followers, url, active')
      .eq('property_id', pid)
      .order('followers', { ascending: false, nullsFirst: false }),
    sb.from('mkt_campaigns').select('campaign_id, status', { count: 'exact', head: true })
      .eq('property_id', pid),
    sb.from('v_yt_channel_connections').select('channel_id, channel_title, channel_handle, subscriber_count')
      .eq('property_id', pid).eq('active', true).limit(1).maybeSingle(),
    sb.from('mkt_yt_publications').select('publication_id', { count: 'exact', head: true })
      .eq('property_id', pid),
    sb.from('mkt_yt_publications').select('publication_id', { count: 'exact', head: true })
      .eq('property_id', pid)
      .gte('actual_publish_utc', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    sb.from('mkt_yt_render_jobs').select('render_job_id', { count: 'exact', head: true })
      .eq('property_id', pid).eq('status', 'ready'),
    sb.from('v_marketing_media_page').select('asset_id, original_filename, primary_tier, public_url, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const tierRows = (tiers.data ?? []) as TierRow[];
  const mediaTotal = tierRows.reduce((s, r) => s + (r.total ?? 0), 0);
  const mediaTierCount = tierRows.length;

  // reviews total via a separate count HEAD query (kept simple – use rows length + 30d avg)
  const rev30d = (reviewsAgg.data ?? []) as { id: number; rating_norm: number | null; reviewed_at: string | null }[];
  const avg30d = rev30d.length
    ? (rev30d.reduce((s, r) => s + (r.rating_norm ?? 0), 0) / rev30d.length)
    : null;

  const unrespondedRows = ((unresponded.data ?? []) as ReviewRow[]);
  const latestRows      = ((latestReviews.data ?? []) as ReviewRow[]);
  const reviewsForList  = unrespondedRows.length ? unrespondedRows : latestRows;
  const socialRows      = ((socials.data ?? []) as SocialRow[]);

  const yt = (ytConn.data ?? null) as YtConnRow | null;

  return {
    mediaTotal, mediaTierCount,
    avg30d,
    reviewsForList,
    unrespondedCount: unrespondedRows.length,
    socialRows,
    campaignsTotal: campaignsAgg.count ?? 0,
    yt,
    ytPubsTotal: ytPubs.count ?? 0,
    ytPubsMonth: ytPubsMonth.count ?? 0,
    ytRenderReady: ytRenderReady.count ?? 0,
    media8: (media8.data ?? []) as MediaRow[],
  };
}

// ─── separate light query for reviews total (count only) ──────────────────
async function loadReviewsTotal(pid: number): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count } = await sb.from('mkt_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', pid);
  return count ?? 0;
}

// ─── page ──────────────────────────────────────────────────────────────────
export default async function MarketingOverviewPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? NAMKHAN_PROPERTY_ID;
  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/overview',
  }));

  let data: Awaited<ReturnType<typeof loadOverview>> | null = null;
  let reviewsTotal = 0;
  let loadError: string | null = null;
  try {
    [data, reviewsTotal] = await Promise.all([loadOverview(pid), loadReviewsTotal(pid)]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <DashboardPage title="Marketing · Overview" tabs={tabs}>
      {loadError && (
        <div style={{ gridColumn: '1 / -1', ...CARD, borderColor: AMBER, background: '#FDF7E6' }}>
          <div style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>Overview data load failed</div>
          <div style={{ fontSize: 11, color: INK_S, marginTop: 6 }}>{loadError}</div>
        </div>
      )}

      {data && (
        <>
          {/* A · KPI STRIP */}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <Kpi
              label="Media library"
              value={nfmt(data.mediaTotal)}
              caption={`assets across ${data.mediaTierCount} tier${data.mediaTierCount === 1 ? '' : 's'}`}
              href="/marketing/media"
            />
            {data.yt ? (
              <Kpi
                label="YT channel"
                value={nfmt(data.yt.subscriber_count ?? 0)}
                caption={`${data.yt.channel_title ?? 'connected'} subs`}
                href="/marketing/youtube"
              />
            ) : (
              <Kpi
                label="YT channel"
                value="—"
                caption="not connected"
                href="/marketing/youtube"
                actionLabel="Connect"
              />
            )}
            <Kpi
              label="Reviews"
              value={nfmt(reviewsTotal)}
              caption={data.avg30d != null ? `avg ${data.avg30d.toFixed(2)} last 30d` : 'no reviews in last 30d'}
              href="/marketing/reviews"
            />
            <Kpi
              label="Social accounts"
              value={nfmt(data.socialRows.length)}
              caption={data.socialRows.slice(0, 3).map(s => s.platform).filter(Boolean).join(', ') || '—'}
              href="/marketing/social"
            />
            <Kpi
              label="Active campaigns"
              value={nfmt(data.campaignsTotal)}
              caption={data.campaignsTotal === 0 ? 'none yet' : 'total on file'}
              href={data.campaignsTotal === 0 ? '/marketing/campaigns/new' : '/marketing/campaigns'}
              actionLabel={data.campaignsTotal === 0 ? 'Create' : undefined}
            />
            <Kpi
              label="YT this month"
              value={nfmt(data.ytPubsMonth)}
              caption={data.ytPubsMonth === 0 ? 'nothing published yet' : `${nfmt(data.ytPubsTotal)} total`}
              href="/marketing/youtube"
            />
          </div>

          {/* B · THREE-COLUMN BODY */}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, marginTop: 10 }}>

            {/* Column 1 · Content pipeline */}
            <Container title="Content pipeline" subtitle="latest master-tier assets" density="compact">
              {data.media8.length === 0 ? (
                <EmptyLine text="No media in the library yet." />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 60px)', gap: 8 }}>
                  {data.media8.map(m => (
                    <div key={m.asset_id} title={m.original_filename ?? m.asset_id}
                      style={{ width: 60, height: 60, borderRadius: 3, border: `1px solid ${HAIR}`, background: '#F5F0E1', overflow: 'hidden', position: 'relative' }}>
                      {m.public_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.public_url} alt={m.original_filename ?? ''}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ fontSize: 9, color: INK_M, padding: 4, lineHeight: 1.15 }}>
                          {(m.primary_tier ?? '—').slice(0, 20)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 12 }}>
                <Link href="/marketing/media" style={LINK_S}>View library →</Link>
              </div>
            </Container>

            {/* Column 2 · Reviews to reply */}
            <Container
              title={data.unrespondedCount > 0 ? 'Reviews to reply' : 'Latest reviews'}
              subtitle={data.unrespondedCount > 0
                ? `${data.unrespondedCount} unanswered`
                : 'no unanswered reviews'}
              density="compact"
            >
              {data.reviewsForList.length === 0 ? (
                <EmptyLine text="No reviews yet." />
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.reviewsForList.map(r => (
                    <div key={r.id} style={{ paddingBottom: 8, borderBottom: `1px solid ${HAIR}` }}>
                      <div style={{ fontSize: 11, color: INK_M, display: 'flex', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: INK }}>{r.source ?? '—'}</span>
                        {r.rating_norm != null && <span>{Number(r.rating_norm).toFixed(1)} ★</span>}
                        <span style={{ marginLeft: 'auto' }}>{timeAgo(r.reviewed_at)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: INK_S, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {(r.title ?? r.body ?? '').slice(0, 160) || '(no text)'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <Link href="/marketing/reviews" style={LINK_S}>All reviews →</Link>
              </div>
            </Container>

            {/* Column 3 · Social presence */}
            <Container title="Social presence" subtitle={`${data.socialRows.length} connected accounts`} density="compact">
              {data.socialRows.length === 0 ? (
                <EmptyLine text="No social accounts on file." />
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: INK_M, textAlign: 'left' }}>
                      <th style={{ padding: '4px 4px', borderBottom: `1px solid ${HAIR}`, fontWeight: 500 }}>Platform</th>
                      <th style={{ padding: '4px 4px', borderBottom: `1px solid ${HAIR}`, fontWeight: 500 }}>Handle</th>
                      <th style={{ padding: '4px 4px', borderBottom: `1px solid ${HAIR}`, fontWeight: 500, textAlign: 'right' }}>Followers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.socialRows.map(s => (
                      <tr key={s.id}>
                        <td style={{ padding: '4px 4px', color: INK }}>{s.platform ?? '—'}</td>
                        <td style={{ padding: '4px 4px', color: INK_S }}>
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noreferrer noopener" style={LINK_S}>
                              {s.handle ?? s.display_name ?? '—'}
                            </a>
                          ) : (s.handle ?? s.display_name ?? '—')}
                        </td>
                        <td style={{ padding: '4px 4px', color: INK, textAlign: 'right' }}>{nfmt(s.followers ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <Link href="/marketing/social" style={LINK_S}>All accounts →</Link>
              </div>
            </Container>
          </div>

          {/* C · YOUTUBE STATUS */}
          <div style={{ gridColumn: '1 / -1', ...CARD, marginTop: 10 }}>
            <div style={SECTION_H}>YouTube channel</div>
            {data.yt ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20 }}>
                <div>
                  <div style={KPI_LABEL}>Channel</div>
                  <div style={{ ...KPI_VALUE, fontSize: 16 }}>{data.yt.channel_title ?? '—'}</div>
                  <div style={KPI_CAPTION}>{data.yt.channel_handle ?? data.yt.channel_id ?? ''}</div>
                </div>
                <div>
                  <div style={KPI_LABEL}>Subscribers</div>
                  <div style={KPI_VALUE}>{nfmt(data.yt.subscriber_count ?? 0)}</div>
                </div>
                <div>
                  <div style={KPI_LABEL}>Published</div>
                  <div style={KPI_VALUE}>{nfmt(data.ytPubsTotal)}</div>
                  <div style={KPI_CAPTION}>{nfmt(data.ytPubsMonth)} this month</div>
                </div>
                <div>
                  <div style={KPI_LABEL}>Ready renders</div>
                  <div style={KPI_VALUE}>{nfmt(data.ytRenderReady)}</div>
                  <div style={KPI_CAPTION}>awaiting review</div>
                </div>
                <div style={{ alignSelf: 'end' }}>
                  <Link href="/marketing/youtube" style={{ ...LINK_S, fontSize: 12 }}>Open channel →</Link>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 13, color: INK_S }}>YouTube channel not connected.</div>
                <Link href="/marketing/youtube" style={{ ...LINK_S, fontSize: 12 }}>Connect →</Link>
              </div>
            )}
          </div>
        </>
      )}
    </DashboardPage>
  );
}

// ─── tiny KPI tile (server) ────────────────────────────────────────────────
function Kpi({
  label, value, caption, href, actionLabel,
}: { label: string; value: string; caption?: string; href?: string; actionLabel?: string }) {
  return (
    <div style={CARD}>
      <div style={KPI_LABEL}>{label}</div>
      <div style={KPI_VALUE}>{value}</div>
      {caption && <div style={KPI_CAPTION}>{caption}</div>}
      {href && (
        <div style={{ marginTop: 8, fontSize: 11 }}>
          <Link href={href} style={LINK_S}>{actionLabel ?? 'Open'} →</Link>
        </div>
      )}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div style={{ fontSize: 12, color: INK_M, padding: '4px 0' }}>{text}</div>;
}
