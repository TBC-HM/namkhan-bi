// app/api/sales/mails/disconnect/route.ts
// POST { mailbox_id } — deactivates the ALIAS row (not any OAuth token).
// The per-user Gmail connection stays intact.
// PBS 2026-08-14: now enforces getUserMailboxById permission check.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getUserMailboxById } from '@/lib/sharedGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  
  let body: { mailbox_id?: string };
  try { body = (await req.json()) as { mailbox_id?: string }; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { mailbox_id } = body;
  if (!mailbox_id) return NextResponse.json({ error: 'missing_mailbox_id' }, { status: 400 });
  
  // Permission check: user must have access to this mailbox
  const mailbox = await getUserMailboxById(user.id, mailbox_id);
  if (!mailbox) {
    return NextResponse.json({ error: 'mailbox_not_found_or_no_access' }, { status: 403 });
  }
  
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.rpc('fn_shared_mailbox_disconnect', { p_mailbox_id: mailbox_id });
    if (error) return NextResponse.json({ error: 'disconnect_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'disconnect_failed', detail: msg }, { status: 500 });
  }
}
