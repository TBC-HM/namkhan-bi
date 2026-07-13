// app/api/user/gmail/inbox/route.ts
// GET: returns the current user's Gmail inbox (up to 15 threads).
// ?scope=unread (default) | all. 404 if the user isn't connected — the
// top-nav dropdown uses this as its silent "hide the icon" signal.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, refreshIfExpired, listInboxMessages } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const scope = (req.nextUrl.searchParams.get('scope') === 'all') ? 'all' : 'unread';
  try {
    const { access, gmail } = await refreshIfExpired(user.id);
    const messages = await listInboxMessages(access, scope, 15);
    return NextResponse.json({ gmail_address: gmail, scope, messages });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    if (msg === 'not_connected') return NextResponse.json({ error: 'not_connected' }, { status: 404 });
    return NextResponse.json({ error: 'inbox_failed', detail: msg }, { status: 500 });
  }
}
