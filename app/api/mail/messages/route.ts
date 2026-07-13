// app/api/mail/messages/route.ts
// GET: list Gmail messages for the current user, filtered by label + query.
// Params: ?label=INBOX (default), &q=... (Gmail search syntax), &pageToken=..., &max=50
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, listMessagesInLabel } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const label = req.nextUrl.searchParams.get('label') || 'INBOX';
  const q = req.nextUrl.searchParams.get('q') || undefined;
  const pageToken = req.nextUrl.searchParams.get('pageToken') || undefined;
  const max = Number(req.nextUrl.searchParams.get('max') || '50');
  try {
    const data = await listMessagesInLabel(user.id, label, q, pageToken, Number.isFinite(max) ? max : 50);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'list_failed';
    if (msg === 'not_connected') return NextResponse.json({ ok: false, error: 'not_connected' }, { status: 404 });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
