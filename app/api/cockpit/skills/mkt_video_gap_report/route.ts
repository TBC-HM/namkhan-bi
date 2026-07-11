// app/api/cockpit/skills/mkt_video_gap_report/route.ts
// Compare our channel vs blacklist compset — content-gap map.
// Input : { property_id: number }
// Output: { ok, report_id, gaps, competitors_scanned, our_videos_scanned }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { fetchRecentVideos } from '@/lib/youtube/data';
import { getVaultSecret, ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THEMES: Array<{ key: string; needles: string[] }> = [
  { key: 'retreat',    needles: ['retreat','wellness','yoga','meditation','spa','sauna'] },
  { key: 'room_tour',  needles: ['room tour','suite tour','villa tour','walkthrough','hotel room'] },
  { key: 'food',       needles: ['food','cuisine','breakfast','dinner','tasting','chef','menu','restaurant'] },
  { key: 'scenery',    needles: ['sunset','river','landscape','drone','aerial','view','nature','mountain'] },
  { key: 'wellness',   needles: ['spa','massage','sauna','wellness','healing','detox'] },
  { key: 'community',  needles: ['village','community','local','artisan','craft','story','people','culture'] },
];

function bucketize(title: string, description: string): Set<string> {
  const hay = `${title} ${description}`.toLowerCase();
  const hits = new Set<string>();
  for (const t of THEMES) {
    if (t.needles.some((n) => hay.includes(n))) hits.add(t.key);
  }
  return hits;
}

interface CompetitorSearchResp {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; description?: string; channelTitle?: string };
  }>;
}

async function fetchCompetitorVideos(apiKey: string, competitorName: string): Promise<Array<{ title: string; description: string }>> {
  const url = `https://www.googleapis.com/youtube/v3/search`
    + `?part=snippet&type=video&order=date&maxResults=10`
    + `&q=${encodeURIComponent(competitorName)}&key=${apiKey}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) return [];
  const j = (await r.json().catch(() => null)) as CompetitorSearchResp | null;
  return (j?.items ?? [])
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      title:       it.snippet?.title       ?? '',
      description: it.snippet?.description ?? '',
    }));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { property_id?: number };
    const property_id = Number(body.property_id);
    if (!Number.isFinite(property_id) || property_id <= 0) return err('property_id_required', 400);

    const sb = getSupabaseAdmin();

    // 1) Our recent videos (last 20) via OAuth channel connection
    const tokRes = await getFreshAccessToken(property_id);
    let ourVideos: Array<{ title: string; description: string }> = [];
    if (tokRes.ok && tokRes.access_token && tokRes.channel_id) {
      const v = await fetchRecentVideos(tokRes.access_token, tokRes.channel_id, 20);
      if (v.ok) ourVideos = v.data.map((x) => ({ title: x.title, description: x.description }));
    }

    const ourThemeCounts: Record<string, number> = {};
    for (const t of THEMES) ourThemeCounts[t.key] = 0;
    for (const vid of ourVideos) {
      for (const theme of bucketize(vid.title, vid.description)) ourThemeCounts[theme]++;
    }

    // 2) Competitor videos
    const apiKey = (await getVaultSecret('YOUTUBE_DATA_API_KEY'))
                ?? (await getVaultSecret('YOUTUBE_OAUTH_CLIENT_ID'));
    if (!apiKey) return err('vault_key_missing_YOUTUBE_DATA_API_KEY');

    const { data: comps } = await sb
      .from('v_yt_competitors_blacklist')
      .select('competitor_name')
      .eq('property_id', property_id)
      .eq('active', true);
    const competitorNames = ((comps ?? []) as Array<{ competitor_name: string }>).map((c) => c.competitor_name);

    const compsetThemeCounts: Record<string, number> = {};
    for (const t of THEMES) compsetThemeCounts[t.key] = 0;
    let scanned = 0;
    for (const name of competitorNames.slice(0, 10)) {
      const vids = await fetchCompetitorVideos(apiKey, name);
      scanned++;
      for (const vid of vids) {
        for (const theme of bucketize(vid.title, vid.description)) compsetThemeCounts[theme]++;
      }
    }

    // 3) Gaps — themes where compset > us by >=3
    const gaps: string[] = [];
    for (const t of THEMES) {
      const diff = (compsetThemeCounts[t.key] ?? 0) - (ourThemeCounts[t.key] ?? 0);
      if (diff >= 3) gaps.push(t.key);
    }

    // 4) Recommendations
    const recommendations = gaps.length === 0
      ? 'No material content gaps in the last-N-videos window. Continue current mix.'
      : `Increase output on: ${gaps.join(', ')}. Compset produced ${gaps
          .map((g) => `${compsetThemeCounts[g]} ${g} vs our ${ourThemeCounts[g]}`)
          .join(' · ')}. Draft angles via youtube_trend_scout then youtube_script_edl_draft.`;

    const { data: reportRow, error: insErr } = await sb
      .from('v_yt_gap_reports')
      .insert({
        property_id,
        our_theme_counts:     ourThemeCounts,
        compset_theme_counts: compsetThemeCounts,
        gaps,
        recommendations,
        competitors_scanned:  scanned,
        our_videos_scanned:   ourVideos.length,
      })
      .select('report_id')
      .single();

    if (insErr) return err('gap_report_insert_failed', 500, { detail: insErr.message });

    return ok({
      report_id:           (reportRow as { report_id: string }).report_id,
      gaps,
      competitors_scanned: scanned,
      our_videos_scanned:  ourVideos.length,
      our_theme_counts:    ourThemeCounts,
      compset_theme_counts: compsetThemeCounts,
    });
  } catch (e) {
    return err('gap_report_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
