// app/api/marketing/media/ai-accept/route.ts
// POST — mark an ai_generation as accepted and mint a media.media_assets row.
// PBS 2026-07-11 pm: Rewritten to call fn_media_asset_accept_from_generation RPC.
// Root cause of previous asset_insert_failed loop: sb.schema('media').from(...)
// silently no-ops because PostgREST only exposes public. All writes to non-public
// schemas MUST go through SECURITY DEFINER RPCs per claude_md §0.5.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  let body: { generation_id?: string; candidate_path?: string; accepted_by?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { generation_id, candidate_path, accepted_by } = body || {};
  if (!generation_id || !candidate_path) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_media_asset_accept_from_generation', {
    p_generation_id: generation_id,
    p_candidate_path: candidate_path,
    p_accepted_by:   accepted_by ?? 'PBS',
  });

  if (error) {
    return NextResponse.json({
      error:  'asset_insert_failed',
      detail: error.message,
      code:   error.code,
      hint:   error.hint,
    }, { status: 500 });
  }
  return NextResponse.json({ ok: true, asset_id: data });
}
