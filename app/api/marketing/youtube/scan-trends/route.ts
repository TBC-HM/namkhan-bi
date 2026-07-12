// app/api/marketing/youtube/scan-trends/route.ts
// PBS 2026-07-11 pm — Phase A2 stub. Real trend scan handler ships in phase B.
// Uses fn_yt_insert_stub_brief RPC + direct cockpit_tickets insert (public).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SEED_KEYWORDS = ['retreat','wellness','luang prabang','laos boat','riverside dining','art suite'];

async function readPropertyId(req: Request): Promise<number> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      const j = await req.json() as { property_id?: number | string };
      const n = Number(j.property_id);
      if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    } catch { /* fall through */ }
  } else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    try {
      const fd = await req.formData();
      const raw = fd.get('property_id');
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    } catch { /* fall through */ }
  }
  return 260955;
}

function isRedirectExpected(req: Request): boolean {
  const ct = req.headers.get('content-type') ?? '';
  const accept = req.headers.get('accept') ?? '';
  return ct.includes('application/x-www-form-urlencoded')
      || ct.includes('multipart/form-data')
      || accept.includes('text/html');
}

export async function POST(req: Request) {
  const wantRedirect = isRedirectExpected(req);
  const propertyId = await readPropertyId(req);
  const sb = getSupabaseAdmin();

  const { data: briefId, error: bErr } = await sb.rpc('fn_yt_insert_stub_brief', {
    p_property_id: propertyId,
    p_seeds:       SEED_KEYWORDS,
  });

  if (bErr || !briefId) {
    return NextResponse.json({ ok: false, error: 'brief_insert_failed', detail: bErr?.message }, { status: 500 });
  }

  const { data: ticketRow, error: tErr } = await sb
    .from('cockpit_tickets')
    .insert({
      source:         'pbs_request',
      arm:            'youtube_pipeline',
      intent:         'scan_trends',
      status:         'open',
      parsed_summary: `Trend scan requested · seeds: ${SEED_KEYWORDS.join(', ')}`,
      notes:          `Placeholder brief created. Real trend-scout handler pending phase B.\nBrief id: ${briefId}`,
      metadata:       { property_id: propertyId, brief_id: briefId, requested_by_role: 'marketing_hod' },
      project_id:     propertyId,
    })
    .select('id')
    .single();

  const ticketId = tErr ? null : ticketRow?.id ?? null;

  if (wantRedirect) {
    const back = new URL('https://namkhan-bi.vercel.app/marketing/youtube/planning');
    back.searchParams.set('scanned', '1');
    back.searchParams.set('brief', String(briefId));
    if (ticketId) back.searchParams.set('ticket', String(ticketId));
    return NextResponse.redirect(back.toString(), 303);
  }

  return NextResponse.json({ ok: true, brief_id: briefId, ticket_id: ticketId });
}
