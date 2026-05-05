// app/api/docs/search/route.ts
// GET /api/docs/search?q=...&type=...&importance=...&party=...&year=...&lim=50
// Wraps the public.docs_search() RPC with the admin client (bypasses RLS so the
// portal — which runs anon-only with a password gate — can show all docs).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const { searchParams } = new URL(req.url);
  const q          = searchParams.get('q') || '';
  const type       = searchParams.get('type') || null;
  const importance = searchParams.get('importance') || null;
  const party      = searchParams.get('party') || null;
  const yearStr    = searchParams.get('year');
  const year       = yearStr ? parseInt(yearStr) : null;
  const limStr     = searchParams.get('lim');
  const lim        = limStr ? Math.min(200, parseInt(limStr)) : 50;

  const { data, error } = await admin.rpc('docs_search', {
    q, filter_type: type, filter_importance: importance,
    filter_party: party, filter_year: year, lim,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, results: data || [], count: data?.length || 0 });
}
