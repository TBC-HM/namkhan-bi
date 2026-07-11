// app/api/marketing/media/prompt-category-upsert/route.ts
// POST — upsert media.ai_prompt_categories via public.fn_ai_prompt_category_upsert.
// Body: { key, display_name, base_prompt, default_target_tier, example_hint, active, sort_order, property_id? }
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TIERS = new Set(['tier_social_pool','tier_internal']);

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const key = String(body.key ?? '').trim();
  if (!key) return NextResponse.json({ error: 'missing_key' }, { status: 400 });
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) {
    return NextResponse.json({ error: 'invalid_key_format', hint: 'lowercase snake_case, 2-64 chars' }, { status: 400 });
  }
  if (!String(body.display_name ?? '').trim()) return NextResponse.json({ error: 'missing_display_name' }, { status: 400 });
  if (!String(body.base_prompt ?? '').trim())  return NextResponse.json({ error: 'missing_base_prompt'  }, { status: 400 });

  const tier = String(body.default_target_tier ?? 'tier_social_pool');
  if (!ALLOWED_TIERS.has(tier)) {
    return NextResponse.json({ error: 'tier_not_allowed_for_ai', allowed: [...ALLOWED_TIERS] }, { status: 400 });
  }

  const payload = {
    key,
    display_name: String(body.display_name).trim(),
    base_prompt:  String(body.base_prompt).trim(),
    default_target_tier: tier,
    example_hint: String(body.example_hint ?? '').trim() || null,
    active: body.active === false ? false : true,
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100,
    property_id: body.property_id ? String(body.property_id) : null,
    updated_by: String(body.updated_by ?? 'settings_ui'),
  };

  try {
    const { data, error } = await sb.rpc('fn_ai_prompt_category_upsert', { p: payload });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, key: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
