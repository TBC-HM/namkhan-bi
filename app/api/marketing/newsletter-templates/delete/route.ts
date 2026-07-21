// app/api/marketing/newsletter-templates/delete/route.ts
// POST — delete a newsletter template via fn_newsletter_template_delete RPC.
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

  const template_key = String(body?.template_key ?? '').trim();
  const property_id = Number(body?.property_id ?? 260955);
  if (!template_key) return NextResponse.json({ ok: false, error: 'template_key required' }, { status: 400 });

  const { data, error } = await sb.rpc('fn_newsletter_template_delete', {
    p_template_key: template_key,
    p_property_id: property_id,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, result: data });
}
