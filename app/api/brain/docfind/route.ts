// app/api/brain/docfind/route.ts
// BRAIN v4 · registry search for the "point the brain at documents" picker.
// GET ?q=... → fn_brain_docfind (owner tier — this surface is owner-only today).
// Session-gated by middleware; DB via service role.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 3) return NextResponse.json({ ok: true, docs: [] });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_brain_docfind', {
    p_q: q, p_max_sensitivity: 'legal_confidential', p_limit: 15,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, docs: data ?? [] });
}
