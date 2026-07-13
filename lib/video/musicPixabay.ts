// lib/video/musicPixabay.ts
// PBS 2026-07-13 · Video AI Studio v1 — Pixabay Music search + curated fallback.
// Free with attribution. Vault key `PIXABAY_API_KEY` may be missing → falls
// back to marketing.video_music_tracks (bridge v_video_music_tracks) and then
// to bundled JSON.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVaultSecret } from '@/lib/youtube/skills-common';
import curated from './curated_music_library.json';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  duration_sec: number;
  mood_tags: string[];
  url: string;
  license_terms: string;
  source: 'pixabay' | 'curated' | 'db';
}

function matchesMood(track: { mood_tags?: string[] | null }, mood: string): boolean {
  if (!mood) return true;
  const m = mood.toLowerCase();
  return (track.mood_tags ?? []).some(t => (t ?? '').toLowerCase().includes(m));
}

function inRange(dur: number, min: number, max: number): boolean {
  if (!dur || Number.isNaN(dur)) return true;
  if (min > 0 && dur < min) return false;
  if (max > 0 && dur > max) return false;
  return true;
}

export async function searchMusic(mood: string, minDuration = 0, maxDuration = 0): Promise<MusicTrack[]> {
  // 1. Try Pixabay API if we have a key.
  const key = await getVaultSecret('PIXABAY_API_KEY');
  if (key) {
    try {
      const res = await fetch('https://pixabay.com/api/videos/music/?key=' + encodeURIComponent(key)
        + '&q=' + encodeURIComponent(mood ?? '') + '&per_page=10');
      if (res.ok) {
        const j = await res.json().catch(() => null) as any;
        const hits = (j?.hits ?? []) as any[];
        if (hits.length > 0) {
          return hits
            .filter(h => inRange(Number(h?.duration ?? 0), minDuration, maxDuration))
            .slice(0, 10)
            .map(h => ({
              id: 'pixabay-' + String(h?.id ?? ''),
              title: h?.title ?? h?.tags ?? 'Untitled',
              artist: h?.user ?? null,
              duration_sec: Number(h?.duration ?? 0),
              mood_tags: String(h?.tags ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
              url: h?.audio ?? h?.videos?.medium?.url ?? '',
              license_terms: 'royalty_free_attribution',
              source: 'pixabay' as const,
            }))
            .filter(t => t.url);
        }
      }
    } catch { /* fall through */ }
  }

  // 2. Try database (seeded 30 tracks).
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('v_video_music_tracks').select('*').limit(50);
    const rows = ((data ?? []) as any[])
      .filter(r => matchesMood(r, mood))
      .filter(r => inRange(Number(r?.duration_sec ?? 0), minDuration, maxDuration))
      .slice(0, 10)
      .map(r => ({
        id: r.id, title: r.title, artist: r.artist,
        duration_sec: Number(r.duration_sec ?? 0),
        mood_tags: r.mood_tags ?? [],
        url: r.url, license_terms: r.license_terms ?? 'royalty_free_attribution',
        source: 'db' as const,
      }));
    if (rows.length > 0) return rows;
  } catch { /* fall through */ }

  // 3. Bundled JSON fallback.
  return (curated as any[])
    .filter((r: any) => matchesMood(r, mood))
    .filter((r: any) => inRange(Number(r.duration_sec ?? 0), minDuration, maxDuration))
    .slice(0, 10)
    .map((r: any) => ({
      id: r.id, title: r.title, artist: r.artist,
      duration_sec: Number(r.duration_sec ?? 0),
      mood_tags: r.mood_tags ?? [],
      url: r.url, license_terms: r.license_terms ?? 'royalty_free_attribution',
      source: 'curated' as const,
    }));
}
