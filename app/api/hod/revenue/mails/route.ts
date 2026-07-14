// app/api/hod/revenue/mails/route.ts
// GET — list up to `max` messages from Mai Vo (rm@thenamkhan.com) in the
// SHARED mailbox (pb@thenamkhan.com), excluding those already marked
// HOD-DISMISSED. Auth required — but the token used is the shared token,
// not the user's personal one.
// PBS 2026-07-14.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { logSharedMailboxEvent } from '@/lib/sharedGmail';
import { RM_GMAIL_Q, listSharedMessagesByQuery } from '@/lib/hodRevenueMail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const url = new URL(req.url);
  const max = Math.max(1, Math.min(50, Number(url.searchParams.get('max') ?? '30')));
  try {
    const rows = await listSharedMessagesByQuery(RM_GMAIL_Q, max);
    logSharedMailboxEvent({
      user_id: user.id, user_email: user.email,
      action: 'view', mailbox_alias: 'rm',
      metadata: { queue: 'hod_revenue', count: rows.length },
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
