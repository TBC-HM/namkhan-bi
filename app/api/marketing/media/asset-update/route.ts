// app/api/marketing/media/asset-update/route.ts
// POST — update mutable fields on a media asset via SECURITY DEFINER RPC.
// Photo fields: original_filename, caption, alt_text, primary_tier, property_area,
//               is_ai_generated, room_type_id.
// Video fields: visual_description, captured_at, camera_make/model/lens, has_audio,
//               audio_type, audio_language, color_profile, video_codec, audio_codec,
//               poster_frame_sec, seasonal_scope[], brand_room_type_scope[],
//               do_not_modify, has_identifiable_people, license_type, photographer.
// PBS 2026-07-12 — Edit ✎ button (Library + Clarify tabs).
// PBS 2026-07-13 · Task C — video field whitelist added.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIERS = new Set([
  'tier_website_hero', 'tier_ota_profile', 'tier_social_pool',
  'tier_internal', 'tier_logos', 'tier_archive',
]);
const AUDIO_TYPES = new Set(['none','dialog','narration','music','ambient','mixed']);
const COLOR_PROFILES = new Set(['rec709','HLG','HDR10','Log','sRGB']);
const LICENSE_TYPES = new Set(['owned','licensed','cc_by','editorial_only','influencer_ugc','guest_ugc']);

const STRING_KEYS = [
  'original_filename', 'caption', 'alt_text', 'primary_tier',
  'property_area', 'room_type_id',
  // video
  'visual_description', 'captured_at', 'camera_make', 'camera_model', 'lens',
  'audio_type', 'audio_language', 'color_profile', 'video_codec', 'audio_codec',
  'license_type', 'photographer',
];
const BOOL_KEYS = [
  'is_ai_generated', 'has_audio', 'do_not_modify', 'has_identifiable_people',
];
const NUM_KEYS = ['poster_frame_sec', 'gps_lat', 'gps_lng', 'facility_id', 'activity_id', 'certification_id', 'contact_id'];
const ARR_KEYS = ['seasonal_scope', 'brand_room_type_scope'];

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const asset_id = body?.asset_id;
  if (!asset_id || typeof asset_id !== 'string' || !UUID_RE.test(asset_id)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }
  if (body.primary_tier != null && body.primary_tier !== '' && !TIERS.has(String(body.primary_tier))) {
    return NextResponse.json({ error: 'invalid primary_tier' }, { status: 400 });
  }
  if (body.audio_type != null && body.audio_type !== '' && !AUDIO_TYPES.has(String(body.audio_type))) {
    return NextResponse.json({ error: 'invalid audio_type' }, { status: 400 });
  }
  if (body.color_profile != null && body.color_profile !== '' && !COLOR_PROFILES.has(String(body.color_profile))) {
    return NextResponse.json({ error: 'invalid color_profile' }, { status: 400 });
  }
  if (body.license_type != null && body.license_type !== '' && !LICENSE_TYPES.has(String(body.license_type))) {
    return NextResponse.json({ error: 'invalid license_type' }, { status: 400 });
  }

  const payload: Record<string, any> = { asset_id };
  for (const k of STRING_KEYS) {
    if (body[k] !== undefined) payload[k] = body[k] == null ? null : String(body[k]);
  }
  for (const k of BOOL_KEYS) {
    if (body[k] !== undefined) payload[k] = Boolean(body[k]);
  }
  for (const k of NUM_KEYS) {
    if (body[k] !== undefined) {
      if (body[k] == null || body[k] === '') payload[k] = null;
      else if (Number.isNaN(Number(body[k]))) return NextResponse.json({ error: `invalid ${k}` }, { status: 400 });
      else payload[k] = Number(body[k]);
    }
  }
  for (const k of ARR_KEYS) {
    if (body[k] !== undefined) {
      if (!Array.isArray(body[k])) return NextResponse.json({ error: `${k} must be an array` }, { status: 400 });
      payload[k] = body[k].map((v: any) => String(v)).filter(Boolean);
    }
  }

  try {
    const { data, error } = await sb.rpc('fn_media_asset_update', { p: payload });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    const res = data as any;
    if (!res?.ok) {
      return NextResponse.json({ error: res?.error ?? 'update_failed' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, asset: res.asset });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
