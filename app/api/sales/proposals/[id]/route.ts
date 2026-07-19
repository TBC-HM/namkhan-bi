// app/api/sales/proposals/[id]/route.ts
// PBS 2026-07-16 — DELETE proposal + soft-delete pattern via sb.schema('sales')
// (service role bypasses PostgREST public-only rule; matches lib/sales.ts style).
// Full delete (not soft) — PBS wants proposals to disappear from the list.
// If we later want undo, switch to `.update({ status: 'deleted' })` + filter.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PBS 2026-07-19 · PATCH proposal fields (currently: header photo override).
// Extend the `patch` builder to accept more fields as needed.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = String(params.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    if ('header_hero_asset_id' in body) patch.header_hero_asset_id = body.header_hero_asset_id ?? null;
    if ('header_hero_hide' in body)     patch.header_hero_hide     = !!body.header_hero_hide;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'no valid fields' }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { error } = await sb.schema('sales').from('proposals').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = String(params.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    const sb = getSupabaseAdmin();
    // Cascade will clear proposal_versions / proposal_blocks / proposal_emails
    // via existing FKs (ON DELETE CASCADE was set at schema kickoff).
    const { error } = await sb.schema('sales').from('proposals').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
