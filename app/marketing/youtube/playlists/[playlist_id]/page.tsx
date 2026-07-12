// app/marketing/youtube/playlists/[playlist_id]/page.tsx
// PBS 2026-07-13 — Playlist detail. In-app, not YouTube redirect. Shows videos in
// playlist with view/like/comment counts, ranked by views; performance vs median.
import Link from 'next/link';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchChannelPlaylists, fetchPlaylistItemsWithStats, isErr } from '@/lib/youtube/data';
import YtSubTabs from '../../_shared/SubTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_S  = '#3A3A3A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER  = '#B48A3A';
const RED    = '#B03826';
const OK     = '#0E7A4B';

function fmt(n: number): string { return new Intl.NumberFormat('en-US').format(n); }
function fmtCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
function fmtDuration(iso: string): string {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '');
  if (!m) return '';
  const h = Number(m[1] ?? 0), mi = Number(m[2] ?? 0), s = Number(m[3] ?? 0);
  if (h > 0) return `${h}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${mi}:${String(s).padStart(2, '0')}`;
}

interface Params { params: { playlist_id: string } }

export default async function YtPlaylistDetailPage({ params }: Params) {
  const playlistId = decodeURIComponent(params.playlist_id);
  const sb = getSupabaseAdmin();
  const { data: connection } = await sb
    .from('v_yt_channel_connections')
    .select('id,channel_id').eq('property_id', NAMKHAN).eq('active', true).maybeSingle();

  const tabs = MARKETING_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));
  const cardStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, gridColumn: '1 / -1' };
  const sectionH: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };

  if (!connection?.channel_id) {
    return (
      <DashboardPage title="YouTube · channel management" tabs={tabs}>
        <YtSubTabs current="playlists" />
        <div style={{ ...cardStyle }}>Connect YouTube first.</div>
      </DashboardPage>
    );
  }
  const tok = await getFreshAccessToken(NAMKHAN);
  if (!tok.ok || !tok.access_token) {
    return (
      <DashboardPage title="YouTube · channel management" tabs={tabs}>
        <YtSubTabs current="playlists" />
        <div style={{ ...cardStyle }}>Session expired. Reconnect via Dashboard.</div>
      </DashboardPage>
    );
  }

  // Fetch playlist metadata + items in parallel
  const [plMeta, plItems] = await Promise.all([
    fetchChannelPlaylists(tok.access_token, connection.channel_id, 50),
    fetchPlaylistItemsWithStats(tok.access_token, playlistId, 50),
  ]);
  const playlist = isErr(plMeta) ? null : plMeta.data.find((p) => p.id === playlistId) ?? null;
  const videos = isErr(plItems) ? [] : plItems.data;
  const err = isErr(plItems) ? `${plItems.error}${plItems.detail ? ` · ${plItems.detail.slice(0, 120)}` : ''}` : null;

  // Rank + compute median views for baseline
  const sorted = [...videos].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const viewsArr = videos.map((v) => v.views ?? 0).sort((a, b) => a - b);
  const median = viewsArr.length ? viewsArr[Math.floor(viewsArr.length / 2)] : 0;
  const totalViews = videos.reduce((s, v) => s + (v.views ?? 0), 0);
  const totalLikes = videos.reduce((s, v) => s + (v.likes ?? 0), 0);
  const totalComments = videos.reduce((s, v) => s + (v.comments ?? 0), 0);

  // Cadence: average gap between publishedAt values
  const dates = videos.map((v) => new Date(v.publishedAt).getTime()).filter((t) => !isNaN(t)).sort((a, b) => a - b);
  let avgGapDays: number | null = null;
  if (dates.length > 1) {
    let gapSum = 0;
    for (let i = 1; i < dates.length; i++) gapSum += (dates[i] - dates[i - 1]) / 86400000;
    avgGapDays = gapSum / (dates.length - 1);
  }
  const lastPublished = dates.length ? new Date(dates[dates.length - 1]) : null;
  const daysSinceLast = lastPublished ? Math.floor((Date.now() - lastPublished.getTime()) / 86400000) : null;

  return (
    <DashboardPage title="YouTube · channel management" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="playlists" />
        <div style={{ gridColumn: '1 / -1' }}>
          <Link href="/marketing/youtube/playlists" style={{ fontSize: 11, color: INK_M, textDecoration: 'none' }}>← All playlists</Link>
        </div>

        {/* Playlist header */}
        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 600, color: INK, marginBottom: 4 }}>{playlist?.title ?? 'Playlist'}</div>
          {playlist?.description && <div style={{ fontSize: 12, color: INK_M, marginBottom: 12, maxHeight: 40, overflow: 'hidden' }}>{playlist.description}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <Kpi label="Videos" value={fmt(videos.length)} />
            <Kpi label="Total views" value={fmtCompact(totalViews)} sub={`median ${fmtCompact(median)}`} />
            <Kpi label="Total likes" value={fmtCompact(totalLikes)} />
            <Kpi label="Total comments" value={fmtCompact(totalComments)} />
            <Kpi label="Avg gap" value={avgGapDays != null ? `${avgGapDays.toFixed(0)}d` : '—'} sub={avgGapDays != null ? cadenceLabel(avgGapDays) : ''} />
            <Kpi label="Last published" value={daysSinceLast != null ? `${daysSinceLast}d ago` : '—'} sub={daysSinceLast != null && daysSinceLast > 60 ? 'STALE' : ''} />
          </div>
          {err && <div style={{ marginTop: 12, fontSize: 11, color: RED }}>Couldn&apos;t load items: {err}</div>}
        </div>

        {/* Ranked videos */}
        <div style={cardStyle}>
          <div style={sectionH}>Videos · ranked by views</div>
          {sorted.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>{err ? '—' : 'No videos in this playlist.'}</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map((v, i) => {
                const perf = median > 0 ? (v.views ?? 0) / median : 0;
                const perfColor = perf > 1.5 ? OK : perf > 0.5 ? INK : AMBER;
                const perfLabel = perf > 1.5 ? 'Hit' : perf > 0.5 ? 'On-median' : 'Under';
                const thumb = v.thumbnails.medium?.url ?? v.thumbnails.high?.url ?? v.thumbnails.default?.url ?? null;
                return (
                  <div key={v.videoId} style={{ display: 'grid', gridTemplateColumns: 'auto 160px 1fr auto', gap: 12, padding: '8px', borderBottom: `1px solid ${HAIR}`, alignItems: 'center' }}>
                    <div style={{ fontSize: 20, color: INK_M, fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>{i + 1}</div>
                    <div style={{ position: 'relative', aspectRatio: '16 / 9', background: CREAM, borderRadius: 3, overflow: 'hidden' }}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : null}
                      {v.duration && <span style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,.8)', color: WHITE, fontSize: 10, padding: '1px 4px', borderRadius: 2 }}>{fmtDuration(v.duration)}</span>}
                    </div>
                    <div>
                      <a href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer noopener" style={{ fontSize: 13, color: INK, fontWeight: 500, textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title}</a>
                      <div style={{ fontSize: 11, color: INK_M, marginTop: 4, display: 'flex', gap: 12 }}>
                        <span>{fmtCompact(v.views ?? 0)} views</span>
                        <span>{fmtCompact(v.likes ?? 0)} likes</span>
                        <span>{fmtCompact(v.comments ?? 0)} comments</span>
                        <span>· {v.publishedAt.slice(0, 10)}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: perfColor, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '.04em' }}>{perfLabel}</div>
                      <div style={{ fontSize: 10, color: INK_M, fontVariantNumeric: 'tabular-nums' }}>{perf.toFixed(1)}× median</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardPage>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ padding: 10, border: `1px solid ${HAIR}`, borderRadius: 3 }}>
      <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: sub === 'STALE' ? RED : INK_M, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function cadenceLabel(gap: number): string {
  if (gap <= 8) return 'weekly';
  if (gap <= 16) return 'biweekly';
  if (gap <= 35) return 'monthly';
  if (gap <= 100) return 'quarterly';
  return 'sparse';
}
