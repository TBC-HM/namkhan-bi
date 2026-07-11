// app/api/cockpit/skills/youtube_trend_scout/route.ts
// Weekly trend scan → generate marketing.yt_trend_briefs rows.
// Input : { property_id: number }
// Output: { ok, briefs_created, seed_keywords, total_candidates }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVaultSecret, ok, err, isoDaysAgo, nGrams, jaccard } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SEED_KEYWORDS = [
  'retreat',
  'wellness',
  'luang prabang',
  'laos boat',
  'riverside dining',
  'art suite',
];

interface SearchItem {
  id?:      { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
}
interface SearchResp  { items?: SearchItem[] }

interface VideoStats  {
  id: string;
  statistics?: { viewCount?: string; likeCount?: string };
}
interface VideosResp  { items?: VideoStats[] }

interface Candidate {
  video_id:    string;
  title:       string;
  snippet:     string;
  channel:     string;
  published:   string;
  views:       number;
  likes:       number;
  score:       number;
  seed:        string;
}

interface Cluster {
  hook:                string;    // canonical title from best candidate
  activation_score:    number;
  candidate_angles:    Candidate[];
  keyword_seeds:       string[];
}

async function searchYt(apiKey: string, q: string, publishedAfter: string): Promise<SearchItem[]> {
  const url = `https://www.googleapis.com/youtube/v3/search`
    + `?part=snippet&type=video&order=viewCount`
    + `&publishedAfter=${encodeURIComponent(publishedAfter)}`
    + `&maxResults=10&q=${encodeURIComponent(q)}&key=${apiKey}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) return [];
  const j = (await r.json().catch(() => null)) as SearchResp | null;
  return j?.items ?? [];
}

async function statsForIds(apiKey: string, ids: string[]): Promise<Map<string, VideoStats>> {
  const out = new Map<string, VideoStats>();
  if (ids.length === 0) return out;
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(',')}&key=${apiKey}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) return out;
  const j = (await r.json().catch(() => null)) as VideosResp | null;
  for (const it of j?.items ?? []) out.set(it.id, it);
  return out;
}

function clusterCandidates(all: Candidate[]): Cluster[] {
  const sorted = [...all].sort((a, b) => b.score - a.score);
  const clusters: Cluster[] = [];
  const SIM_THRESHOLD = 0.35;
  for (const cand of sorted) {
    const g = nGrams(cand.title, 3);
    let placed = false;
    for (const c of clusters) {
      const anchor = nGrams(c.hook, 3);
      if (jaccard(g, anchor) >= SIM_THRESHOLD) {
        c.candidate_angles.push(cand);
        c.activation_score = Math.max(c.activation_score, cand.score);
        if (!c.keyword_seeds.includes(cand.seed)) c.keyword_seeds.push(cand.seed);
        placed = true;
        break;
      }
    }
    if (!placed && clusters.length < 12) {
      clusters.push({
        hook: cand.title,
        activation_score: cand.score,
        candidate_angles: [cand],
        keyword_seeds: [cand.seed],
      });
    }
  }
  return clusters;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { property_id?: number };
    const property_id = Number(body.property_id);
    if (!Number.isFinite(property_id) || property_id <= 0) return err('property_id_required', 400);

    // YouTube Data API v3 uses a Google API key (not OAuth) for public search.
    // We check YOUTUBE_DATA_API_KEY first, fall back to the OAuth client id
    // (some deployments key search off the same key) — else skip.
    const apiKey = (await getVaultSecret('YOUTUBE_DATA_API_KEY'))
                ?? (await getVaultSecret('YOUTUBE_OAUTH_CLIENT_ID'));
    if (!apiKey) return err('vault_key_missing_YOUTUBE_DATA_API_KEY');

    const sb = getSupabaseAdmin();

    // Competitor keyword seeds
    const { data: comps } = await sb
      .from('v_yt_competitors_blacklist')
      .select('competitor_name,brand_hashtags')
      .eq('property_id', property_id)
      .eq('active', true);
    const competitorSeeds: string[] = [];
    for (const row of (comps ?? []) as Array<{ competitor_name: string; brand_hashtags: string[] | null }>) {
      if (row.competitor_name) competitorSeeds.push(row.competitor_name);
      for (const h of row.brand_hashtags ?? []) if (h) competitorSeeds.push(h.replace(/^#/, ''));
    }
    const seedKeywords = Array.from(new Set([...competitorSeeds, ...SEED_KEYWORDS])).slice(0, 20);

    const publishedAfter = isoDaysAgo(7);

    // Search per seed, gather candidates
    const candidates: Candidate[] = [];
    for (const seed of seedKeywords) {
      const items = await searchYt(apiKey, seed, publishedAfter);
      const ids   = items.map((it) => it.id?.videoId).filter((x): x is string => Boolean(x));
      const stats = await statsForIds(apiKey, ids);
      for (const it of items) {
        const vid = it.id?.videoId;
        if (!vid) continue;
        const s = stats.get(vid);
        const views = Number(s?.statistics?.viewCount ?? 0);
        const likes = Number(s?.statistics?.likeCount ?? 0);
        const score = Math.min(100, Math.floor(views / 10000) + Math.floor(likes / 100));
        candidates.push({
          video_id:  vid,
          title:     it.snippet?.title       ?? '(untitled)',
          snippet:   (it.snippet?.description ?? '').slice(0, 240),
          channel:   it.snippet?.channelTitle ?? '',
          published: it.snippet?.publishedAt  ?? '',
          views, likes, score, seed,
        });
      }
    }

    // Cluster top 30 by title similarity
    const top = [...candidates].sort((a, b) => b.score - a.score).slice(0, 30);
    const clusters = clusterCandidates(top);

    // Insert one brief per cluster
    let briefs_created = 0;
    for (const c of clusters) {
      const { error: insErr } = await sb
        .from('v_yt_trend_briefs')  // bridge view targets marketing.yt_trend_briefs; PostgREST writes go through the bridge
        .insert({
          property_id,
          activation_score: c.activation_score,
          keyword_seeds:    c.keyword_seeds,
          candidate_angles: c.candidate_angles,
        });
      if (!insErr) briefs_created++;
    }

    return ok({
      briefs_created,
      seed_keywords:    seedKeywords,
      total_candidates: candidates.length,
    });
  } catch (e) {
    return err('trend_scout_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
