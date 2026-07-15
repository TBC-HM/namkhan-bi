// app/api/sales/proposals/[id]/route.ts
// PBS 2026-07-16 — DELETE proposal + soft-delete pattern via sb.schema('sales')
// (service role bypasses PostgREST public-only rule; matches lib/sales.ts style).
// Full delete (not soft) — PBS wants proposals to disappear from the list.
// If we later want undo, switch to `.update({ status: 'deleted' })` + filter.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
