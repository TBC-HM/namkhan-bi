// app/api/cockpit/skills/youtube_trend_scout/route.ts
// Weekly trend scan → generate marketing.yt_trend_briefs rows
// + marketing.yt_keyword_trends rows (A4, yt-completion brief 2026-07-28):
// word 1/2-grams across this week's candidate titles, frequency vs last week.
// Input : { property_id: number }
// Output: { ok, briefs_created, keyword_trends_written, seed_keywords, total_candidates }

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

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'with', 'this', 'that', 'from', 'have',
  'was', 'are', 'not', 'but', 'all', 'how', 'why', 'what', 'when', 'where',
  'who', 'will', 'can', 'our', 'out', 'her', 'his', 'its', 'into', 'more',
  'most', 'new', 'now', 'one', 'two', 'top', 'best', 'video', 'youtube',
  'shorts', 'short', 'full', 'official', 'episode', 'part', 'vlog',
]);

interface KeywordCount { count: number; videoIds: Set<string> }

/** Word 1/2-grams from candidate titles → frequency map (distinct-video counts). */
function keywordFrequencies(cands: Candidate[]): Map<string, KeywordCount> {
  const freq = new Map<string, KeywordCount>();
  const bump = (gram: string, vid: string) => {
    const cur = freq.get(gram) ?? { count: 0, videoIds: new Set<string>() };
    if (!cur.videoIds.has(vid)) { cur.count++; cur.videoIds.add(vid); }
    freq.set(gram, cur);
  };
  for (const c of cands) {
    const words = c.title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
    const seen = new Set<string>();
    for (let i = 0; i < words.length; i++) {
      if (!seen.has(words[i])) { seen.add(words[i]); bump(words[i], c.video_id); }
      if (i + 1 < words.length) {
        const bi = `${words[i]} ${words[i + 1]}`;
        if (!seen.has(bi)) { seen.add(bi); bump(bi, c.video_id); }
      }
    }
  }
  return freq;
}

/** Monday (UTC) of the week containing `d`, as YYYY-MM-DD. */
function weekStartUtc(d: Date): string {
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
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
    // Vault name history: PBS minted the key 2026-07-27 and stored it as
    // 'youtube_api_key' (lowercase, per the console walkthrough); older code
    // expected 'YOUTUBE_DATA_API_KEY'. Accept both — uppercase first for any
    // future re-seed, then the live lowercase name. The OAuth client id is NOT
    // a valid Data API key (Google 400s on every search with it), so it was
    // removed as a fallback (yt-completion brief 2026-07-28).
    const apiKey = (await getVaultSecret('YOUTUBE_DATA_API_KEY'))
                ?? (await getVaultSecret('youtube_api_key'));
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

    // Keyword trends (A4): word 1/2-gram frequencies across ALL candidates this
    // week, compared against last week's captured rows. Idempotent per week —
    // delete-then-insert for (property_id, captured_week).
    let keyword_trends_written = 0;
    const captured_week = weekStartUtc(new Date());
    const lastWeekDate = new Date(`${captured_week}T00:00:00Z`);
    lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() - 7);
    const last_week = lastWeekDate.toISOString().slice(0, 10);

    const freq = keywordFrequencies(candidates);
    const topGrams = Array.from(freq.entries())
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 40);

    if (topGrams.length > 0) {
      const { data: prevRows } = await sb
        .from('v_yt_keyword_trends')
        .select('n_gram,frequency_this_week')
        .eq('property_id', property_id)
        .eq('captured_week', last_week);
      const prev = new Map(
        ((prevRows ?? []) as Array<{ n_gram: string; frequency_this_week: number }>)
          .map((r) => [r.n_gram, r.frequency_this_week]),
      );

      await sb.from('v_yt_keyword_trends')
        .delete()
        .eq('property_id', property_id)
        .eq('captured_week', captured_week);

      const trendRows = topGrams.map(([gram, v]) => {
        const lastFreq = prev.get(gram) ?? 0;
        return {
          property_id,
          n_gram:               gram,
          n_size:               gram.includes(' ') ? 2 : 1,
          frequency_this_week:  v.count,
          frequency_last_week:  lastFreq,
          frequency_delta_pct:  lastFreq > 0 ? Math.round(((v.count - lastFreq) / lastFreq) * 1000) / 10 : null,
          example_video_ids:    Array.from(v.videoIds).slice(0, 5),
          captured_week,
        };
      });
      const { error: ktErr } = await sb.from('v_yt_keyword_trends').insert(trendRows);
      if (!ktErr) keyword_trends_written = trendRows.length;
    }

    return ok({
      briefs_created,
      keyword_trends_written,
      seed_keywords:    seedKeywords,
      total_candidates: candidates.length,
    });
  } catch (e) {
    return err('trend_scout_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
