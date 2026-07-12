// app/api/marketing/media/ai-accept/route.ts
// POST — mark an ai_generation as accepted and mint a media.media_assets row.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { generation_id, candidate_path } = body || {};
  if (!generation_id || !candidate_path) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

  try {
    // Pull the source generation row (via bridge)
    const { data: gen, error: genErr } = await sb.from('v_ai_generations').select('*').eq('id', generation_id).maybeSingle();
    if (genErr || !gen) return NextResponse.json({ error: 'generation_not_found', detail: genErr?.message }, { status: 404 });

    // Insert into media.media_assets via schema-scoped client.
    // PBS 2026-07-12: sha256 is NOT NULL on media.media_assets. AI-generated PNGs don't have
    // a source-file hash we can compute (they live in storage as opaque blobs), so we synthesize
    // a stable hex hash from generation_id + candidate_path — always unique per generation.
    const syntheticSha256 = crypto.createHash('sha256').update(generation_id + ':' + candidate_path).digest('hex');

    const insertPayload = {
      property_id: gen.property_id,
      sha256: syntheticSha256,
      original_filename: candidate_path.split('/').pop() ?? candidate_path,
      asset_type: 'photo',
      mime_type: 'image/png',
      master_path: candidate_path,
      status: 'ready',
      primary_tier: gen.target_tier,
      is_ai_generated: true,
      gen_prompt: gen.effective_prompt ?? gen.prompt,
      gen_engine: gen.engine,
      gen_seed: null,
      accepted_by: 'PBS',
      accepted_at: new Date().toISOString(),
    };
    const { data: asset, error: insErr } = await sb
      .schema('media')
      .from('media_assets')
      .insert(insertPayload)
      .select('asset_id')
      .single();
    if (insErr || !asset) return NextResponse.json({ error: 'asset_insert_failed', detail: insErr?.message }, { status: 500 });

    // Flip the ai_generation row to accepted + link chosen_asset_id
    const { error: updErr } = await sb
      .schema('media')
      .from('ai_generations')
      .update({ status: 'accepted', chosen_asset_id: asset.asset_id })
      .eq('id', generation_id);
    if (updErr) return NextResponse.json({ error: 'gen_update_failed', asset_id: asset.asset_id, detail: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, asset_id: asset.asset_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
