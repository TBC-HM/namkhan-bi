// app/api/media/finalize/route.ts
// Called by the upload page after a file has been uploaded to media-raw.
// Triggers the media-ingest Edge Function which extracts metadata, runs QC,
// and chains into media-tag (Claude Vision).
//
// Body: { asset_id }
// Returns: { ok: true } | { error }

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser } from '@/lib/currentUser';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user.role !== 'owner' && user.role !== 'gm') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { asset_id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { asset_id } = body;
  if (!asset_id) return NextResponse.json({ error: 'missing_asset_id' }, { status: 400 });

  // Invoke Edge Function — fire-and-forget style, don't block the user.
  // We catch the response but if the function takes too long we still return ok=true
  // (the asset will be visible as 'ingested' / 'needs_review' until tagging finishes).
  try {
    const { data, error } = await supabaseAdmin.functions.invoke('media-ingest', {
      body: { asset_id },
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, data }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'invoke_failed' }, { status: 500 });
  }
}
