// app/api/marketing/social/export/route.ts
// spec-social-media-module (2026-07-25, run 3) · A5 — export approved posts as
// an upload-ready zip: one folder per post (caption.txt paste-ready +
// meta.json sidecar + media files), grouped by channel, validated against
// marketing.social_channel_rules. Scopes: explicit post_ids (per-post button),
// or week / month window (per-channel zip buttons in the inbox).
// Zip pattern follows app/api/legal/docs/bulk-download (JSZip, uint8array).
//
// POST { post_ids?: string[], platform?: string, scope?: 'selection'|'week'|'month',
//        anchor?: 'YYYY-MM-DD', property_id?: number } → application/zip

import { NextResponse, type NextRequest } from 'next/server';
import JSZip from 'jszip';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { SocialChannelRule } from '@/lib/marketing';
import type { SocialPostRow } from '@/lib/marketing-social';
import { formatPostForChannel, postFolderName, captionFileBody, metaFileBody } from '@/lib/social-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const NAMKHAN_PID = 260955; // legacy /marketing/social surface is Namkhan-scoped (§0.7)
const MAX_POSTS = 100;
const MAX_MEDIA_PER_POST = 8;
const MAX_MEDIA_BYTES_PER_POST = 15 * 1024 * 1024;
/** Only sign-off'd content leaves the building in window exports (A5: "approved post"). */
const APPROVED = new Set(['ready', 'scheduled', 'pushed']);

function extFromUrl(url: string, contentType: string | null): string {
  const m = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  if (m) return m[1].toLowerCase();
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  if (contentType?.includes('mp4')) return 'mp4';
  return 'jpg';
}

export async function POST(req: NextRequest) {
  let body: { post_ids?: unknown; platform?: string; scope?: string; anchor?: string; property_id?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const propertyId = Number(body.property_id) || NAMKHAN_PID;
  const ids = Array.isArray(body.post_ids) ? body.post_ids.filter((x): x is string => typeof x === 'string') : [];
  const scope = ids.length > 0 ? 'selection' : (body.scope === 'month' ? 'month' : 'week');
  const platform = typeof body.platform === 'string' && body.platform ? body.platform.toLowerCase() : null;

  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  const [{ data: postRows, error: pErr }, { data: ruleRows, error: rErr }] = await Promise.all([
    sb.from('v_social_posts').select('*').eq('property_id', propertyId).neq('status', 'cancelled'),
    sb.from('v_social_channel_rules').select('*').eq('property_id', propertyId),
  ]);
  if (pErr) return NextResponse.json({ error: `posts: ${pErr.message}` }, { status: 500 });
  if (rErr) return NextResponse.json({ error: `rules: ${rErr.message}` }, { status: 500 });

  const rules = new Map<string, SocialChannelRule>((ruleRows ?? []).map((r: SocialChannelRule) => [r.platform, r]));
  const all = (postRows ?? []) as SocialPostRow[];

  let selected: SocialPostRow[];
  if (scope === 'selection') {
    const want = new Set(ids);
    selected = all.filter((p) => want.has(p.post_id));
  } else {
    // Window = calendar week (Mon–Sun) or calendar month containing anchor (default today).
    const anchor = /^\d{4}-\d{2}-\d{2}$/.test(String(body.anchor)) ? new Date(`${body.anchor}T00:00:00Z`) : new Date();
    let fromMs: number; let toMs: number;
    if (scope === 'month') {
      fromMs = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1);
      toMs = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1);
    } else {
      const dow = (anchor.getUTCDay() + 6) % 7; // Mon=0
      fromMs = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() - dow);
      toMs = fromMs + 7 * 86400000;
    }
    selected = all.filter((p) => {
      if (!APPROVED.has(p.status)) return false;
      if (platform && p.platform !== platform) return false;
      const t = Date.parse(p.scheduled_at ?? p.created_at);
      return Number.isFinite(t) && t >= fromMs && t < toMs;
    });
  }

  if (selected.length === 0) {
    return NextResponse.json({ error: 'no_posts_in_scope', scope, platform, hint: 'window exports include approved posts only (ready/scheduled/pushed)' }, { status: 404 });
  }
  if (selected.length > MAX_POSTS) selected = selected.slice(0, MAX_POSTS);

  const zip = new JSZip();
  const warnings: string[] = [];
  const manifest: Array<Record<string, unknown>> = [];

  for (const post of selected) {
    const rule = rules.get(post.platform);
    if (!rule) warnings.push(`${post.platform}: no channel rule registered — exported without validation`);
    const fp = formatPostForChannel(post, rule);
    warnings.push(...fp.warnings);

    const folder = postFolderName(post);
    zip.file(`${folder}/caption.txt`, captionFileBody(post, rule, fp));
    zip.file(`${folder}/meta.json`, metaFileBody(post, rule, fp));

    let mediaBytes = 0; let mediaAdded = 0;
    const urls = (post.media_urls ?? []).filter((u) => /^https?:\/\//i.test(u)).slice(0, MAX_MEDIA_PER_POST);
    for (const url of urls) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) { warnings.push(`${folder}: media fetch ${res.status} — ${url.slice(0, 80)}`); continue; }
        const buf = new Uint8Array(await res.arrayBuffer());
        if (mediaBytes + buf.byteLength > MAX_MEDIA_BYTES_PER_POST) { warnings.push(`${folder}: media size cap hit — remaining files skipped`); break; }
        mediaBytes += buf.byteLength;
        mediaAdded += 1;
        zip.file(`${folder}/media_${mediaAdded}.${extFromUrl(url, res.headers.get('content-type'))}`, buf);
      } catch {
        warnings.push(`${folder}: media fetch failed — ${url.slice(0, 80)}`);
      }
    }
    manifest.push({ post_id: post.post_id, platform: post.platform, folder, status: post.status, media_files: mediaAdded, caption_chars: fp.charCount });
  }

  zip.file('manifest.json', JSON.stringify({
    generated_at: new Date().toISOString(),
    property_id: propertyId,
    scope,
    platform: platform ?? 'all',
    posts: manifest,
    warnings,
  }, null, 2) + '\n');

  const zipBuf = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `social_${platform ?? 'all'}_${scope}_${stamp}.zip`;

  return new NextResponse(new Blob([zipBuf as BlobPart], { type: 'application/zip' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Export-Posts': String(manifest.length),
      'X-Export-Warnings': String(warnings.length),
    },
  });
}
