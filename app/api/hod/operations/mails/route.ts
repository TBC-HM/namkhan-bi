// app/api/hod/operations/mails/route.ts
// GET — list up to `max` messages from rom@thenamkhan.com in the SHARED
// mailbox (pb@thenamkhan.com), excluding HOD-DISMISSED. Auth required.
// PBS 2026-07-14.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { logSharedMailboxEvent } from '@/lib/sharedGmail';
import { listSharedMessagesByQuery } from '@/lib/hodRevenueMail';
import { ROM_GMAIL_Q } from '@/lib/hodOperationsMail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const url = new URL(req.url);
  const max = Math.max(1, Math.min(50, Number(url.searchParams.get('max') ?? '30')));
  try {
    const rows = await listSharedMessagesByQuery(ROM_GMAIL_Q, max);
    logSharedMailboxEvent({
      user_id: user.id, user_email: user.email,
      action: 'view', mailbox_alias: 'rom',
      metadata: { queue: 'hod_operations', count: rows.length },
    });
    return NextResponse.json({ ok: true, data: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'list_failed';
    if (msg.startsWith('gmail_401') || msg.startsWith('shared_source_not_connected')) {
      return NextResponse.json({ ok: false, error: 'shared_mailbox_not_connected' }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
