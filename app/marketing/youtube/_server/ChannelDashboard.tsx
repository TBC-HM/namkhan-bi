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

import Link from 'next/link';
import { getFreshAccessToken } from '@/lib/youtube/token';
import {
  fetchChannel, fetchRecentVideos, fetchRecentComments, isErr,
  type VideoItem, type CommentItem,
} from '@/lib/youtube/data';
import CommentReplyForm from '../_client/CommentReplyForm';
import DashboardActions from '../_client/DashboardActions';
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

  // 2) Fetch identity + videos + comments in parallel — Playlists + Programs live on their own sub-pages now.
  const [chRes, vidRes, comRes] = await Promise.all([
    fetchChannel(tok.access_token),
    fetchRecentVideos(tok.access_token, tok.channel_id, 24),
    fetchRecentComments(tok.access_token, tok.channel_id, 20),
  ]);

  // 3) Channel identity is the anchor. If channel fetch failed, we still surface a
  //    clear reconnect card — but distinct from the token-level failure above.
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
        totalSubscribers={ch.subscriberCount}
        totalViews={ch.viewCount}
        totalVideos={ch.videoCount}
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
            {videos.map((v) => {
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
