// app/api/marketing/newsletter-templates/save/route.ts
// POST — create or update a newsletter template via fn_newsletter_template_save RPC.
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

  if (!body?.template_key || typeof body.template_key !== 'string') {
    return NextResponse.json({ ok: false, error: 'template_key required' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_newsletter_template_save', {
    p_payload: body,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  const res = data as any;
  if (!res?.ok) return NextResponse.json({ ok: false, error: res?.error ?? 'save_failed' }, { status: 400 });
  return NextResponse.json({ ok: true, template_key: res.template_key });
}
