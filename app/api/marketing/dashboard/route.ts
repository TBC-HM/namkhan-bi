// app/api/marketing/dashboard/route.ts
// Brief marketing-dashboard-v1 · optional JSON endpoint for other surfaces
// (cockpit, Make.com, mobile). GET /api/marketing/dashboard?pid=260955[&refresh=1]
//
// Deviation from the brief §7: uses getSupabaseAdmin() (this repo's server client) rather
// than the '@/lib/supabase/server' shim. Tenancy is enforced by requirePropertyAccess()
// before the RPC runs — pid from the query string is untrusted until it returns.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawPid = Number(url.searchParams.get('pid'));
  if (!Number.isFinite(rawPid)) {
    return NextResponse.json({ error: 'pid required' }, { status: 400 });
  }

  // requirePropertyAccess throws a Response (400/403) — surface it verbatim.
  let pid: number;
  try {
    pid = await requirePropertyAccess(req, rawPid);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data, error } = await getSupabaseAdmin().rpc('fn_mkt_dash_payload', {
    p_property_id: pid,
    // Same rule as the page: never trigger the ~17 s synchronous recompute.
    p_max_age_minutes: url.searchParams.get('refresh') === '1' ? 0 : 1440,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
