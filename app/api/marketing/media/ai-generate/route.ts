// app/api/marketing/media/ai-generate/route.ts
// POST — invokes edge fn generate-media. Propagates edge-fn `{ok:false, error, reason}` as non-2xx.
// GET  ?id=… — returns a single v_ai_generations row for polling.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TIERS = new Set(['tier_social_pool', 'tier_internal']);

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { property_id, mode, prompt, target_tier, source_asset_id, category_key } = body || {};
  if (!property_id || !prompt || !mode) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  if (!['prompt', 'from_asset'].includes(mode)) return NextResponse.json({ error: 'bad_mode' }, { status: 400 });
  if (!ALLOWED_TIERS.has(target_tier)) return NextResponse.json({ error: 'tier_not_allowed_for_ai' }, { status: 400 });
  if (mode === 'from_asset' && !source_asset_id) return NextResponse.json({ error: 'missing_source_asset_id' }, { status: 400 });
  if (!category_key || typeof category_key !== 'string' || !category_key.trim()) {
    return NextResponse.json({ error: 'missing_category_key' }, { status: 400 });
  }

  try {
    const { data, error } = await sb.functions.invoke('generate-media', {
      body: {
        property_id, mode, prompt, target_tier,
        source_asset_id: source_asset_id ?? null,
        category_key: String(category_key).trim(),
      },
    });

    // Supabase-js sets `error` on non-2xx responses OR on network failures.
    // Try to surface the edge fn body (which contains reason + generation_id) either way.
    if (error) {
      let bodyText = '';
      const anyErr = error as any;
      if (anyErr?.context?.text) { try { bodyText = await anyErr.context.text(); } catch {} }
      let parsed: any = null;
      try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch { /* ignore */ }
      const msg = (parsed?.error) ?? (anyErr?.message ?? String(error));
      if (/OPENAI_IMAGE_KEY/i.test(msg) || /openai_key_missing/i.test(msg)) {
        return NextResponse.json({ error: 'openai_key_missing_in_vault', reason: parsed?.reason ?? null }, { status: 503 });
      }
      return NextResponse.json({
        error: msg,
        reason: parsed?.reason ?? null,
        generation_id: parsed?.generation_id ?? null,
      }, { status: 502 });
    }

    // 2xx from the edge fn — but the fn may still have set ok:false in the body.
    if (data && typeof data === 'object' && (data as any).ok === false) {
      const err = String((data as any).error ?? 'edge_fn_returned_ok_false');
      return NextResponse.json({
        error: err,
        reason: (data as any).reason ?? null,
        generation_id: (data as any).generation_id ?? null,
      }, { status: 502 });
    }

    return NextResponse.json(data ?? {});
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  try {
    const { data, error } = await sb.from('v_ai_generations').select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
