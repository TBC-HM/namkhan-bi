// app/api/sales/mails/star/route.ts
// POST { mailbox_id, message_id, action: 'star' | 'unstar' }
import { NextRequest, NextResponse } from 'next/server';
import { refreshIfExpired, modifyLabels } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { mailbox_id?: string; message_id?: string; action?: string };
  try { body = (await req.json()) as { mailbox_id?: string; message_id?: string; action?: string }; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { mailbox_id, message_id, action } = body;
  if (!mailbox_id || !message_id || (action !== 'star' && action !== 'unstar')) {
    return NextResponse.json({ error: 'missing_or_invalid_params' }, { status: 400 });
  }
  try {
    const { access } = await refreshIfExpired(mailbox_id);
    if (action === 'star') await modifyLabels(access, message_id, ['STARRED'], []);
    else                    await modifyLabels(access, message_id, [], ['STARRED']);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'star_failed', detail: msg }, { status: 500 });
  }
}
