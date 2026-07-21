// app/api/marketing/audience/subscriber-delete/route.ts
// POST — soft-delete a subscriber row. The AFTER DELETE trigger
// (tg_newsletter_subscribers_auto_blocklist_on_delete) inserts an
// email-type blocklist row automatically, so the email cannot re-enter.
// Only subscriber-source rows are supported (prospect delete = future work).
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const body = await req.json().catch(() => ({}));
  const raw = String(body?.audience_id ?? '');
  if (!raw.startsWith('subscriber:')) {
    return NextResponse.json({ ok: false, error: 'only subscriber rows can be deleted from this endpoint' }, { status: 400 });
  }
  const id = Number(raw.slice('subscriber:'.length));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: 'invalid audience_id' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_subscriber_delete', { p_id: id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  const res = data as any;
  if (!res?.ok) return NextResponse.json({ ok: false, error: res?.error ?? 'delete_failed' }, { status: 400 });
  return NextResponse.json({ ok: true, email: res.email });
}
