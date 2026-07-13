// app/api/sales/mails/connect/route.ts
// GET → starts OAuth for a shared mailbox.
// Query: ?mailbox=book@thenamkhan.com&label=Booking
// Domain-guarded to *@thenamkhan.com.
import { NextRequest, NextResponse } from 'next/server';
import { buildSharedAuthUrl, signState, getCurrentAuthUser } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const mailbox = (req.nextUrl.searchParams.get('mailbox') ?? '').trim().toLowerCase();
  const label = (req.nextUrl.searchParams.get('label') ?? '').trim();
  if (!mailbox || !mailbox.endsWith('@thenamkhan.com')) {
    return NextResponse.json({ error: 'domain_not_allowed' }, { status: 400 });
  }
  const user = await getCurrentAuthUser();
  const state = signState({
    mailbox,
    label: label || mailbox.split('@')[0],
    connected_by: user?.id ?? null,
    ts: Date.now(),
  });
  const url = buildSharedAuthUrl(state, mailbox);
  return NextResponse.redirect(url);
}
