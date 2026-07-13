// app/api/sales/mails/inbox/route.ts
// GET → unified shared-mailbox inbox for the CURRENT USER's Gmail token.
// Query: ?mailbox_id=<uuid>&unread=true&q=<search>&limit=50
// Empty mailbox_id → aggregate across ALL active shared aliases.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { listSharedInbox, listActiveMailboxes, getMailboxById } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const mailbox_id = req.nextUrl.searchParams.get('mailbox_id') || '';
  const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true';
  const q = req.nextUrl.searchParams.get('q') || undefined;
  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;

  try {
    let mailboxes;
    if (mailbox_id) {
      const one = await getMailboxById(mailbox_id);
      mailboxes = one ? [one] : [];
    } else {
      mailboxes = await listActiveMailboxes();
    }
    const threads = await listSharedInbox(user.id, mailboxes, { unreadOnly, q, limit });
    return NextResponse.json({ threads });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'inbox_failed', detail: msg }, { status: 500 });
  }
}
