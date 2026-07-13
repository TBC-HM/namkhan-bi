// app/api/sales/mails/dismiss/route.ts
// POST { thread_ids: string[] } — batch dismiss shared-inbox threads that PBS
// reviewed and does NOT want converted to a Lead. Each id is passed to the
// SECURITY DEFINER RPC public.fn_dismiss_mail_thread(text,text) via supabase
// admin. Idempotent by thread_id (ON CONFLICT DO NOTHING in DB layer).
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  thread_ids?: unknown;
  mailbox_alias_by_id?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const ids: string[] = Array.isArray(body.thread_ids)
    ? (body.thread_ids as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];
  if (ids.length === 0) return NextResponse.json({ error: 'thread_ids required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const aliasMap = body.mailbox_alias_by_id ?? {};
  const errors: Array<{ thread_id: string; error: string }> = [];
  let ok = 0;
  for (const tid of ids) {
    const p_mailbox_alias = aliasMap[tid] ?? null;
    const { error } = await sb.rpc('fn_dismiss_mail_thread', {
      p_thread_id: tid,
      p_mailbox_alias,
    });
    if (error) errors.push({ thread_id: tid, error: error.message });
    else ok += 1;
  }
  return NextResponse.json({ ok: true, dismissed: ok, failed: errors.length, errors });
}
