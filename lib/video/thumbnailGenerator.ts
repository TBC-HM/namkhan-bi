// lib/video/thumbnailGenerator.ts
// PBS 2026-07-13 · Video AI Studio v1 — per-channel thumbnail composer.
// Uses sharp to resize + overlay title, tagline, brand-color bar.
// Outputs are uploaded to `media-thumbnails/renders/{render_id}/{channel}.jpg`
// and returned as public URLs.
import sharp from 'sharp';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface ChannelSpec {
  key: string;                 // 'youtube' | 'instagram_cover' | 'tiktok_cover' | 'facebook' | 'website_hero'
  width: number;
  height: number;
  display_name: string;
}

export const DEFAULT_CHANNEL_SPECS: ChannelSpec[] = [
  { key: 'youtube',         width: 1280, height: 720,  display_name: 'YouTube 16:9' },
  { key: 'instagram_cover', width: 1080, height: 1350, display_name: 'Instagram 4:5 cover' },
  { key: 'tiktok_cover',    width: 1080, height: 1920, display_name: 'TikTok 9:16 cover' },
  { key: 'facebook',        width: 1200, height: 630,  display_name: 'Facebook 1.91:1' },
  { key: 'website_hero',    width: 2400, height: 1000, display_name: 'Website hero (wide)' },
];

function escapeSvg(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildOverlaySvg(w: number, h: number, title: string, tagline: string, primary: string): Buffer {
  const barH = Math.round(h * 0.20);
  const titleSize = Math.round(h * 0.062);
  const tagSize   = Math.round(h * 0.028);
  const svg = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
    '<defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1">' +
    '<stop offset="0%" stop-color="#000" stop-opacity="0"/>' +
    '<stop offset="100%" stop-color="#000" stop-opacity="0.72"/></linearGradient></defs>' +
    '<rect x="0" y="' + (h - barH) + '" width="' + w + '" height="' + barH + '" fill="url(#g)"/>' +
    '<rect x="0" y="' + (h - 4) + '" width="' + w + '" height="4" fill="' + escapeSvg(primary) + '"/>' +
    '<text x="' + Math.round(w * 0.05) + '" y="' + (h - Math.round(barH * 0.42)) + '" ' +
    'fill="#FFFFFF" font-family="Georgia,serif" font-size="' + titleSize + '" font-weight="700" letter-spacing="2">' +
    escapeSvg(title) + '</text>' +
    '<text x="' + Math.round(w * 0.05) + '" y="' + (h - Math.round(barH * 0.15)) + '" ' +
    'fill="#E6DFCC" font-family="sans-serif" font-size="' + tagSize + '" letter-spacing="4">' +
    escapeSvg(tagline) + '</text>' +
    '</svg>';
  return Buffer.from(svg, 'utf8');
}

export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('fetch_image_failed_status_' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

export interface ThumbnailResult {
  channel: string;
  display_name: string;
  width: number;
  height: number;
  url: string | null;
  error?: string;
}

export async function generateThumbnails(
  sourceImageUrl: string,
  title: string,
  tagline: string,
  opts?: { render_id?: string; primary_color?: string; specs?: ChannelSpec[]; bucket?: string },
): Promise<ThumbnailResult[]> {
  const primary = opts?.primary_color ?? '#084838';
  const specs = opts?.specs ?? DEFAULT_CHANNEL_SPECS;
  const bucket = opts?.bucket ?? 'media-thumbnails';
  const renderId = opts?.render_id ?? ('preview_' + Date.now());
  const sb = getSupabaseAdmin();

  const source = await fetchImageBuffer(sourceImageUrl);
  const results: ThumbnailResult[] = [];

  for (const spec of specs) {
    try {
      const overlay = buildOverlaySvg(spec.width, spec.height, title, tagline, primary);
      const composited = await sharp(source)
        .resize(spec.width, spec.height, { fit: 'cover', position: 'attention' })
        .composite([{ input: overlay, top: 0, left: 0 }])
        .jpeg({ quality: 88, progressive: true, mozjpeg: true })
        .toBuffer();

      const key = 'renders/' + renderId + '/' + spec.key + '.jpg';
      const up = await sb.storage.from(bucket).upload(key, composited, {
        contentType: 'image/jpeg', upsert: true, cacheControl: 'public, max-age=3600',
      });
      if (up.error) throw new Error('storage:' + up.error.message);
      const pub = sb.storage.from(bucket).getPublicUrl(key);
      results.push({
        channel: spec.key, display_name: spec.display_name,
        width: spec.width, height: spec.height,
        url: pub.data?.publicUrl ?? null,
      });
    } catch (e: any) {
      results.push({
        channel: spec.key, display_name: spec.display_name,
        width: spec.width, height: spec.height,
        url: null, error: e?.message ?? 'unknown',
      });
    }
  }
  return results;
}

/**
 * Ensures the bucket exists. Called on demand by API route.
 * Silently ignores existence errors.
 */
export async function ensureBucket(name: string): Promise<void> {
  const sb = getSupabaseAdmin();
  try {
    await sb.storage.createBucket(name, { public: true });
  } catch { /* already exists */ }
}
