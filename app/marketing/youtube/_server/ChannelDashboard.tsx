// app/marketing/youtube/_server/ChannelDashboard.tsx
// PBS 2026-07-11 pm — Real YouTube dashboard block, server-rendered.
// v2: failure isolation. Channel + videos + comments each render independently.
//   - token fetch fail          → full-width red "Session expired · Reconnect" card
//   - channel fetch fail (any)  → full-width red "Channel fetch failed · Reconnect" card
//   - videos fetch fail         → inline red note above the videos grid, channel + comments still render
//   - comments fetch 403        → tiny amber banner "requires youtube.force-ssl · Reconnect"
//   - comments fetch other fail → tiny amber banner with the error text
//
// PBS 2026-07-11 evening — switched from `!x.ok` narrowing to `isErr(x)` type
//   predicate so TS reliably narrows YtResult<T> to ErrShape. Fixes CI TS2339.
//
// PBS 2026-07-13 — YouTube-pro-style analytics containers inserted between
//   AnalyticsKPIs and the Recent Uploads grid. Five expandable cards:
//     1. Last 24 hrs uploads (with delta framing)
//     2. Most viewed all-time  (top 10 → top 25 on expand)
//     3. Least viewed / needs love  (bottom 10 → bottom 25 on expand)
//     4. Best publish-day heatmap  (7-cell strip, expand for table)
//     5. Best publish-hour heatmap (8-bucket strip, expand for table)
//   All aggregation is server-side over `videos` (bumped to max=200). No
//   function props cross the RSC boundary — ExpandableSection only toggles
//   show/hide state.

import Link from 'next/link';
import { getFreshAccessToken } from '@/lib/youtube/token';
import {
  fetchChannel, fetchRecentVideos, fetchRecentComments, isErr,
  type VideoItem, type CommentItem,
} from '@/lib/youtube/data';
import CommentReplyForm from '../_client/CommentReplyForm';
import DashboardActions from '../_client/DashboardActions';
import ExpandableSection from '../_client/ExpandableSection';
import AnalyticsKPIs from './AnalyticsKPIs';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_S  = '#3A3A3A';
const FOREST = '#084838';
const RED    = '#B03826';
const AMBER  = '#B48A3A';
const CREAM  = '#F5F0E1';

const CARD: React.CSSProperties = {
  background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20,
};
const SECTION_H: React.CSSProperties = {
  fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M,
  marginBottom: 12, fontWeight: 500,
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

function timeAgo(iso: string): string {
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

function fmtDuration(iso: string): string {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '');
  if (!m) return '';
  const h = Number(m[1] ?? 0);
  const mi = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  if (h > 0) return `${h}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${mi}:${String(s).padStart(2, '0')}`;
}

function bestThumb(t: VideoItem['thumbnails'] | undefined): string | null {
  return t?.maxres?.url ?? t?.standard?.url ?? t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

// Deep-forest intensity for heatmap cells. `t` in [0,1].
function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // Fade from cream (t=0) to forest (t=1)
  const startR = 245, startG = 240, startB = 225;   // #F5F0E1
  const endR   = 8,   endG   = 72,  endB   = 56;    // #084838
  const r = Math.round(startR + (endR - startR) * clamped);
  const g = Math.round(startG + (endG - startG) * clamped);
  const b = Math.round(startB + (endB - startB) * clamped);
  return `rgb(${r},${g},${b})`;
}
function heatTextColor(t: number): string {
  return t > 0.55 ? WHITE : INK;
}
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function ReconnectCard({ propertyId, title, reason }: { propertyId: number; title: string; reason: string }) {
  return (
    <div style={{ ...CARD, gridColumn: '1 / -1', background: '#FBE7E4', borderColor: RED }}>
      <div style={{ fontSize: 13, color: RED, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: INK_S, marginBottom: 12 }}>{reason}</div>
      <Link
        href={`/api/marketing/youtube/oauth-start?property_id=${propertyId}`}
        style={{
          display: 'inline-block', padding: '8px 14px', border: `1px solid ${FOREST}`,
          borderRadius: 3, background: FOREST, color: WHITE, fontSize: 12,
          letterSpacing: '.04em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500,
        }}>
        Reconnect YouTube
      </Link>
    </div>
  );
}

function CommentsAmberBanner({ propertyId, kind, detail }: { propertyId: number; kind: 'scope' | 'other'; detail?: string }) {
  return (
    <div style={{
      marginTop: 10, padding: '8px 12px', background: '#FDF7E6',
      border: `1px solid ${AMBER}`, borderRadius: 3, fontSize: 11, color: INK_S,
      display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <span style={{ color: AMBER, fontWeight: 600 }}>Comments unavailable</span>
      <span style={{ flex: 1 }}>
        {kind === 'scope'
          ? 'Reading + replying to comments requires the youtube.force-ssl scope. Disconnect & Reconnect to grant it.'
          : (detail ?? 'Could not load comments.')}
      </span>
      <Link href={`/api/marketing/youtube/oauth-start?property_id=${propertyId}`}
        style={{ color: FOREST, textDecoration: 'none', fontWeight: 500 }}>
        Reconnect →
      </Link>
    </div>
  );
}

// ── Row primitive shared by sections 1/2/3 ────────────────────────────────
function VideoRow({
  rank, v, extra,
}: { rank: number; v: VideoItem; extra?: React.ReactNode }) {
  const thumb = bestThumb(v.thumbnails);
  const dur = fmtDuration(v.duration);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px 96px 1fr auto',
      gap: 12, alignItems: 'center',
      padding: '10px 0', borderTop: `1px solid ${HAIR}`,
    }}>
      <div style={{ fontSize: 11, color: INK_M, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {rank}
      </div>
      <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer noopener"
         style={{ position: 'relative', display: 'block', aspectRatio: '16 / 9', background: CREAM, borderRadius: 2, overflow: 'hidden' }}>
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={v.title}
               style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {dur && (
          <span style={{
            position: 'absolute', bottom: 3, right: 3,
            background: 'rgba(0,0,0,.82)', color: WHITE,
            fontSize: 9, padding: '1px 4px', borderRadius: 2, fontWeight: 500,
          }}>{dur}</span>
        )}
      </a>
      <div style={{ minWidth: 0 }}>
        <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer noopener"
           style={{
             display: 'block', fontSize: 13, color: INK, fontWeight: 500,
             textDecoration: 'none', lineHeight: 1.3,
             overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
           }}>
          {v.title}
        </a>
        <div style={{ fontSize: 11, color: INK_M, marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>{fmtCompact(v.views)} views</span>
          <span>{fmt(v.likes)} likes</span>
          <span>{fmt(v.comments)} comments</span>
          <span>{fmtDate(v.publishedAt)}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: INK_M, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {extra}
      </div>
    </div>
  );
}

// ── Heatmap primitives ────────────────────────────────────────────────────
function HeatCell({ label, sublabel, value, intensity, wide }: {
  label: string; sublabel?: string; value: string; intensity: number; wide?: boolean;
}) {
  return (
    <div style={{
      background: heatColor(intensity),
      color: heatTextColor(intensity),
      border: `1px solid ${HAIR}`,
      borderRadius: 3,
      padding: wide ? '14px 10px' : '12px 6px',
      textAlign: 'center',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: 9, opacity: .75, marginTop: 2 }}>{sublabel}</div>
      )}
      <div style={{ fontSize: 18, fontWeight: 500, marginTop: 6, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

function HeatDetailTable({ rows }: {
  rows: Array<{ label: string; median: number; count: number; total: number }>;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 100px 80px 120px',
        gap: 8, fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.04em',
        padding: '6px 0', borderBottom: `1px solid ${HAIR}`, fontWeight: 500,
      }}>
        <div>Bucket</div>
        <div style={{ textAlign: 'right' }}>Median views</div>
        <div style={{ textAlign: 'right' }}>Videos</div>
        <div style={{ textAlign: 'right' }}>Total views</div>
      </div>
      {rows.map((r) => (
        <div key={r.label} style={{
          display: 'grid', gridTemplateColumns: '1fr 100px 80px 120px',
          gap: 8, fontSize: 12, color: INK, padding: '6px 0', borderBottom: `1px solid ${HAIR}`,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <div>{r.label}</div>
          <div style={{ textAlign: 'right' }}>{fmt(r.median)}</div>
          <div style={{ textAlign: 'right', color: INK_M }}>{r.count}</div>
          <div style={{ textAlign: 'right', color: INK_M }}>{fmt(r.total)}</div>
        </div>
      ))}
    </div>
  );
}

export default async function ChannelDashboard({ propertyId }: { propertyId: number }) {
  // 1) Token: if we can't even get an access token, we cannot render anything useful.
  const tok = await getFreshAccessToken(propertyId);
  if (!tok.ok || !tok.access_token || !tok.channel_id) {
    return (
      <ReconnectCard
        propertyId={propertyId}
        title="YouTube session expired"
        reason={`Google refused the refresh token (${tok.error ?? 'unknown'}). Reconnect to restore the dashboard.`}
      />
    );
  }

  // 2) Fetch identity + videos (deep · up to 200 for aggregates) + comments in parallel.
  const [chRes, vidRes, comRes] = await Promise.all([
    fetchChannel(tok.access_token, tok.channel_id),
    fetchRecentVideos(tok.access_token, tok.channel_id, 200),
    fetchRecentComments(tok.access_token, tok.channel_id, 20),
  ]);

  if (isErr(chRes)) {
    const detail = chRes.detail ? ` · ${chRes.detail.slice(0, 200)}` : '';
    return (
      <ReconnectCard
        propertyId={propertyId}
        title="Channel fetch failed"
        reason={`Google Data API returned ${chRes.error}${detail}. If this persists, reconnect YouTube to refresh scopes.`}
      />
    );
  }

  const ch = chRes.data;
  const videos: VideoItem[] = isErr(vidRes) ? [] : vidRes.data;
  const comments: CommentItem[] = isErr(comRes) ? [] : comRes.data;
  const vidError = isErr(vidRes) ? `${vidRes.error}${vidRes.detail ? ` · ${vidRes.detail.slice(0, 160)}` : ''}` : null;
  const commentsScopeMissing = isErr(comRes) && (comRes.error === 'youtube_api_403' || comRes.error === 'youtube_api_401');
  const commentsOtherError = isErr(comRes) && !commentsScopeMissing
    ? `${comRes.error}${comRes.detail ? ` · ${comRes.detail.slice(0, 160)}` : ''}`
    : null;

  const avatar = ch.thumbnails.high?.url ?? ch.thumbnails.medium?.url ?? ch.thumbnails.default?.url ?? null;
  const vidTitle = new Map(videos.map((v) => [v.id, v.title]));

  // ── Aggregations (server-side, pre-formatted for RSC boundary) ──────────
  const now = Date.now();

  // 1) Last 24 hrs uploads
  const last24 = videos.filter((v) => {
    const t = new Date(v.publishedAt).getTime();
    return t && (now - t) <= 24 * 3600 * 1000;
  });
  const daysSinceLastUpload = (() => {
    const times = videos
      .map((v) => new Date(v.publishedAt).getTime())
      .filter((t) => !isNaN(t) && t > 0);
    if (times.length === 0) return null;
    const latest = Math.max(...times);
    return Math.floor((now - latest) / (24 * 3600 * 1000));
  })();

  // 2) Most viewed all-time
  const mostViewed = [...videos].sort((a, b) => b.views - a.views).slice(0, 25);

  // 3) Least viewed / needs love
  const leastViewed = [...videos]
    .filter((v) => v.views > 0)  // drop private/removed placeholders
    .sort((a, b) => a.views - b.views)
    .slice(0, 25);

  // 4) Best publish-day heatmap (median views per weekday)
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const byDay: number[][] = Array.from({ length: 7 }, () => []);
  for (const v of videos) {
    const d = new Date(v.publishedAt);
    if (!isNaN(d.getTime())) byDay[d.getUTCDay()].push(v.views);
  }
  const dayStats = DAY_LABELS.map((lbl, i) => ({
    label: lbl,
    full:  DAY_FULL[i],
    count: byDay[i].length,
    total: byDay[i].reduce((s, x) => s + x, 0),
    median: median(byDay[i]),
  }));
  const dayMaxMedian = Math.max(1, ...dayStats.map((s) => s.median));

  // 5) Best publish-hour heatmap (median views per 3-hour bucket, UTC)
  const HOUR_BUCKETS = [
    { label: '00–03', from: 0,  to: 3  },
    { label: '03–06', from: 3,  to: 6  },
    { label: '06–09', from: 6,  to: 9  },
    { label: '09–12', from: 9,  to: 12 },
    { label: '12–15', from: 12, to: 15 },
    { label: '15–18', from: 15, to: 18 },
    { label: '18–21', from: 18, to: 21 },
    { label: '21–24', from: 21, to: 24 },
  ];
  const byHour: number[][] = Array.from({ length: HOUR_BUCKETS.length }, () => []);
  for (const v of videos) {
    const d = new Date(v.publishedAt);
    if (isNaN(d.getTime())) continue;
    const h = d.getUTCHours();
    const idx = HOUR_BUCKETS.findIndex((b) => h >= b.from && h < b.to);
    if (idx >= 0) byHour[idx].push(v.views);
  }
  const hourStats = HOUR_BUCKETS.map((b, i) => ({
    label: b.label,
    full:  `${b.label} UTC`,
    count: byHour[i].length,
    total: byHour[i].reduce((s, x) => s + x, 0),
    median: median(byHour[i]),
  }));
  const hourMaxMedian = Math.max(1, ...hourStats.map((s) => s.median));

  const empty = (
    <div style={{ fontSize: 12, color: INK_M, padding: '12px 0' }}>
      No videos found — the aggregate sections need at least one upload with statistics.
    </div>
  );

  return (
    <>
      {/* ── A · CHANNEL IDENTITY STRIP (always renders when we have channel data) */}
      <div style={{ ...CARD, gridColumn: '1 / -1' }}>
        <div style={SECTION_H}>My YouTube channel · live from Data API v3</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 24,
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={ch.title} width={72} height={72}
                style={{ borderRadius: '50%', border: `1px solid ${HAIR}`, background: CREAM }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: CREAM, border: `1px solid ${HAIR}` }} />
            )}
            <div>
              <div style={{ fontSize: 20, color: INK, fontWeight: 500 }}>{ch.title}</div>
              <div style={{ fontSize: 12, color: INK_M, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {ch.customUrl ?? ch.id}
              </div>
              <div style={{ fontSize: 11, color: INK_M, marginTop: 4 }}>
                Since {ch.publishedAt ? new Date(ch.publishedAt).toISOString().slice(0, 10) : '—'}
                {ch.country ? ` · ${ch.country}` : ''}
                {tok.token_expires_at ? ` · token exp ${new Date(tok.token_expires_at).toISOString().slice(11, 16)} UTC` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, justifyItems: 'center' }}>
            <Stat label="Subscribers" value={fmt(ch.subscriberCount)} />
            <Stat label="Total views" value={fmt(ch.viewCount)} />
            <Stat label="Videos" value={fmt(ch.videoCount)} />
          </div>

          <DashboardActions propertyId={propertyId} />
        </div>

        {ch.description && (
          <div style={{ marginTop: 14, fontSize: 12, color: INK_M, lineHeight: 1.5, maxHeight: 60, overflow: 'hidden' }}>
            {ch.description.slice(0, 300)}{ch.description.length > 300 ? '…' : ''}
          </div>
        )}
      </div>

      {/* ── B · ANALYTICS KPIs + CHARTS (Watch Time · Subs · Traffic · Devices · Geo) */}
      <AnalyticsKPIs
        accessToken={tok.access_token}
        channelId={tok.channel_id}
        totalSubscribers={ch.subscriberCount}
        totalViews={ch.viewCount}
        totalVideos={ch.videoCount}
      />

      {/* ── B2 · YOUTUBE-PRO REVIEW STRIP (5 expandable containers) */}

      {/* 1 · Last 24 hrs */}
      <ExpandableSection
        title="Last 24 hrs"
        subtitle={
          last24.length === 0 && daysSinceLastUpload !== null
            ? `No new uploads · last published ${daysSinceLastUpload} day${daysSinceLastUpload === 1 ? '' : 's'} ago`
            : `${last24.length} upload${last24.length === 1 ? '' : 's'} in the last 24 hours`
        }
        count={last24.length}
        initialRows={5}
        emptyState={
          <div style={{ fontSize: 12, color: INK_M, padding: '8px 0' }}>
            {daysSinceLastUpload !== null
              ? `No uploads in the last 24 hrs. Last upload was ${daysSinceLastUpload} day${daysSinceLastUpload === 1 ? '' : 's'} ago.`
              : 'No uploads on this channel yet.'}
          </div>
        }
        rows={last24.map((v, i) => (
          <VideoRow
            key={v.id}
            rank={i + 1}
            v={v}
            extra={
              <>
                <span style={{ color: FOREST, fontWeight: 500 }}>{timeAgo(v.publishedAt)}</span>
                <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>fresh</div>
              </>
            }
          />
        ))}
      />

      {/* 2 · Most viewed all-time */}
      <ExpandableSection
        title="Most viewed all-time"
        subtitle="Sorted by lifetime views across your last 200 uploads"
        count={mostViewed.length}
        initialRows={10}
        expandLabel={`Show top ${Math.min(25, mostViewed.length)}`}
        emptyState={empty}
        rows={mostViewed.map((v, i) => (
          <VideoRow
            key={v.id}
            rank={i + 1}
            v={v}
            extra={
              <>
                <span style={{ color: INK, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCompact(v.views)}
                </span>
                <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>total views</div>
              </>
            }
          />
        ))}
      />

      {/* 3 · Least viewed / needs love */}
      <ExpandableSection
        title="Least viewed · needs love"
        subtitle="Bottom performers by lifetime views. Candidates for a re-cut, new thumbnail or title A/B."
        count={leastViewed.length}
        initialRows={10}
        expandLabel={`Show bottom ${Math.min(25, leastViewed.length)}`}
        emptyState={empty}
        rows={leastViewed.map((v, i) => (
          <VideoRow
            key={v.id}
            rank={i + 1}
            v={v}
            extra={
              <>
                <span style={{ color: INK, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCompact(v.views)}
                </span>
                <Link
                  href={`/marketing/youtube/production?ref=${encodeURIComponent(v.id)}`}
                  style={{
                    display: 'block', marginTop: 2, fontSize: 10, color: FOREST,
                    textDecoration: 'none', fontWeight: 500,
                  }}>
                  → Suggest re-cut
                </Link>
              </>
            }
          />
        ))}
      />

      {/* 4 · Best publish-day heatmap */}
      <ExpandableSection
        title="Best publish day"
        subtitle="Median views per weekday · deeper green = higher median (all times UTC)"
        collapsedChildren={
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {dayStats.map((s) => (
              <HeatCell
                key={s.label}
                label={s.label}
                sublabel={`${s.count} video${s.count === 1 ? '' : 's'}`}
                value={fmtCompact(s.median)}
                intensity={s.median / dayMaxMedian}
                wide
              />
            ))}
          </div>
        }
        expandedChildren={
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {dayStats.map((s) => (
                <HeatCell
                  key={s.label}
                  label={s.label}
                  sublabel={`${s.count} video${s.count === 1 ? '' : 's'}`}
                  value={fmtCompact(s.median)}
                  intensity={s.median / dayMaxMedian}
                  wide
                />
              ))}
            </div>
            <HeatDetailTable rows={dayStats.map((s) => ({
              label: s.full, median: s.median, count: s.count, total: s.total,
            }))} />
          </>
        }
      />

      {/* 5 · Best publish-hour heatmap */}
      <ExpandableSection
        title="Best publish hour"
        subtitle="Median views per 3-hour bucket · deeper green = higher median (all times UTC)"
        collapsedChildren={
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
            {hourStats.map((s) => (
              <HeatCell
                key={s.label}
                label={s.label}
                sublabel={`${s.count} video${s.count === 1 ? '' : 's'}`}
                value={fmtCompact(s.median)}
                intensity={s.median / hourMaxMedian}
              />
            ))}
          </div>
        }
        expandedChildren={
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
              {hourStats.map((s) => (
                <HeatCell
                  key={s.label}
                  label={s.label}
                  sublabel={`${s.count} video${s.count === 1 ? '' : 's'}`}
                  value={fmtCompact(s.median)}
                  intensity={s.median / hourMaxMedian}
                />
              ))}
            </div>
            <HeatDetailTable rows={hourStats.map((s) => ({
              label: s.full, median: s.median, count: s.count, total: s.total,
            }))} />
          </>
        }
      />

      {/* ── C · RECENT UPLOADS (renders independently) */}
      <div style={{ ...CARD, gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ ...SECTION_H, marginBottom: 0 }}>Recent uploads ({videos.length})</div>
          {vidError && (
            <div style={{ fontSize: 11, color: RED }}>
              Couldn&apos;t load videos: {vidError}
            </div>
          )}
        </div>

        {videos.length === 0 && !vidError ? (
          <div style={{ fontSize: 13, color: INK_M }}>
            No videos on this channel yet.
          </div>
        ) : videos.length === 0 && vidError ? (
          <div style={{ fontSize: 12, color: INK_M }}>
            Videos section will render once the fetch succeeds. Channel + comments below still work.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {videos.slice(0, 24).map((v) => {
              const thumb = bestThumb(v.thumbnails);
              const dur = fmtDuration(v.duration);
              return (
                <a
                  key={v.id}
                  href={`https://youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{
                    display: 'block', background: WHITE, border: `1px solid ${HAIR}`,
                    borderRadius: 4, textDecoration: 'none', color: INK, overflow: 'hidden',
                  }}>
                  <div style={{ position: 'relative', aspectRatio: '16 / 9', background: CREAM }}>
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={v.title}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {dur && (
                      <span style={{
                        position: 'absolute', bottom: 6, right: 6,
                        background: 'rgba(0,0,0,.82)', color: WHITE,
                        fontSize: 11, padding: '2px 5px', borderRadius: 2, fontWeight: 500,
                      }}>{dur}</span>
                    )}
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{
                      fontSize: 13, color: INK, fontWeight: 500, lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden', minHeight: 36,
                    }}>{v.title}</div>
                    <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
                      {fmtCompact(v.views)} views · {timeAgo(v.publishedAt)}
                    </div>
                    <div style={{ fontSize: 11, color: INK_M, marginTop: 4, display: 'flex', gap: 12 }}>
                      <span>{fmt(v.likes)} likes</span>
                      <span>{fmt(v.comments)} comments</span>
                      <span style={{ marginLeft: 'auto', color: FOREST }}>Open ↗</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* ── C · RECENT COMMENTS (renders independently, 403 = tiny amber banner) */}
      <div style={{ ...CARD, gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ ...SECTION_H, marginBottom: 0 }}>Recent comments ({comments.length})</div>
        </div>

        {comments.length === 0 && !commentsScopeMissing && !commentsOtherError ? (
          <div style={{ fontSize: 13, color: INK_M }}>No comments yet.</div>
        ) : comments.length > 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {comments.map((c) => (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 12,
                paddingBottom: 12, borderBottom: `1px solid ${HAIR}`, alignItems: 'start',
              }}>
                {c.authorProfileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.authorProfileImageUrl} alt={c.authorDisplayName}
                    width={32} height={32}
                    style={{ borderRadius: '50%', background: CREAM }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: CREAM }} />
                )}
                <div>
                  <div style={{ fontSize: 12, color: INK_S }}>
                    <span style={{ fontWeight: 600, color: INK }}>{c.authorDisplayName}</span>
                    {c.videoId && (
                      <>
                        {' · on '}
                        <a href={`https://youtube.com/watch?v=${c.videoId}&lc=${c.id}`}
                          target="_blank" rel="noreferrer noopener"
                          style={{ color: FOREST, textDecoration: 'none' }}>
                          {vidTitle.get(c.videoId) ?? c.videoId}
                        </a>
                      </>
                    )}
                    <span style={{ color: INK_M }}> · {timeAgo(c.publishedAt)}</span>
                  </div>
                  <div style={{
                    fontSize: 13, color: INK, marginTop: 4, lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{c.textOriginal}</div>
                  <CommentReplyForm
                    parentCommentId={c.id}
                    videoId={c.videoId}
                    canReply={c.canReply}
                  />
                </div>
                <div style={{ fontSize: 11, color: INK_M, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {fmt(c.likeCount)} ♥
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {commentsScopeMissing && (
          <CommentsAmberBanner propertyId={propertyId} kind="scope" />
        )}
        {commentsOtherError && (
          <CommentsAmberBanner propertyId={propertyId} kind="other" detail={commentsOtherError} />
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, color: INK, fontWeight: 500, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
