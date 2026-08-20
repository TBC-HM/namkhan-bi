// app/api/marketing/social/quick-push/route.ts
// PBS 2026-08-20 — Quick Post composer endpoint (v2 · per-platform payloads).
//
// Accepts multipart/form-data OR JSON:
//   caption*        — text
//   title           — optional; auto = caption.slice(0, 60)
//   hashtags        — space/comma separated (# prefix optional)
//   media_url       — public URL (image or video)
//   scheduled_at    — ISO or empty (empty = publish now)
//   platforms[]*    — array of platform slugs
//   property_id     — default 260955
//   return_to       — post-submit URL (form flow)
//
//   Per-platform extras (all optional):
//     pinterest_board_id, pinterest_link, pinterest_alt_text, pinterest_cover_image_url
//     google_business_location_id, google_business_type (WHATS_NEW|EVENT|OFFER),
//       google_business_cta_type, google_business_cta_url
//     facebook_page_id
//     linkedin_page_urn, linkedin_description
//     youtube_description
//     tiktok_post_mode (DIRECT_POST|MEDIA_UPLOAD default MEDIA_UPLOAD for organic reach),
//       tiktok_privacy_level, tiktok_disable_comment, tiktok_disable_duet, tiktok_disable_stitch
//     x_long_text_as_post
//     instagram_first_comment, instagram_media_type (IMAGE|STORIES)
//     threads_topic_tag
//
// For each platform, we auto-fill dest_id from marketing.upload_post_destinations
// (first active row for platform × property) when caller doesn't override.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const DEFAULT_PID = 260955;

// Platforms that require a destination pick (fail with a clear error if missing)
const DEST_REQUIRED_MAP: Record<string, string> = {
  pinterest: 'pinterest_board_id',
  google_business: 'google_business_location_id',
  facebook: 'facebook_page_id',
  linkedin: 'linkedin_page_urn',
};

function tagsFromString(s: string | null | undefined): string[] {
  if (!s) return [];
  return String(s).split(/[\s,]+/).map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith('#') ? t : '#' + t));
}

type Payload = Record<string, unknown>;

function readFormValue(f: FormData, k: string): string {
  const v = f.get(k);
  return v == null ? '' : String(v);
}

function readFormBool(f: FormData, k: string): boolean {
  const v = f.get(k);
  return v === 'true' || v === '1' || v === 'on';
}

async function pickAutoDest(sb: ReturnType<typeof getSupabaseAdmin>, property_id: number, platform: string): Promise<string | null> {
  const { data } = await sb
    .from('v_up_destinations')
    .select('dest_id')
    .eq('property_id', property_id)
    .eq('platform', platform)
    .eq('active', true)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { dest_id?: string } | null)?.dest_id ?? null;
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let caption = '', title = '', hashtags: string[] = [], media_url = '', scheduled_at = '';
  let platforms: string[] = [];
  let property_id = DEFAULT_PID;
  let return_to = '/marketing/social?view=channels';
  let extra: Payload = {};

  try {
    if (isJson) {
      const b = await req.json();
      caption = String(b.caption || '');
      title = String(b.title || '');
      hashtags = tagsFromString(b.hashtags);
      media_url = String(b.media_url || '');
      scheduled_at = String(b.scheduled_at || '');
      platforms = Array.isArray(b.platforms) ? b.platforms.map(String) : [];
      property_id = Number(b.property_id) || DEFAULT_PID;
      return_to = String(b.return_to || return_to);
      extra = (b.extra && typeof b.extra === 'object') ? b.extra as Payload : {};
    } else {
      const f = await req.formData();
      caption = readFormValue(f, 'caption');
      title = readFormValue(f, 'title') || caption.slice(0, 60);
      hashtags = tagsFromString(readFormValue(f, 'hashtags'));
      media_url = readFormValue(f, 'media_url');
      scheduled_at = readFormValue(f, 'scheduled_at');
      platforms = f.getAll('platforms').map(String).filter(Boolean);
      property_id = Number(f.get('property_id')) || DEFAULT_PID;
      return_to = readFormValue(f, 'return_to') || return_to;
      // Per-platform extras — read all whitelisted keys from form
      const perPlat = [
        'pinterest_board_id', 'pinterest_link', 'pinterest_alt_text', 'pinterest_cover_image_url',
        'google_business_location_id', 'google_business_type', 'google_business_cta_type', 'google_business_cta_url',
        'facebook_page_id',
        'linkedin_page_urn', 'linkedin_description',
        'youtube_description',
        'tiktok_post_mode', 'tiktok_privacy_level',
        'x_long_text_as_post',
        'instagram_first_comment', 'instagram_media_type',
        'threads_topic_tag',
      ];
      for (const k of perPlat) {
        const v = f.get(k);
        if (v != null && v !== '') extra[k] = String(v);
      }
      // Booleans
      for (const k of ['tiktok_disable_comment', 'tiktok_disable_duet', 'tiktok_disable_stitch']) {
        if (readFormBool(f, k)) extra[k] = true;
      }
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }

  if (!caption.trim() && !title.trim()) return NextResponse.json({ ok: false, error: 'caption required' }, { status: 400 });
  if (!title.trim()) title = caption.slice(0, 60);
  if (platforms.length === 0) return NextResponse.json({ ok: false, error: 'select at least one platform' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const results: Array<{ platform: string; ok: boolean; post_id?: string; error?: string }> = [];

  for (const platform of platforms) {
    try {
      // Resolve destination if required and not provided
      const destKey = DEST_REQUIRED_MAP[platform];
      if (destKey && !extra[destKey]) {
        const auto = await pickAutoDest(sb, property_id, platform);
        if (!auto) throw new Error(`${platform}: no destination configured — pick one in Channels`);
        extra[destKey] = auto;
      }

      // Per-platform sensible defaults
      const platformExtra: Payload = { ...extra };
      if (platform === 'tiktok' && !platformExtra.tiktok_post_mode) {
        platformExtra.tiktok_post_mode = 'MEDIA_UPLOAD';   // Draft — better organic reach per docs
      }
      if (platform === 'instagram' && !platformExtra.instagram_media_type) {
        platformExtra.instagram_media_type = 'IMAGE';
      }
      if (platform === 'google_business' && !platformExtra.google_business_type) {
        platformExtra.google_business_type = 'WHATS_NEW';
      }
      if (platform === 'youtube' && !title) {
        throw new Error('youtube: title required');
      }
      if (platform === 'pinterest' && !platformExtra.pinterest_description) {
        platformExtra.pinterest_description = caption;
      }

      // Build the row for social_posts
      const p: Payload = {
        property_id,
        platform,
        caption,
        title,
        created_by: 'pbs-quick-compose',
      };
      if (hashtags.length) p.hashtags = hashtags;
      if (media_url) p.media_urls = [media_url];
      if (scheduled_at) p.scheduled_at = scheduled_at;
      // Stash per-platform extras in ai_notes as JSON so the edge fn can pick them up
      p.ai_notes = JSON.stringify(platformExtra);

      const { data: post_id, error: createErr } = await sb.rpc('fn_social_post_create', { p });
      if (createErr || !post_id) throw createErr || new Error('create returned no id');

      const nextStatus = scheduled_at ? 'scheduled' : 'ready';
      await sb.rpc('fn_social_post_set_status', { p_post_id: post_id, p_status: nextStatus });

      if (!scheduled_at) {
        const { error: pushErr } = await sb.functions.invoke('social-push', {
          body: { mode: 'push', post_id, property_id, platform_extras: platformExtra },
        });
        if (pushErr) throw pushErr;
      }
      results.push({ platform, ok: true, post_id: String(post_id) });
    } catch (e) {
      results.push({ platform, ok: false, error: (e as Error)?.message ?? String(e) });
    }
  }

  const ok_count = results.filter((r) => r.ok).length;
  const params = new URLSearchParams();
  params.set('composed', String(ok_count));
  params.set('failed', String(results.length - ok_count));
  if (scheduled_at) params.set('scheduled', '1');
  const firstErr = results.find((r) => !r.ok)?.error;
  if (firstErr) params.set('err', firstErr.slice(0, 100));
  const url = return_to.includes('?') ? `${return_to}&${params.toString()}` : `${return_to}?${params.toString()}`;

  if (isJson) {
    return NextResponse.json({ ok: ok_count > 0, results, scheduled: !!scheduled_at });
  }
  return NextResponse.redirect(new URL(url, req.url), { status: 303 });
}
