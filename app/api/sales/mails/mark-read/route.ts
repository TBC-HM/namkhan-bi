// app/api/sales/mails/mark-read/route.ts
// POST { message_id, mailbox_id? }
// Uses the current user's Gmail token — mailbox_id is retained for UI parity
// but not needed for the label mutation (Gmail labels live on the message,
// not the alias).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { modifyLabels } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  let body: { message_id?: string; mailbox_id?: string };
  try { body = (await req.json()) as { message_id?: string; mailbox_id?: string }; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { message_id } = body;
  if (!message_id) return NextResponse.json({ error: 'missing_message_id' }, { status: 400 });
  try {
    await modifyLabels(user.id, message_id, [], ['UNREAD']);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'mark_read_failed', detail: msg }, { status: 500 });
  }
}
