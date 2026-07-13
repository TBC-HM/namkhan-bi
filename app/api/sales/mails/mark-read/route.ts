// app/api/sales/mails/mark-read/route.ts
// POST { mailbox_id, message_id }
import { NextRequest, NextResponse } from 'next/server';
import { refreshIfExpired, modifyLabels } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { mailbox_id?: string; message_id?: string };
  try { body = (await req.json()) as { mailbox_id?: string; message_id?: string }; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { mailbox_id, message_id } = body;
  if (!mailbox_id || !message_id) return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  try {
    const { access } = await refreshIfExpired(mailbox_id);
    await modifyLabels(access, message_id, [], ['UNREAD']);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'mark_read_failed', detail: msg }, { status: 500 });
  }
}
