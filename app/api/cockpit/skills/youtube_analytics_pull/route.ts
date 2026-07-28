// app/api/cockpit/skills/youtube_analytics_pull/route.ts
// Daily analytics pull — two layers (yt-completion brief 2026-07-28):
//  1. CHANNEL-LEVEL: real YouTube Analytics API v2 query (views, watch time,
//     subs gained, likes, shares per day, last 28 days) keyed on the active
//     connection's channel_id. Requires the yt-analytics.readonly scope that
//     the 2026-07-27 reconnect granted. Rows land in marketing.yt_analytics_daily
//     with channel_id set and publication_id NULL (upsert on channel_id,metric_date).
//  2. PER-VIDEO FALLBACK (preserved behavior): Data API v3 /videos?part=statistics
//     on the last 30 days of publications → per-publication snapshot rows.
// Input : { property_id, date? } (date default = yesterday UTC)
// Output: { ok, rows_inserted, channel_rows_inserted, analytics_api_status, skipped_reason? }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PublicationRow {
  publication_id:  string;
  youtube_video_id: string;
  actual_publish_utc: string | null;
}

interface VideoStat {
  id: string;
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}
interface VideosResp { items?: VideoStat[] }

function yesterdayIso(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ---- Channel-level Analytics API v2 ----------------------------------------

interface AnalyticsReport {
  columnHeaders?: Array<{ name: string }>;
  rows?: Array<Array<string | number>>;
  error?: { code?: number; message?: string };
}

interface ChannelPullResult {
  status: number;            // HTTP status from youtubeanalytics.googleapis.com
  rows_upserted: number;
  error?: string;
}

async function pullChannelDaily(
  sb: ReturnType<typeof getSupabaseAdmin>,
  accessToken: string,
  channelId: string,
  endDate: string,
): Promise<ChannelPullResult> {
  const start = new Date(new Date(endDate + 'T00:00:00Z').getTime() - 28 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const qs = new URLSearchParams({
    ids:        `channel==${channelId}`,
    startDate:  start,
    endDate,
    metrics:    'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,shares',
    dimensions: 'day',
    sort:       'day',
  });
  const r = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache:   'no-store',
  });
  const j = (await r.json().catch(() => null)) as AnalyticsReport | null;
  if (!r.ok) {
    return { status: r.status, rows_upserted: 0, error: (j?.error?.message ?? `analytics_api_${r.status}`).slice(0, 200) };
  }

  const headers = (j?.columnHeaders ?? []).map((h) => h.name);
  const idx = (name: string) => headers.indexOf(name);
  const rows = j?.rows ?? [];
  let upserted = 0;
  for (const row of rows) {
    const day = String(row[idx('day')] ?? '').slice(0, 10);
    if (!day) continue;
    const num = (name: string): number | null => {
      const i = idx(name);
      if (i < 0) return null;
      const v = Number(row[i]);
      return Number.isFinite(v) ? v : null;
    };
    const { error: upErr } = await sb
      .from('v_yt_analytics_daily')
      .upsert({
        channel_id:          channelId,
        publication_id:      null,
        metric_date:         day,
        views:               num('views') ?? 0,
        likes:               num('likes') ?? 0,
        shares:              num('shares') ?? 0,
        subs_gained:         num('subscribersGained') ?? 0,
        avg_view_duration_s: num('averageViewDuration'),
        avg_view_pct:        num('averageViewPercentage'),
        ctr_impressions:     null,
      }, { onConflict: 'channel_id,metric_date', ignoreDuplicates: false });
    if (!upErr) upserted++;
  }
  return { status: r.status, rows_upserted: upserted };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { property_id?: number; date?: string };
    const property_id = Number(body.property_id);
    const metric_date = (body.date ?? yesterdayIso()).slice(0, 10);
    if (!Number.isFinite(property_id) || property_id <= 0) return err('property_id_required', 400);

    const sb = getSupabaseAdmin();

    // Load access token (used both for the scope check AND for fallback fetches)
    const tokRes = await getFreshAccessToken(property_id);
    if (!tokRes.ok || !tokRes.access_token) {
      return ok({
        rows_inserted: 0,
        skipped: true,
        reason: `access_token_unavailable: ${tokRes.error ?? 'unknown'}`,
      });
    }

    // 1) CHANNEL-LEVEL Analytics API pull (scope granted at the 2026-07-27
    //    reconnect). A 403 here means the token pre-dates the scope grant —
    //    we record the status and continue with the per-video fallback.
    let channelPull: ChannelPullResult = { status: 0, rows_upserted: 0, error: 'no_channel_id' };
    if (tokRes.channel_id) {
      channelPull = await pullChannelDaily(sb, tokRes.access_token, tokRes.channel_id, metric_date);
    }

    // 2) PER-VIDEO FALLBACK (preserved behavior) — load last-30-day publications
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: pubs } = await sb
      .from('v_yt_publications')
      .select('publication_id,youtube_video_id,actual_publish_utc')
      .eq('property_id', property_id)
      .gte('actual_publish_utc', cutoff);

    const pubRows = ((pubs ?? []) as PublicationRow[]).filter((r) => r.youtube_video_id);
    if (pubRows.length === 0) {
      return ok({
        rows_inserted:          0,
        channel_rows_inserted:  channelPull.rows_upserted,
        analytics_api_status:   channelPull.status,
        analytics_api_error:    channelPull.error,
        skipped:                channelPull.rows_upserted === 0,
        reason:                 'no recent publications to snapshot (per-video layer)',
      });
    }

    // Batched /videos call
    const ids = pubRows.map((r) => r.youtube_video_id).slice(0, 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${ids.join(',')}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${tokRes.access_token}` },
      cache:   'no-store',
    });
    if (!r.ok) {
      return ok({
        rows_inserted: 0,
        skipped:       true,
        reason:        `youtube_data_${r.status}`,
      });
    }
    const j = (await r.json().catch(() => null)) as VideosResp | null;
    const items = j?.items ?? [];
    const byId = new Map<string, VideoStat>();
    for (const it of items) byId.set(it.id, it);

    // Insert one snapshot row per publication for metric_date
    let rows_inserted = 0;
    for (const pub of pubRows) {
      const s = byId.get(pub.youtube_video_id);
      if (!s) continue;
      const views = Number(s.statistics?.viewCount ?? 0);
      const likes = Number(s.statistics?.likeCount ?? 0);

      const { error: insErr } = await sb
        .from('v_yt_analytics_daily')
        .upsert({
          publication_id:      pub.publication_id,
          metric_date,
          views,
          likes,
          shares:              0,
          subs_gained:         0,
          avg_view_duration_s: null,
          avg_view_pct:        null,
          ctr_impressions:     null,
        }, { onConflict: 'publication_id,metric_date', ignoreDuplicates: false });
      if (!insErr) rows_inserted++;
    }

    return ok({
      rows_inserted,
      channel_rows_inserted: channelPull.rows_upserted,
      analytics_api_status:  channelPull.status,
      analytics_api_error:   channelPull.error,
      skipped: false,
      note:    'channel-level Analytics API + per-publication Data API snapshot',
    });
  } catch (e) {
    return err('analytics_pull_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
