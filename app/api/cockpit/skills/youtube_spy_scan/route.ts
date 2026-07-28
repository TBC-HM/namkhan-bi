// app/api/cockpit/skills/youtube_spy_scan/route.ts
// Spy agent MVP (yt-completion brief 2026-07-28, task #103 scope).
// Weekly compset scan over marketing.yt_content_watchlist (active rows for the
// property; the brief's "watchlist minus blacklist" — v_yt_competitors_blacklist
// is a plain projection of the same table, so active watchlist rows ARE the set).
// Uses the public Data API v3 with the vault API key (no OAuth needed):
//  1. Resolve channel_id per watchlist row (forHandle → search fallback),
//     persisted back to the watchlist (resolved_at stamped).
//  2. Per channel: stats snapshot + last-50 uploads → 30d cadence, format mix,
//     avg views → upsert marketing.yt_compset_snapshots (watchlist_id, date).
//  3. Hot videos: uploads outperforming the channel's own recent median 3x+
//     (or top-viewed when median is 0) → insert marketing.yt_hot_videos.
//  4. Gap report: keyword-bucket theme counts, compset vs our channel, +
//     programmatic recommendations → insert marketing.yt_gap_reports.
// Input : { property_id: number }
// Output: { ok, competitors_scanned, snapshots, hot_videos, gap_report_id }

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVaultSecret, ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const NAMKHAN_CHANNEL_ID = 'UCnOK4wDxsEs5VKXGH3EkOmw';

// Theme buckets — keyword heuristic shared by compset + own-channel counting.
const THEME_KEYWORDS: Record<string, string[]> = {
  meditation_wellness: ['meditation', 'mindful', 'breath', 'calm', 'wellness', 'yoga', 'spa', 'healing'],
  buddhist_culture:    ['buddhis', 'monk', 'temple', 'alms', 'wisdom', 'dharma', 'ritual'],
  food_dining:         ['food', 'dining', 'cuisine', 'chef', 'recipe', 'restaurant', 'taste', 'eat'],
  river_nature:        ['river', 'mekong', 'nam khan', 'jungle', 'nature', 'waterfall', 'garden', 'sunrise', 'sunset'],
  rooms_stay:          ['suite', 'room', 'villa', 'stay', 'resort', 'hotel', 'pool', 'lodge'],
  travel_guide:        ['guide', 'travel', 'trip', 'itinerary', 'things to do', 'tour', 'laos', 'luang prabang'],
  slow_ambience:       ['slow', 'ambience', 'ambient', 'relax', 'sleep', 'asmr', 'rain', 'sounds'],
  craft_artisan:       ['craft', 'artisan', 'weav', 'textile', 'pottery', 'silk', 'art '],
};

interface WatchRow {
  id: number;
  competitor_name: string;
  channel_id: string | null;
  channel_handle: string | null;
  niche: string | null;
}

interface ChannelListResp {
  items?: Array<{
    id: string;
    snippet?: { title?: string };
    statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}
interface PlaylistItemsResp {
  items?: Array<{ contentDetails?: { videoId?: string; videoPublishedAt?: string } }>;
}
interface VideoListResp {
  items?: Array<{
    id: string;
    snippet?: { title?: string; description?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string }; high?: { url?: string } } };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
    contentDetails?: { duration?: string };
  }>;
}

function iso8601DurationToSeconds(d: string | undefined): number | null {
  if (!d) return null;
  const m = d.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

function themeCounts(titles: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of Object.keys(THEME_KEYWORDS)) counts[key] = 0;
  for (const t of titles) {
    const lower = t.toLowerCase();
    for (const [key, words] of Object.entries(THEME_KEYWORDS)) {
      if (words.some((w) => lower.includes(w))) counts[key]++;
    }
  }
  return counts;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

interface ChannelScan {
  channel_id: string;
  subs: number | null;
  video_count: number | null;
  view_count: number | null;
  uploads_30d: number;
  avg_views_recent: number;
  short_pct: number | null;
  titles: string[];
  hot: Array<{
    video_id: string; title: string; description_snippet: string; thumbnail_url: string | null;
    duration_seconds: number | null; published_at: string | null;
    view_count: number; like_count: number; comment_count: number;
    channel_avg_views: number; outperformance_score: number;
  }>;
}

async function scanChannel(apiKey: string, channelId: string): Promise<ChannelScan | null> {
  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${apiKey}`,
    { cache: 'no-store' });
  if (!chRes.ok) return null;
  const ch = (await chRes.json().catch(() => null)) as ChannelListResp | null;
  const item = ch?.items?.[0];
  if (!item) return null;

  const uploadsPl = item.contentDetails?.relatedPlaylists?.uploads;
  let videoIds: string[] = [];
  if (uploadsPl) {
    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPl}&maxResults=50&key=${apiKey}`,
      { cache: 'no-store' });
    if (plRes.ok) {
      const pl = (await plRes.json().catch(() => null)) as PlaylistItemsResp | null;
      videoIds = (pl?.items ?? []).map((i) => i.contentDetails?.videoId ?? '').filter(Boolean).slice(0, 50);
    }
  }

  let vids: VideoListResp['items'] = [];
  if (videoIds.length > 0) {
    const vRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`,
      { cache: 'no-store' });
    if (vRes.ok) {
      const v = (await vRes.json().catch(() => null)) as VideoListResp | null;
      vids = v?.items ?? [];
    }
  }

  const now = Date.now();
  const cutoff30 = now - 30 * 24 * 60 * 60 * 1000;
  const views = (vids ?? []).map((v) => Number(v.statistics?.viewCount ?? 0));
  const med = median(views);
  const avg = views.length ? Math.round(views.reduce((a, b) => a + b, 0) / views.length) : 0;
  const durations = (vids ?? []).map((v) => iso8601DurationToSeconds(v.contentDetails?.duration)).filter((d): d is number => d != null);
  const shorts = durations.filter((d) => d <= 180).length;

  const hot = (vids ?? [])
    .map((v) => {
      const vc = Number(v.statistics?.viewCount ?? 0);
      const score = med > 0 ? vc / med : vc;
      return {
        video_id:            v.id,
        title:               v.snippet?.title ?? '',
        description_snippet: (v.snippet?.description ?? '').slice(0, 200),
        thumbnail_url:       v.snippet?.thumbnails?.high?.url ?? v.snippet?.thumbnails?.medium?.url ?? null,
        duration_seconds:    iso8601DurationToSeconds(v.contentDetails?.duration),
        published_at:        v.snippet?.publishedAt ?? null,
        view_count:          vc,
        like_count:          Number(v.statistics?.likeCount ?? 0),
        comment_count:       Number(v.statistics?.commentCount ?? 0),
        channel_avg_views:   avg,
        outperformance_score: Math.round(score * 100) / 100,
      };
    })
    .filter((h) => (med > 0 ? h.outperformance_score >= 3 : h.view_count > 0))
    .sort((a, b) => b.outperformance_score - a.outperformance_score)
    .slice(0, 5);

  return {
    channel_id:       item.id,
    subs:             item.statistics?.subscriberCount != null ? Number(item.statistics.subscriberCount) : null,
    video_count:      item.statistics?.videoCount != null ? Number(item.statistics.videoCount) : null,
    view_count:       item.statistics?.viewCount != null ? Number(item.statistics.viewCount) : null,
    uploads_30d:      (vids ?? []).filter((v) => v.snippet?.publishedAt && new Date(v.snippet.publishedAt).getTime() >= cutoff30).length,
    avg_views_recent: avg,
    short_pct:        durations.length ? Math.round((shorts / durations.length) * 1000) / 10 : null,
    titles:           (vids ?? []).map((v) => v.snippet?.title ?? '').filter(Boolean),
    hot,
  };
}

async function resolveChannelId(apiKey: string, row: WatchRow): Promise<string | null> {
  if (row.channel_id) return row.channel_id;
  if (row.channel_handle) {
    const handle = row.channel_handle.startsWith('@') ? row.channel_handle : `@${row.channel_handle}`;
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`,
      { cache: 'no-store' });
    if (r.ok) {
      const j = (await r.json().catch(() => null)) as ChannelListResp | null;
      const id = j?.items?.[0]?.id;
      if (id) return id;
    }
  }
  // Search fallback by name
  const s = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(row.competitor_name)}&key=${apiKey}`,
    { cache: 'no-store' });
  if (s.ok) {
    const j = (await s.json().catch(() => null)) as { items?: Array<{ snippet?: { channelId?: string } }> } | null;
    return j?.items?.[0]?.snippet?.channelId ?? null;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { property_id?: number };
    const property_id = Number(body.property_id);
    if (!Number.isFinite(property_id) || property_id <= 0) return err('property_id_required', 400);

    const apiKey = (await getVaultSecret('YOUTUBE_DATA_API_KEY'))
                ?? (await getVaultSecret('youtube_api_key'));
    if (!apiKey) return err('vault_key_missing_YOUTUBE_DATA_API_KEY');

    const sb = getSupabaseAdmin();
    const snapshot_date = new Date().toISOString().slice(0, 10);

    const { data: wlRaw, error: wlErr } = await sb
      .from('v_yt_content_watchlist')
      .select('id,competitor_name,channel_id,channel_handle,niche')
      .eq('property_id', property_id)
      .eq('active', true);
    if (wlErr) return err('watchlist_load_failed', 500, { detail: wlErr.message });
    const watchlist = (wlRaw ?? []) as WatchRow[];
    if (watchlist.length === 0) return ok({ competitors_scanned: 0, snapshots: 0, hot_videos: 0, note: 'watchlist empty' });

    let snapshots = 0;
    let hotInserted = 0;
    const compTitles: string[] = [];
    let scanned = 0;

    for (const row of watchlist) {
      const channelId = await resolveChannelId(apiKey, row);
      if (!channelId) continue;
      if (!row.channel_id) {
        await sb.from('v_yt_content_watchlist')
          .update({ channel_id: channelId, resolved_at: new Date().toISOString() })
          .eq('id', row.id);
      }

      const scan = await scanChannel(apiKey, channelId);
      if (!scan) continue;
      scanned++;
      compTitles.push(...scan.titles);

      const { error: snapErr } = await sb.from('v_yt_compset_snapshots').upsert({
        property_id,
        watchlist_id:        row.id,
        snapshot_date,
        subscriber_count:    scan.subs,
        video_count:         scan.video_count,
        view_count:          scan.view_count,
        upload_count_last_30d: scan.uploads_30d,
        avg_views_last_30d:  scan.avg_views_recent,
        format_short_pct:    scan.short_pct,
        top_video_ids:       scan.hot.map((h) => h.video_id),
        raw_snapshot:        { channel_id: channelId, titles: scan.titles.slice(0, 50) },
      }, { onConflict: 'watchlist_id,snapshot_date', ignoreDuplicates: false });
      if (!snapErr) snapshots++;

      for (const h of scan.hot) {
        const { error: hotErr } = await sb.from('v_yt_hot_videos').insert({
          property_id,
          watchlist_id: row.id,
          ...h,
        });
        if (!hotErr) hotInserted++;
      }
    }

    // Our channel — same scan, same theme buckets
    const ourScan = await scanChannel(apiKey, NAMKHAN_CHANNEL_ID);
    const ourCounts = themeCounts(ourScan?.titles ?? []);
    const compCounts = themeCounts(compTitles);

    const gaps: string[] = Object.entries(compCounts)
      .filter(([k, c]) => c >= 3 && (ourCounts[k] ?? 0) === 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);

    const recommendations = gaps.length
      ? `Compset is active in ${gaps.length} theme(s) where the Namkhan channel has no recent coverage: `
        + gaps.map((g) => g.replace(/_/g, ' ')).join(', ')
        + '. Recommended: brief one video per gap theme through the planning pipeline, starting with the highest-count gap. '
        + 'Hot-video patterns worth studying are stored in yt_hot_videos (this batch).'
      : 'No uncovered compset theme this week — maintain cadence on existing pillars and review hot videos for format/thumbnail patterns.';

    const { data: gapRow, error: gapErr } = await sb.from('v_yt_gap_reports').insert({
      property_id,
      generated_at_utc:     new Date().toISOString(),
      our_theme_counts:     ourCounts,
      compset_theme_counts: compCounts,
      gaps,
      recommendations,
      competitors_scanned:  scanned,
      our_videos_scanned:   ourScan?.titles.length ?? 0,
    }).select('report_id').maybeSingle();

    if (gapErr) return err('gap_report_insert_failed', 500, { detail: gapErr.message, snapshots, hot_videos: hotInserted });

    return ok({
      competitors_scanned: scanned,
      snapshots,
      hot_videos: hotInserted,
      gap_report_id: (gapRow as { report_id?: string } | null)?.report_id ?? null,
      gaps,
    });
  } catch (e) {
    return err('spy_scan_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
