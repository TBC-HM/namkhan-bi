// app/api/brand-voice/update/route.ts
// PBS 2026-09-14: persist brand-voice fields (banned_phrases, tone_dos, tone_donts)
// to property.brand_reality via fn_update_brand_voice RPC.
// L22 compliant: property_id from body, gated by requirePropertyAccess().

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Req {
  property_id: number;
  banned_phrases: string[];
  tone_dos: string[];
  tone_donts: string[];
}

export async function POST(req: Request) {
  let body: Req;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!body.property_id) {
    return NextResponse.json({ ok: false, error: 'missing_property_id' }, { status: 400 });
  }
  if (!Array.isArray(body.banned_phrases) || !Array.isArray(body.tone_dos) || !Array.isArray(body.tone_donts)) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }

  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, body.property_id);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ ok: false, error: 'authorization_check_failed' }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('fn_update_brand_voice', {
    p_property_id:    propertyId,
    p_banned_phrases: body.banned_phrases,
    p_tone_dos:       body.tone_dos,
    p_tone_donts:     body.tone_donts,
    p_updated_by:     'settings_ui',
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
