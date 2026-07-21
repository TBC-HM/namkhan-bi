// app/api/marketing/prospects/stats/route.ts
// GET — live count tiles for the Scrape Engine sub-tab.
// Reads from v_marketing_prospects_directory (single source, no cache).
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const nowIso = new Date().toISOString();
  const l30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [totalR, emailR, mxR, contactedR, contactedL30R, lastR] = await Promise.all([
    sb.from('v_marketing_prospects_directory').select('*', { count: 'exact', head: true }),
    sb.from('v_marketing_prospects_directory').select('*', { count: 'exact', head: true }).not('email', 'is', null),
    sb.from('v_marketing_prospects_directory').select('*', { count: 'exact', head: true }).eq('mx_valid', true),
    sb.from('v_marketing_prospects_directory').select('*', { count: 'exact', head: true }).not('last_email_open_at', 'is', null),
    sb.from('v_marketing_prospects_directory').select('*', { count: 'exact', head: true }).gte('last_email_open_at', l30),
    sb.from('v_marketing_prospects_directory').select('created_at').order('created_at', { ascending: false }).limit(1),
  ]);

  const stats = {
    total: totalR.count ?? 0,
    with_email: emailR.count ?? 0,
    mx_valid: mxR.count ?? 0,
    contacted: contactedR.count ?? 0,
    contacted_l30: contactedL30R.count ?? 0,
    last_ingest_at: lastR.data?.[0]?.created_at ?? null,
    generated_at: nowIso,
  };

  return NextResponse.json({ ok: true, stats });
}
