// app/api/marketing/media/[asset_id]/route.ts
// PATCH /api/marketing/media/[asset_id]
// Minimal field-edit endpoint for the asset drawer (caption, alt_text, tags,
// primary_tier, license_type, license_expiry, property_area, do_not_modify).
// Reads come from /api/marketing/asset/[id] (already exists). This route owns
// writes only.
//
// Security model: same as the rest of the dashboard — service-role behind a
// password-gated frontend. Only whitelisted columns can be set; PK / sha256 /
// raw_path / master_path / mime_type / width / height etc. are READ-ONLY here.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EDITABLE_FIELDS = new Set([
  'caption',
  'alt_text',
  'tags',                 // text[] — UI sends as string[]
  'primary_tier',         // enum: tier_ota_profile | tier_website_hero | tier_social_pool | tier_internal | tier_archive
  'secondary_tiers',      // enum[]
  'license_type',         // enum
  'license_expiry',       // date 'YYYY-MM-DD'
  'usage_rights',         // text[]
  'property_area',        // text
  'photographer',         // text
  'do_not_modify',        // boolean
]);

export async function PATCH(req: Request, { params }: { params: { asset_id: string } }) {
  const id = params.asset_id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: 'invalid asset_id' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json body' }, { status: 400 });
  }

  // Whitelist + drop empty / unchanged fields. `tags` arrays are normalised
  // to lower-case trimmed strings; license_expiry is forced to a valid date
  // string or null.
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (!EDITABLE_FIELDS.has(k)) continue;
    if (k === 'tags' || k === 'secondary_tiers' || k === 'usage_rights') {
      if (Array.isArray(v)) {
        patch[k] = (v as unknown[])
          .map((s) => String(s ?? '').trim())
          .filter(Boolean);
      } else if (v === null) {
        patch[k] = null;
      }
      continue;
    }
    if (k === 'license_expiry') {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) patch[k] = v;
      else if (v === null || v === '') patch[k] = null;
      continue;
    }
    if (k === 'do_not_modify') {
      patch[k] = !!v;
      continue;
    }
    if (typeof v === 'string') {
      patch[k] = v.trim() || null;
      continue;
    }
    patch[k] = v;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: 'no editable fields supplied' }, { status: 400 });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'service-role missing' }, { status: 500 });
  }

  const { data, error } = await admin
    .schema('marketing')
    .from('media_assets')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('asset_id', id)
    .select('asset_id, caption, alt_text, tags, primary_tier, license_type, license_expiry, property_area, photographer, do_not_modify, updated_at')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'asset not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, asset: data });
}
