// app/api/sop/proposals/mark/route.ts
// PBS 2026-07-08: Thin relay to public.fn_sop_proposal_mark(id, status, linked_sop_code).
// Used by /operations/qa/proposals to skip / restore / auto-mark on save.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  id:                number;
  status:            'proposed' | 'generated' | 'accepted' | 'skipped';
  linked_sop_code?:  string;
}

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    if (!b.id || !b.status) {
      return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_sop_proposal_mark', {
      p_id:              Number(b.id),
      p_status:          String(b.status),
      p_linked_sop_code: b.linked_sop_code ? String(b.linked_sop_code) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, row: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
