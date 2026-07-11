// app/api/sop/proposals/delete/route.ts
// PBS 2026-07-11: Permanently DELETE a proposal row.
// Replaces the old "Skip" soft-delete pattern with hard removal.
//
// POST { id: number } → { ok }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { id?: number | string }

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    const id = Number(b.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { error } = await sb
      .schema('knowledge')
      .from('sop_proposals')
      .delete()
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
