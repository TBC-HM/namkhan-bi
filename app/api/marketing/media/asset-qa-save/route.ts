// app/api/marketing/media/asset-qa-save/route.ts
// POST { asset_id, technical, aesthetic, marketing, notes, model }
// Manual override entrypoint for the Edit-drawer "Save Scores" button.
// Wraps public.fn_media_asset_qa_score SECURITY DEFINER RPC.
// PBS 2026-07-14 — Media QA v2.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clamp(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const asset_id: string = body?.asset_id;
  if (!asset_id || !UUID_RE.test(asset_id)) {
    return NextResponse.json({ ok: false, error: 'asset_id must be a UUID' }, { status: 400 });
  }
  const technical = clamp(body?.technical);
  const aesthetic = clamp(body?.aesthetic);
  const marketing = clamp(body?.marketing);
  if (technical == null && aesthetic == null && marketing == null) {
    return NextResponse.json({ ok: false, error: 'at least one score required' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_media_asset_qa_score', {
    p_asset_id: asset_id,
    p_technical: technical,
    p_aesthetic: aesthetic,
    p_marketing: marketing,
    p_notes: body?.notes ?? { source: 'manual' },
    p_model: body?.model ?? 'manual',
    p_detected_text: null,
  });
  if (error) return NextResponse.json({ ok: false, error: 'rpc_failed', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
