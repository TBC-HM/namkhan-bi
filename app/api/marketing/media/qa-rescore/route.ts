// app/api/marketing/media/qa-rescore/route.ts
// POST { asset_id } — re-run the media-qa-score edge fn for a single asset.
// Used by the "Re-score" button in AssetEditDrawer.
// PBS 2026-07-13 — v1 QA engine.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const asset_id: string = body?.asset_id;
  if (!asset_id || !UUID_RE.test(asset_id)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }

  try {
    const { data, error } = await admin.functions.invoke('media-qa-score', {
      body: { asset_id },
    });
    if (error) {
      return NextResponse.json({ error: 'qa_score_failed', detail: error.message ?? String(error) }, { status: 502 });
    }
    return NextResponse.json({ ok: true, result: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
