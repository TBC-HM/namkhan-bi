// app/api/marketing/media/asset-update/route.ts
// POST — update mutable fields on a media asset via SECURITY DEFINER RPC.
// Fields: original_filename, caption, alt_text, primary_tier, property_area, is_ai_generated.
// PBS 2026-07-12 — Edit ✎ button (Library + Clarify tabs).
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIERS = new Set([
  'tier_website_hero', 'tier_ota_profile', 'tier_social_pool',
  'tier_internal', 'tier_logos', 'tier_archive',
]);

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
  if (body.primary_tier != null && !TIERS.has(String(body.primary_tier))) {
    return NextResponse.json({ error: 'invalid primary_tier' }, { status: 400 });
  }

  // Build the JSONB payload — only include fields the caller sent, so
  // COALESCE in the RPC leaves untouched columns alone.
  const payload: Record<string, any> = { asset_id };
  for (const k of ['original_filename', 'caption', 'alt_text', 'primary_tier', 'property_area']) {
    if (body[k] !== undefined) payload[k] = body[k] == null ? null : String(body[k]);
  }
  if (body.is_ai_generated !== undefined) {
    payload.is_ai_generated = Boolean(body.is_ai_generated);
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
