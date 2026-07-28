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
