// app/api/sales/mails/dismiss/route.ts
// POST { thread_ids: string[], mailbox_alias_by_id?: {} } — batch dismiss
// shared-inbox threads. Runs against the SHARED mailbox token (via the
// public.fn_dismiss_mail_thread SECURITY DEFINER RPC on the DB side).
// Auth required — the actor's user_id is logged to
// marketing.shared_mailbox_events for accountability (fire-and-forget).
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { logSharedMailboxEvent } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  thread_ids?: unknown;
  mailbox_alias_by_id?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

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
    if (error) {
      errors.push({ thread_id: tid, error: error.message });
    } else {
      ok += 1;
      logSharedMailboxEvent({
        user_id: user.id, user_email: user.email,
        action: 'dismiss', thread_id: tid, mailbox_alias: p_mailbox_alias,
        metadata: { source: 'sales/mails' },
      });
    }
  }
  return NextResponse.json({ ok: true, dismissed: ok, failed: errors.length, errors });
}
