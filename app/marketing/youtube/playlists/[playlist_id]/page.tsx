// app/marketing/youtube/playlists/[playlist_id]/page.tsx
// PBS 2026-07-13 — Playlist detail. In-app, not YouTube redirect. Shows videos in
// playlist with view/like/comment counts, ranked by views; performance vs median.
//
// PBS 2026-07-12 — Extended with:
//   • Scheduling & best-length card (server-computed, no LLM):
//     - best-performing duration bucket (median views)
//     - best day-of-week heatmap (median views)
//     - best hour-of-day sparkline (24 cells)
//     - recommended next publish (last-published + linked-pillar cadence,
//       snapped to best day + hour)
//   • 12-month title-proposal calendar (LLM-generated on demand):
//     - "Generate 12-month calendar" button hits /api/marketing/youtube/generate-title-proposals
//     - Each proposal card shows title/angle/length + "Queue to publish →" button
//       that hits /api/marketing/youtube/queue-title-proposal.
import Link from 'next/link';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchChannelPlaylists, fetchPlaylistItemsWithStats, isErr, type PlaylistVideo } from '@/lib/youtube/data';
import YtSubTabs from '../../_shared/SubTabs';
import { GenerateProposalsButton, QueueProposalButton } from '../../_client/PlaylistCalendarActions';

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

const LENGTH_BUCKETS = ['0-30s', '30-60s', '1-3min', '3-8min', '8min+'] as const;
type LengthBucket = typeof LENGTH_BUCKETS[number];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
function durationToSeconds(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}
function bucketFor(sec: number): LengthBucket {
  if (sec <= 30)  return '0-30s';
  if (sec <= 60)  return '30-60s';
  if (sec <= 180) return '1-3min';
  if (sec <= 480) return '3-8min';
  return '8min+';
}
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function cadenceDays(c: string | null | undefined): number {
  switch ((c ?? '').toLowerCase()) {
    case 'weekly':    return 7;
    case 'biweekly':  return 14;
    case 'monthly':   return 30;
    case 'quarterly': return 90;
    default:          return 30;
  }
}
function cadenceLabel(gap: number): string {
  if (gap <= 8) return 'weekly';
  if (gap <= 16) return 'biweekly';
  if (gap <= 35) return 'monthly';
  if (gap <= 100) return 'quarterly';
  return 'sparse';
}

interface Params { params: { playlist_id: string } }

export default async function YtPlaylistDetailPage({ params }: Params) {
  const playlistId = decodeURIComponent(params.playlist_id);
  const sb = getSupabaseAdmin();

  // Proactive auto-refresh of YT OAuth token via SECURITY DEFINER RPC. No-op if token still valid.
  try { await sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }); } catch { /* silent */ }

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

  // Fetch playlist metadata + items + linked pillar + existing proposals in parallel
  const [plMeta, plItems, pillarRes, proposalsRes] = await Promise.all([
    fetchChannelPlaylists(tok.access_token, connection.channel_id, 50),
    fetchPlaylistItemsWithStats(tok.access_token, playlistId, 50),
    sb.from('v_yt_content_pillars')
      .select('pillar_key,label,target_cadence,youtube_playlist_id')
      .eq('property_id', NAMKHAN).eq('active', true)
      .eq('youtube_playlist_id', playlistId)
      .maybeSingle(),
    sb.from('v_yt_title_proposals')
      .select('id,scheduled_month,rank,proposed_title,proposed_angle,proposed_length_bucket,status,generated_at,video_request_id')
      .eq('property_id', NAMKHAN)
      .eq('playlist_id', playlistId)
      .order('scheduled_month', { ascending: true })
      .order('rank', { ascending: true }),
  ]);
  const playlist = isErr(plMeta) ? null : plMeta.data.find((p) => p.id === playlistId) ?? null;
  const videos: PlaylistVideo[] = isErr(plItems) ? [] : plItems.data;
  const err = isErr(plItems) ? `${plItems.error}${plItems.detail ? ` · ${plItems.detail.slice(0, 120)}` : ''}` : null;
  const linkedPillar = (pillarRes.data ?? null) as { pillar_key: string; label: string; target_cadence: string | null; youtube_playlist_id: string | null } | null;
  const proposals = (proposalsRes.data ?? []) as Array<{
    id: string; scheduled_month: string; rank: number;
    proposed_title: string; proposed_angle: string | null; proposed_length_bucket: string | null;
    status: string; generated_at: string; video_request_id: string | null;
  }>;

  // ---------- KPIs ----------
  const sorted = [...videos].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const viewsArr = videos.map((v) => v.views ?? 0).sort((a, b) => a - b);
  const medianViews = viewsArr.length ? viewsArr[Math.floor(viewsArr.length / 2)] : 0;
  const totalViews = videos.reduce((s, v) => s + (v.views ?? 0), 0);
  const totalLikes = videos.reduce((s, v) => s + (v.likes ?? 0), 0);
  const totalComments = videos.reduce((s, v) => s + (v.comments ?? 0), 0);

  const dates = videos.map((v) => new Date(v.publishedAt).getTime()).filter((t) => !isNaN(t)).sort((a, b) => a - b);
  let avgGapDays: number | null = null;
  if (dates.length > 1) {
    let gapSum = 0;
    for (let i = 1; i < dates.length; i++) gapSum += (dates[i] - dates[i - 1]) / 86400000;
    avgGapDays = gapSum / (dates.length - 1);
  }
  const lastPublished = dates.length ? new Date(dates[dates.length - 1]) : null;
  const daysSinceLast = lastPublished ? Math.floor((Date.now() - lastPublished.getTime()) / 86400000) : null;

  // ---------- Scheduling intelligence (server-computed) ----------
  // Best-performing duration bucket (median views).
  const bucketStats: Array<{ bucket: LengthBucket; median_views: number; sample: number }> = [];
  for (const b of LENGTH_BUCKETS) {
    const arr = videos.filter((v) => bucketFor(durationToSeconds(v.duration)) === b).map((v) => v.views ?? 0);
    bucketStats.push({ bucket: b, median_views: median(arr), sample: arr.length });
  }
  const rankedBuckets = [...bucketStats].filter((b) => b.sample > 0).sort((a, b) => b.median_views - a.median_views);
  const bestBucket = rankedBuckets[0] ?? null;
  const maxBucketMed = bucketStats.reduce((m, b) => Math.max(m, b.median_views), 0);

  // Best day-of-week (median views).
  const dowStats: Array<{ dow: number; median_views: number; sample: number }> = [];
  for (let d = 0; d < 7; d++) {
    const arr = videos
      .filter((v) => { const t = new Date(v.publishedAt); return !isNaN(t.getTime()) && t.getUTCDay() === d; })
      .map((v) => v.views ?? 0);
    dowStats.push({ dow: d, median_views: median(arr), sample: arr.length });
  }
  const bestDow = [...dowStats].filter((d) => d.sample > 0).sort((a, b) => b.median_views - a.median_views)[0] ?? null;
  const maxDowMed = dowStats.reduce((m, d) => Math.max(m, d.median_views), 0);

  // Best hour-of-day (median views).
  const hourStats: Array<{ hour: number; median_views: number; sample: number }> = [];
  for (let h = 0; h < 24; h++) {
    const arr = videos
      .filter((v) => { const t = new Date(v.publishedAt); return !isNaN(t.getTime()) && t.getUTCHours() === h; })
      .map((v) => v.views ?? 0);
    hourStats.push({ hour: h, median_views: median(arr), sample: arr.length });
  }
  const bestHour = [...hourStats].filter((h) => h.sample > 0).sort((a, b) => b.median_views - a.median_views)[0] ?? null;
  const maxHourMed = hourStats.reduce((m, h) => Math.max(m, h.median_views), 0);

  // Recommended next publish datetime: lastPublished + cadenceDays, then snap to best DOW + best hour.
  let recommendedIso: string | null = null;
  if (lastPublished) {
    const days = cadenceDays(linkedPillar?.target_cadence);
    const base = new Date(lastPublished.getTime() + days * 86400000);
    let target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(),
                                    bestHour?.hour ?? base.getUTCHours(), 0, 0));
    if (bestDow) {
      // walk forward at most 6 days to hit bestDow.dow
      const currentDow = target.getUTCDay();
      const forward = (bestDow.dow - currentDow + 7) % 7;
      target = new Date(target.getTime() + forward * 86400000);
    }
    if (target.getTime() < Date.now()) target = new Date(Date.now() + 86400000);
    recommendedIso = target.toISOString();
  }

  // ---------- Group proposals by month ----------
  const proposalsByMonth = new Map<string, typeof proposals>();
  for (const p of proposals) {
    const m = String(p.scheduled_month).slice(0, 7);
    const arr = proposalsByMonth.get(m) ?? [];
    arr.push(p);
    proposalsByMonth.set(m, arr);
  }
  const monthOrder = Array.from(proposalsByMonth.keys()).sort();

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
            <Kpi label="Total views" value={fmtCompact(totalViews)} sub={`median ${fmtCompact(medianViews)}`} />
            <Kpi label="Total likes" value={fmtCompact(totalLikes)} />
            <Kpi label="Total comments" value={fmtCompact(totalComments)} />
            <Kpi label="Avg gap" value={avgGapDays != null ? `${avgGapDays.toFixed(0)}d` : '—'} sub={avgGapDays != null ? cadenceLabel(avgGapDays) : ''} />
            <Kpi label="Last published" value={daysSinceLast != null ? `${daysSinceLast}d ago` : '—'} sub={daysSinceLast != null && daysSinceLast > 60 ? 'STALE' : ''} />
          </div>
          {err && <div style={{ marginTop: 12, fontSize: 11, color: RED }}>Couldn&apos;t load items: {err}</div>}
        </div>

        {/* Scheduling & best-length intelligence */}
        <div style={cardStyle}>
          <div style={sectionH}>Scheduling intelligence · best length + best time</div>
          {videos.length === 0 ? (
            <div style={{ fontSize: 12, color: INK_M }}>No videos in this playlist yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {/* Best length */}
              <div>
                <div style={{ fontSize: 11, color: INK_S, marginBottom: 8, fontWeight: 500 }}>
                  Best-performing length: <span style={{ color: FOREST }}>{bestBucket?.bucket ?? '—'}</span>
                  {bestBucket && <span style={{ color: INK_M }}> ({fmtCompact(bestBucket.median_views)} median · {bestBucket.sample} sample)</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bucketStats.map((b) => {
                    const w = maxBucketMed > 0 ? (b.median_views / maxBucketMed) * 100 : 0;
                    return (
                      <div key={b.bucket} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 90px', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <div style={{ color: INK_S, fontVariantNumeric: 'tabular-nums' }}>{b.bucket}</div>
                        <div style={{ background: CREAM, borderRadius: 2, height: 8 }}>
                          <div style={{ width: `${w}%`, height: '100%', background: b === bestBucket ? FOREST : INK_M, borderRadius: 2 }} />
                        </div>
                        <div style={{ textAlign: 'right', color: INK_M, fontVariantNumeric: 'tabular-nums' }}>
                          {b.sample > 0 ? `${fmtCompact(b.median_views)} · n${b.sample}` : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Best day-of-week */}
              <div>
                <div style={{ fontSize: 11, color: INK_S, marginBottom: 8, fontWeight: 500 }}>
                  Best day-of-week: <span style={{ color: FOREST }}>{bestDow ? WEEKDAY_LABELS[bestDow.dow] : '—'}</span>
                  {bestDow && <span style={{ color: INK_M }}> ({fmtCompact(bestDow.median_views)} median · UTC)</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {dowStats.map((d) => {
                    const h = maxDowMed > 0 ? (d.median_views / maxDowMed) * 60 : 0;
                    const isBest = bestDow && d.dow === bestDow.dow;
                    return (
                      <div key={d.dow} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ height: 60, width: '100%', background: CREAM, borderRadius: 2, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                          <div style={{ width: '100%', height: `${h}%`, background: isBest ? FOREST : INK_M }} />
                        </div>
                        <div style={{ fontSize: 9, color: isBest ? FOREST : INK_M, fontWeight: isBest ? 600 : 400 }}>{WEEKDAY_LABELS[d.dow]}</div>
                        <div style={{ fontSize: 9, color: INK_M, fontVariantNumeric: 'tabular-nums' }}>{d.sample > 0 ? fmtCompact(d.median_views) : '—'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Best hour-of-day */}
              <div>
                <div style={{ fontSize: 11, color: INK_S, marginBottom: 8, fontWeight: 500 }}>
                  Best hour-of-day: <span style={{ color: FOREST }}>{bestHour ? `${String(bestHour.hour).padStart(2, '0')}:00 UTC` : '—'}</span>
                  {bestHour && <span style={{ color: INK_M }}> ({fmtCompact(bestHour.median_views)} median)</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2 }}>
                  {hourStats.map((h) => {
                    const pct = maxHourMed > 0 ? (h.median_views / maxHourMed) * 40 : 0;
                    const isBest = bestHour && h.hour === bestHour.hour;
                    return (
                      <div key={h.hour} style={{ height: 40, background: CREAM, borderRadius: 1, display: 'flex', alignItems: 'flex-end' }} title={`${String(h.hour).padStart(2, '0')}:00 UTC · median ${fmtCompact(h.median_views)} · n${h.sample}`}>
                        <div style={{ width: '100%', height: `${pct}%`, background: isBest ? FOREST : INK_M, borderRadius: 1 }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: INK_M }}>
                  <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
                </div>
              </div>

              {/* Recommended next publish */}
              <div>
                <div style={{ fontSize: 11, color: INK_S, marginBottom: 8, fontWeight: 500 }}>Recommended next publish</div>
                <div style={{ padding: 12, border: `1px solid ${HAIR}`, borderRadius: 3, background: CREAM }}>
                  {recommendedIso ? (
                    <>
                      <div style={{ fontSize: 15, color: INK, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {recommendedIso.slice(0, 10)} · {recommendedIso.slice(11, 16)} UTC
                      </div>
                      <div style={{ fontSize: 10, color: INK_M, marginTop: 4 }}>
                        {linkedPillar
                          ? `${linkedPillar.label} pillar · ${linkedPillar.target_cadence ?? 'monthly'} cadence`
                          : 'No linked pillar · monthly default'}
                        {bestDow ? ` · snapped to ${WEEKDAY_LABELS[bestDow.dow]}` : ''}
                        {bestHour ? ` at ${String(bestHour.hour).padStart(2, '0')}:00` : ''}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: INK_M }}>Need at least one published video to recommend.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 12-month title-proposal calendar */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={sectionH}>12-month title calendar · Lens</div>
              <div style={{ fontSize: 11, color: INK_M, marginTop: 4, maxWidth: 560 }}>
                Anthropic-generated. 3 title ideas per month for the next 12 months, guided by pillar cadence + best-length signal + brand vocabulary matrix. Queue any proposal into the video pipeline.
              </div>
            </div>
            <GenerateProposalsButton playlistId={playlistId} hasProposals={proposals.length > 0} />
          </div>

          {proposals.length === 0 ? (
            <div style={{ padding: 20, border: `1px dashed ${HAIR}`, borderRadius: 3, background: CREAM, fontSize: 12, color: INK_M, textAlign: 'center' }}>
              No proposals yet. Click <strong>Generate 12-month calendar</strong> above (30-60s).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {monthOrder.map((month) => {
                const rows = proposalsByMonth.get(month) ?? [];
                const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                return (
                  <div key={month}>
                    <div style={{ fontSize: 11, color: INK_S, marginBottom: 6, fontWeight: 500, letterSpacing: '.03em', textTransform: 'uppercase' }}>{monthLabel}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                      {rows.map((p) => (
                        <div key={p.id} style={{ padding: 12, border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <h3 style={{ fontSize: 13, margin: 0, fontWeight: 600, color: INK, lineHeight: 1.3 }}>{p.proposed_title}</h3>
                            <div style={{ fontSize: 9, color: INK_M, whiteSpace: 'nowrap', border: `1px solid ${HAIR}`, borderRadius: 2, padding: '1px 5px' }}>#{p.rank}</div>
                          </div>
                          {p.proposed_angle && (
                            <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.4 }}>{p.proposed_angle}</div>
                          )}
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            {p.proposed_length_bucket && (
                              <span style={{ fontSize: 9, color: INK_S, background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 2, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                                {p.proposed_length_bucket}
                              </span>
                            )}
                            {linkedPillar && (
                              <span style={{ fontSize: 9, color: INK_M }}>{linkedPillar.label}</span>
                            )}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <QueueProposalButton proposalId={p.id} status={p.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ranked videos */}
        <div style={cardStyle}>
          <div style={sectionH}>Videos · ranked by views</div>
          {sorted.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>{err ? '—' : 'No videos in this playlist.'}</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map((v, i) => {
                const perf = medianViews > 0 ? (v.views ?? 0) / medianViews : 0;
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
