// app/marketing/youtube/spy/page.tsx
// Spy agent MVP (yt-completion brief 2026-07-28, task #103 scope).
// Renders the latest weekly compset scan: roster, cadence, hot videos, format
// mix, keyword gaps, title patterns, engagement benchmark vs Namkhan, actions.
// Data lands weekly via pg_cron 'yt-spy-weekly' → /api/cron/yt_spy_weekly →
// youtube_spy_scan skill. Styling follows the module's established card
// conventions (see analytics/page.tsx).
import { DashboardPage } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import YtSubTabs from '../_shared/SubTabs';

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

interface WatchRow {
  id: number; competitor_name: string; niche: string | null;
  channel_handle: string | null; channel_id: string | null; reason: string | null;
}
interface SnapRow {
  watchlist_id: number; snapshot_date: string; subscriber_count: number | null;
  video_count: number | null; view_count: number | null;
  upload_count_last_30d: number | null; avg_views_last_30d: number | null;
  format_short_pct: number | null; top_video_ids: string[] | null;
}
interface HotRow {
  watchlist_id: number; video_id: string; title: string | null;
  thumbnail_url: string | null; duration_seconds: number | null;
  published_at: string | null; view_count: number | null; like_count: number | null;
  comment_count: number | null; channel_avg_views: number | null;
  outperformance_score: number | null; captured_at: string;
}
interface GapRow {
  report_id: string; generated_at_utc: string;
  our_theme_counts: Record<string, number>; compset_theme_counts: Record<string, number>;
  gaps: string[] | null; recommendations: string | null;
  competitors_scanned: number; our_videos_scanned: number;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
function fmtDur(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  return m >= 1 ? `${m}m${s % 60 ? ` ${s % 60}s` : ''}` : `${s}s`;
}
function titleWords(titles: string[]): Array<[string, number]> {
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for', 'with', 'at', 'on', 'is', 'how', 'what', 'why', 'this', 'that', 'you', 'your', 'my', 'our', 'de', 'la', '|', '-', '–']);
  const counts = new Map<string, number>();
  for (const t of titles) {
    for (const raw of t.toLowerCase().split(/[^a-z0-9']+/)) {
      if (raw.length < 4 || stop.has(raw)) continue;
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 14);
}

export default async function YtSpyPage() {
  const sb = getSupabaseAdmin();

  const [{ data: wlRaw }, { data: gapRaw }] = await Promise.all([
    sb.from('v_yt_content_watchlist')
      .select('id,competitor_name,niche,channel_handle,channel_id,reason')
      .eq('property_id', NAMKHAN).eq('active', true).order('id'),
    sb.from('v_yt_gap_reports')
      .select('*').eq('property_id', NAMKHAN)
      .order('generated_at_utc', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const watchlist = (wlRaw ?? []) as WatchRow[];
  const gap = (gapRaw as GapRow | null) ?? null;

  // Latest snapshot per watchlist row
  const { data: snapRaw } = await sb.from('v_yt_compset_snapshots')
    .select('watchlist_id,snapshot_date,subscriber_count,video_count,view_count,upload_count_last_30d,avg_views_last_30d,format_short_pct,top_video_ids')
    .eq('property_id', NAMKHAN)
    .order('snapshot_date', { ascending: false }).limit(200);
  const latestSnap = new Map<number, SnapRow>();
  for (const s of (snapRaw ?? []) as SnapRow[]) {
    if (!latestSnap.has(s.watchlist_id)) latestSnap.set(s.watchlist_id, s);
  }

  const { data: hotRaw } = await sb.from('v_yt_hot_videos')
    .select('watchlist_id,video_id,title,thumbnail_url,duration_seconds,published_at,view_count,like_count,comment_count,channel_avg_views,outperformance_score,captured_at')
    .eq('property_id', NAMKHAN)
    .order('captured_at', { ascending: false }).limit(60);
  const hot = ((hotRaw ?? []) as HotRow[]).slice(0, 24);

  const wlName = (id: number) => watchlist.find((w) => w.id === id)?.competitor_name ?? `#${id}`;

  const tabs = MARKETING_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));
  const cardStyle: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20, gridColumn: '1 / -1' };
  const sectionH: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, padding: '6px 10px', borderBottom: `1px solid ${HAIR}`, fontWeight: 500 };
  const td: React.CSSProperties = { fontSize: 12, color: INK_S, padding: '7px 10px', borderBottom: `1px solid ${HAIR}` };

  const scanned = [...latestSnap.values()];
  const noData = scanned.length === 0;

  // Engagement benchmark: Namkhan side comes from the gap report's own-channel scan
  const ourVideos = gap?.our_videos_scanned ?? 0;
  const compAvgViews = scanned.length
    ? Math.round(scanned.reduce((a, s) => a + (s.avg_views_last_30d ?? 0), 0) / scanned.length)
    : null;
  const compAvgCadence = scanned.length
    ? Math.round((scanned.reduce((a, s) => a + (s.upload_count_last_30d ?? 0), 0) / scanned.length) * 10) / 10
    : null;

  const hotTitles = hot.map((h) => h.title ?? '').filter(Boolean);
  const patterns = titleWords(hotTitles);

  return (
    <DashboardPage title="YouTube · channel management" tabs={tabs}>
      <div style={{ display: 'grid', gap: 16 }}>
        <YtSubTabs current="spy" />

        {/* Header */}
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 600, color: INK, marginBottom: 4 }}>Spy · Compset Watch</div>
          <div style={{ fontSize: 12, color: INK_M, maxWidth: 680 }}>
            Weekly scan of the content watchlist: who uploads what, what outperforms, and which themes the compset
            covers that the Namkhan channel does not. Fed by the yt-spy-weekly cron.
          </div>
          {gap && (
            <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
              Last scan: {new Date(gap.generated_at_utc).toISOString().slice(0, 16).replace('T', ' ')} UTC
              · {gap.competitors_scanned} channels · {ourVideos} own videos compared
            </div>
          )}
        </div>

        {noData && (
          <div style={{ ...cardStyle, background: CREAM }}>
            <div style={{ fontSize: 13, color: INK_S }}>
              No compset scan yet. The weekly cron (Mondays) runs the first scan automatically — results land here.
            </div>
          </div>
        )}

        {/* 1 · Competitor roster */}
        <div style={cardStyle}>
          <div style={sectionH}>1 · Competitor roster ({watchlist.length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Channel</th><th style={th}>Niche</th><th style={th}>Why watched</th>
              <th style={th}>Subs</th><th style={th}>Videos</th><th style={th}>Total views</th>
            </tr></thead>
            <tbody>
              {watchlist.map((w) => {
                const s = latestSnap.get(w.id);
                return (
                  <tr key={w.id}>
                    <td style={{ ...td, fontWeight: 500, color: INK }}>{w.competitor_name}<span style={{ color: INK_M, fontWeight: 400 }}>{w.channel_handle ? ` · ${w.channel_handle}` : ''}</span></td>
                    <td style={td}>{w.niche ?? '—'}</td>
                    <td style={td}>{w.reason ?? '—'}</td>
                    <td style={td}>{fmt(s?.subscriber_count)}</td>
                    <td style={td}>{fmt(s?.video_count)}</td>
                    <td style={td}>{fmt(s?.view_count)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 2 · Upload cadence */}
        <div style={cardStyle}>
          <div style={sectionH}>2 · Upload cadence (last 30 days)</div>
          {noData ? <div style={{ fontSize: 12, color: INK_M }}>Awaiting first scan.</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
              {watchlist.map((w) => {
                const s = latestSnap.get(w.id);
                if (!s) return null;
                const n = s.upload_count_last_30d ?? 0;
                return (
                  <div key={w.id} style={{ border: `1px solid ${HAIR}`, borderRadius: 4, padding: 12 }}>
                    <div style={{ fontSize: 11, color: INK_M, marginBottom: 4 }}>{w.competitor_name}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: n >= 4 ? FOREST : n >= 1 ? AMBER : INK_M, lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 4 }}>uploads / 30d · avg {fmt(s.avg_views_last_30d)} views</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3 · Hot videos */}
        <div style={cardStyle}>
          <div style={sectionH}>3 · Hot videos (outperforming their own channel)</div>
          {hot.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>None captured yet.</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {hot.map((h) => (
                <a key={`${h.video_id}-${h.captured_at}`} href={`https://youtube.com/watch?v=${h.video_id}`} target="_blank" rel="noreferrer noopener"
                   style={{ border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden', textDecoration: 'none', display: 'block' }}>
                  {h.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.thumbnail_url} alt="" style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }} />
                  )}
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: INK, lineHeight: 1.35 }}>{h.title ?? h.video_id}</div>
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 6 }}>
                      {wlName(h.watchlist_id)} · {fmt(h.view_count)} views · {fmtDur(h.duration_seconds)}
                      {h.outperformance_score != null && <span style={{ color: FOREST, fontWeight: 600 }}> · {h.outperformance_score}× channel norm</span>}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* 4 · Format / duration mix */}
        <div style={cardStyle}>
          <div style={sectionH}>4 · Format mix (shorts ≤3min vs long-form)</div>
          {noData ? <div style={{ fontSize: 12, color: INK_M }}>Awaiting first scan.</div> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {watchlist.map((w) => {
                const s = latestSnap.get(w.id);
                if (!s || s.format_short_pct == null) return null;
                const pct = Number(s.format_short_pct);
                return (
                  <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 70px', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: INK_S }}>{w.competitor_name}</div>
                    <div style={{ height: 10, background: CREAM, borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: FOREST }} />
                    </div>
                    <div style={{ fontSize: 11, color: INK_M }}>{pct.toFixed(0)}% shorts</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5 · Keyword / theme gaps */}
        <div style={cardStyle}>
          <div style={sectionH}>5 · Theme gaps (compset covers · we don&apos;t)</div>
          {!gap ? <div style={{ fontSize: 12, color: INK_M }}>Awaiting first scan.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Theme</th><th style={th}>Compset videos</th><th style={th}>Our videos</th><th style={th}>Verdict</th></tr></thead>
              <tbody>
                {Object.entries(gap.compset_theme_counts ?? {}).sort((a, b) => b[1] - a[1]).map(([k, c]) => {
                  const ours = gap.our_theme_counts?.[k] ?? 0;
                  const isGap = (gap.gaps ?? []).includes(k);
                  return (
                    <tr key={k}>
                      <td style={{ ...td, fontWeight: 500, color: INK }}>{k.replace(/_/g, ' ')}</td>
                      <td style={td}>{c}</td>
                      <td style={td}>{ours}</td>
                      <td style={{ ...td, color: isGap ? RED : FOREST, fontWeight: 600 }}>{isGap ? 'GAP' : 'covered'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 6 · Thumbnail / title patterns */}
        <div style={cardStyle}>
          <div style={sectionH}>6 · Title patterns in hot videos</div>
          {patterns.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>Not enough hot videos captured yet.</div> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {patterns.map(([w, c]) => (
                <span key={w} style={{ fontSize: 12, color: INK_S, background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 12, padding: '4px 12px' }}>
                  {w} <span style={{ color: FOREST, fontWeight: 600 }}>×{c}</span>
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: INK_M, marginTop: 10 }}>
            Thumbnails are visible per hot video in section 3 — recurring words above are what the compset&apos;s
            outperformers put in titles.
          </div>
        </div>

        {/* 7 · Engagement benchmark vs Namkhan */}
        <div style={cardStyle}>
          <div style={sectionH}>7 · Benchmark vs Namkhan</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            <div style={{ border: `1px solid ${HAIR}`, borderRadius: 4, padding: 12 }}>
              <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em' }}>Compset avg views / video (30d)</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: INK, marginTop: 4 }}>{fmt(compAvgViews)}</div>
            </div>
            <div style={{ border: `1px solid ${HAIR}`, borderRadius: 4, padding: 12 }}>
              <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em' }}>Compset avg uploads / 30d</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: INK, marginTop: 4 }}>{compAvgCadence ?? '—'}</div>
            </div>
            <div style={{ border: `1px solid ${HAIR}`, borderRadius: 4, padding: 12 }}>
              <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em' }}>Namkhan videos in comparison</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: INK, marginTop: 4 }}>{ourVideos || '—'}</div>
            </div>
            <div style={{ border: `1px solid ${HAIR}`, borderRadius: 4, padding: 12 }}>
              <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em' }}>Channels scanned</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: INK, marginTop: 4 }}>{gap?.competitors_scanned ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* 8 · Recommended actions */}
        <div style={{ ...cardStyle, background: CREAM }}>
          <div style={sectionH}>8 · Recommended actions</div>
          <div style={{ fontSize: 13, color: INK_S, lineHeight: 1.6, maxWidth: 760 }}>
            {gap?.recommendations ?? 'Recommendations are generated with each weekly scan.'}
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
