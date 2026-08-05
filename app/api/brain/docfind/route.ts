// app/api/brain/docfind/route.ts
// BRAIN v4 · registry search for the "point the brain at documents" picker.
// GET ?q=...&pid=<property_id> → fn_brain_docfind (owner tier — this surface is owner-only today).
// Session-gated by middleware; DB via service role.
//
// ADR-238 (finding #79): this route used to call fn_brain_docfind with NO p_property_id, which
// binds to the 4-arg overload — no property predicate at all — AND at 'legal_confidential', the
// highest tier. The picker therefore offered Namkhan + Donna + holding documents no matter which
// brain the operator was standing in. pid is now required-by-default: absent => holding (0),
// never "everything". pid=-1 asks for every property explicitly.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 3) return NextResponse.json({ ok: true, docs: [] });
  // ADR-238: absent pid resolves to holding (0), NOT to an unscoped full-corpus read.
  const pidRaw = req.nextUrl.searchParams.get('pid');
  const pidNum = pidRaw == null || pidRaw === '' ? 0 : Number(pidRaw);
  const pid = Number.isFinite(pidNum) ? (pidNum === -1 ? null : pidNum) : 0;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_brain_docfind', {
    p_q: q, p_max_sensitivity: 'legal_confidential', p_limit: 15, p_property_id: pid,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, docs: data ?? [] });
}
