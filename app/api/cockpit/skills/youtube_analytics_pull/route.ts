// app/api/cockpit/skills/youtube_analytics_pull/route.ts
// Daily analytics pull. Because yt-analytics.readonly scope was NOT granted
// during OAuth, we fall back to Data API v3 /videos?part=statistics on the
// last 30 days of publications and store snapshots in marketing.yt_analytics_daily.
// Input : { property_id, date? } (date default = yesterday UTC)
// Output: { ok, rows_inserted, skipped_reason? }

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

    // We know yt-analytics scope was NOT granted (per PBS · 2026-07-11 handover).
    // Attempting the Analytics endpoint would 403. Skip it and fall back to Data API.
    // If a future OAuth flow adds the scope, extend this route with a real analytics query.

    // Load last-30-day publications
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: pubs } = await sb
      .from('v_yt_publications')
      .select('publication_id,youtube_video_id,actual_publish_utc')
      .eq('property_id', property_id)
      .gte('actual_publish_utc', cutoff);

    const pubRows = ((pubs ?? []) as PublicationRow[]).filter((r) => r.youtube_video_id);
    if (pubRows.length === 0) {
      return ok({
        rows_inserted: 0,
        skipped:       true,
        reason:        'yt-analytics scope not granted; and no recent publications to snapshot',
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
      skipped: false,
      note:    'Data API v3 snapshot fallback (yt-analytics scope not granted).',
    });
  } catch (e) {
    return err('analytics_pull_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
