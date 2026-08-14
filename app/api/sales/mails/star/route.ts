// app/api/sales/mails/star/route.ts
// POST { message_id, action: 'star' | 'unstar', mailbox_id? }
// PBS 2026-08-14: now enforces fn_shared_mailbox_list_active membership.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { modifyLabels, listUserMailboxes } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  // Permission gate: user must have access to at least one mailbox
  const allowedMailboxes = await listUserMailboxes(user.id);
  if (allowedMailboxes.length === 0) {
    return NextResponse.json({ error: 'no_mailbox_access' }, { status: 403 });
  }

  let body: { message_id?: string; action?: string; mailbox_id?: string };
  try { body = (await req.json()) as { message_id?: string; action?: string; mailbox_id?: string }; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { message_id, action } = body;
  if (!message_id || (action !== 'star' && action !== 'unstar')) {
    return NextResponse.json({ error: 'missing_or_invalid_params' }, { status: 400 });
  }
  try {
    if (action === 'star') await modifyLabels(user.id, message_id, ['STARRED'], []);
    else                    await modifyLabels(user.id, message_id, [], ['STARRED']);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'star_failed', detail: msg }, { status: 500 });
  }
}
