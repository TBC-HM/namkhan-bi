// app/api/sales/mails/inbox/route.ts
// GET → unified shared-mailbox inbox.
// Query: ?mailbox_id=<uuid>&unread=true&q=<search>&limit=50
// Empty mailbox_id → aggregate across ALL active shared mailboxes.
import { NextRequest, NextResponse } from 'next/server';
import { listInboxAcross } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const mailbox_id = req.nextUrl.searchParams.get('mailbox_id') || undefined;
  const unread = req.nextUrl.searchParams.get('unread') === 'true';
  const q = req.nextUrl.searchParams.get('q') || undefined;
  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;

  try {
    const threads = await listInboxAcross({ mailbox_id, unread, q, limit });
    return NextResponse.json({ threads });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'inbox_failed', detail: msg }, { status: 500 });
  }
}
