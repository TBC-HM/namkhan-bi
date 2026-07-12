// app/marketing/youtube/planning/[pillar_key]/page.tsx
// PBS 2026-07-13 — Content program landing page. Shows target cadence vs actual,
// gap analysis, linked playlist videos, and a way to request a video for this pillar.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchPlaylistItemsWithStats, isErr } from '@/lib/youtube/data';
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

function fmtCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

const CADENCE_DAYS: Record<string, number> = {
  weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, ad_hoc: 60,
};

interface Params { params: { pillar_key: string } }

export default async function YtProgramDetailPage({ params }: Params) {
  const pillarKey = decodeURIComponent(params.pillar_key);
  const sb = getSupabaseAdmin();
  const { data: pillar } = await sb.from('v_yt_content_pillars')
    .select('id,pillar_key,label,description,target_cadence,youtube_playlist_id,notes')
    .eq('property_id', NAMKHAN).eq('pillar_key', pillarKey).eq('active', true).maybeSingle();
  if (!pillar) notFound();

  const tabs = MARKETING_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));
  const cardStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, gridColumn: '1 / -1' };
  const sectionH: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };

  const targetGap = CADENCE_DAYS[pillar.target_cadence ?? 'monthly'] ?? 30;

  // Fetch the linked playlist videos if playlist is set
  let videos: Awaited<ReturnType<typeof fetchPlaylistItemsWithStats>> | null = null;
  if (pillar.youtube_playlist_id) {
    const tok = await getFreshAccessToken(NAMKHAN);
    if (tok.ok && tok.access_token) {
      videos = await fetchPlaylistItemsWithStats(tok.access_token, pillar.youtube_playlist_id, 50);
    }
  }
  const vids = videos && !isErr(videos) ? videos.data : [];
  const dates = vids.map((v) => new Date(v.publishedAt).getTime()).filter((t) => !isNaN(t)).sort((a, b) => a - b);
  const lastPub = dates.length ? new Date(dates[dates.length - 1]) : null;
  const daysSinceLast = lastPub ? Math.floor((Date.now() - lastPub.getTime()) / 86400000) : null;
  let avgGap: number | null = null;
  if (dates.length > 1) {
    let gapSum = 0;
    for (let i = 1; i < dates.length; i++) gapSum += (dates[i] - dates[i - 1]) / 86400000;
    avgGap = gapSum / (dates.length - 1);
  }

  const status: { label: string; color: string; msg: string } =
    !pillar.youtube_playlist_id
      ? { label: 'No playlist linked', color: AMBER, msg: 'Link a YouTube playlist to this program in Settings to track cadence.' }
    : vids.length === 0
      ? { label: 'No videos yet', color: AMBER, msg: 'The linked playlist has no videos. Request one below to kick off the program.' }
    : daysSinceLast != null && daysSinceLast > targetGap * 2
      ? { label: 'Stale', color: RED, msg: `Last video ${daysSinceLast} days ago vs target ${targetGap} — request a new one.` }
    : daysSinceLast != null && daysSinceLast > targetGap
      ? { label: 'Overdue', color: AMBER, msg: `Last video ${daysSinceLast} days ago vs target ${targetGap} — next one due soon.` }
      : { label: 'On track', color: OK, msg: `Last video ${daysSinceLast}d ago · target every ${targetGap}d.` };

  const totalViews = vids.reduce((s, v) => s + (v.views ?? 0), 0);
  const totalLikes = vids.reduce((s, v) => s + (v.likes ?? 0), 0);
  const sorted = [...vids].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));

  return (
    <DashboardPage title="YouTube · channel management" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="planning" />
        <div style={{ gridColumn: '1 / -1' }}>
          <Link href="/marketing/youtube/planning" style={{ fontSize: 11, color: INK_M, textDecoration: 'none' }}>← All programs</Link>
        </div>

        {/* Program header */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: INK, marginBottom: 4 }}>{pillar.label}</div>
              {pillar.description && <div style={{ fontSize: 13, color: INK_M, maxWidth: 640, lineHeight: 1.5 }}>{pillar.description}</div>}
              {pillar.notes && <div style={{ fontSize: 12, color: INK_M, marginTop: 8, fontStyle: 'italic' }}>{pillar.notes}</div>}
            </div>
            <span style={{ padding: '4px 10px', background: CREAM, color: INK_S, textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 11, borderRadius: 3, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {pillar.target_cadence ?? 'ad hoc'}
            </span>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: status.color === OK ? '#E8F0EC' : status.color === AMBER ? '#FDF7E6' : '#FBE7E4', borderRadius: 3, borderLeft: `4px solid ${status.color}` }}>
            <div style={{ fontSize: 12, color: status.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{status.label}</div>
            <div style={{ fontSize: 12, color: INK_S, marginTop: 4 }}>{status.msg}</div>
          </div>

          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            <Kpi label="Videos" value={String(vids.length)} />
            <Kpi label="Total views" value={fmtCompact(totalViews)} />
            <Kpi label="Total likes" value={fmtCompact(totalLikes)} />
            <Kpi label="Target gap" value={`${targetGap}d`} sub={pillar.target_cadence ?? ''} />
            <Kpi label="Actual gap" value={avgGap != null ? `${avgGap.toFixed(0)}d` : '—'} sub={avgGap != null && avgGap > targetGap ? 'behind' : ''} />
            <Kpi label="Last video" value={daysSinceLast != null ? `${daysSinceLast}d ago` : '—'} sub={daysSinceLast != null && daysSinceLast > targetGap ? 'due' : ''} />
          </div>
        </div>

        {/* Videos ranked */}
        {vids.length > 0 && (
          <div style={cardStyle}>
            <div style={sectionH}>Videos in this program · ranked by views</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sorted.map((v, i) => {
                const thumb = v.thumbnails.medium?.url ?? v.thumbnails.high?.url ?? v.thumbnails.default?.url ?? null;
                return (
                  <div key={v.videoId} style={{ display: 'grid', gridTemplateColumns: 'auto 120px 1fr auto', gap: 12, padding: '8px', borderBottom: `1px solid ${HAIR}`, alignItems: 'center' }}>
                    <div style={{ fontSize: 16, color: INK_M, minWidth: 20, textAlign: 'right' }}>{i + 1}</div>
                    <div style={{ aspectRatio: '16 / 9', background: CREAM, borderRadius: 3, overflow: 'hidden' }}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : null}
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
                    <div />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ ...cardStyle, background: CREAM }}>
          <div style={sectionH}>Next up for this program</div>
          <div style={{ fontSize: 13, color: INK, marginBottom: 12 }}>
            {status.label === 'On track'
              ? `You're publishing on schedule. Queue the next ${pillar.label} idea when ready.`
              : `A new ${pillar.label} video is ${status.label.toLowerCase()}. Request one below.`}
          </div>
          <Link href={`/marketing/youtube/production?angle=${encodeURIComponent(pillar.label)}`} style={{ display: 'inline-block', padding: '8px 14px', background: FOREST, color: WHITE, textDecoration: 'none', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', borderRadius: 3 }}>
            Request a video →
          </Link>
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
      {sub && <div style={{ fontSize: 10, color: sub === 'due' || sub === 'behind' ? RED : INK_M, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
