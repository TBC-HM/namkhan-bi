// app/api/mail/bulk-mark-read/route.ts
// PBS 2026-07-15 · Item 1 — bulk mark-as-read for the Forwarded rail.
// POST body: { query: string }
// Iterates Gmail messages matching `query`, removes UNREAD label.
// Returns { ok: true, count: N }.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, listMessagesInLabel, modifyLabelsForUser } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  let body: { query?: string; label?: string; max?: number } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const q = (body.query || '').trim();
  if (!q) return NextResponse.json({ ok: false, error: 'missing_query' }, { status: 400 });
  const labelId = body.label || 'INBOX';
  const cap = Math.min(Number(body.max || 500), 500);

  let count = 0;
  let pageToken: string | undefined = undefined;
  try {
    while (count < cap) {
      const remaining = Math.min(50, cap - count);
      const page = await listMessagesInLabel(user.id, labelId, q, pageToken, remaining);
      const msgs = page.messages || [];
      if (msgs.length === 0) break;
      // Only unread messages need modification, but Gmail no-ops removing an absent label.
      await Promise.all(msgs.map((m) => modifyLabelsForUser(user.id, m.id, [], ['UNREAD']).catch(() => null)));
      count += msgs.length;
      pageToken = page.nextPageToken || undefined;
      if (!pageToken) break;
    }
    return NextResponse.json({ ok: true, count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'bulk_read_failed';
    return NextResponse.json({ ok: false, error: msg, count }, { status: 500 });
  }
}
