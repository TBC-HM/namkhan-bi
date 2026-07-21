// app/api/marketing/link-catalog/scrape-website/route.ts
// POST — trigger the scrape-website-links edge function to discover URLs on a
// property website and bulk-upsert them into internal_link_catalog (never
// overwrites pinned rows).
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const property_id = Number(body?.property_id ?? 260955);
  const base_url = String(body?.base_url ?? '').trim();
  if (!base_url) return NextResponse.json({ ok: false, error: 'base_url required' }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'supabase env not configured' }, { status: 500 });
  }
  const fnUrl = supabaseUrl.replace(/\/+$/, '') + '/functions/v1/scrape-website-links';
  const r = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ property_id, base_url }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return NextResponse.json({ ok: false, error: j?.error ?? `edge_${r.status}`, detail: j?.detail }, { status: 502 });
  return NextResponse.json({ ok: true, ...j });
}
