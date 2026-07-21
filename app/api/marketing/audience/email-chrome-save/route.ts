// app/api/marketing/audience/email-chrome-save/route.ts
// POST — upsert email header/footer chrome via fn_email_chrome_upsert RPC.
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const property_id = Number(body?.property_id);
  if (!Number.isFinite(property_id)) return NextResponse.json({ ok: false, error: 'property_id required' }, { status: 400 });

  const payload = (body?.payload ?? {}) as Record<string, unknown>;
  const { data, error } = await sb.rpc('fn_email_chrome_upsert', {
    p_property_id: property_id,
    p_payload: payload,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, result: data });
}
