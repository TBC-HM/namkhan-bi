// app/api/sales/mails/star/route.ts
// POST { message_id, action: 'star' | 'unstar', mailbox_id? }
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { modifyLabels } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  let body: { message_id?: string; action?: string; mailbox_id?: string };
  try { body = (await req.json()) as { message_id?: string; action?: string; mailbox_id?: string }; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { message_id, action } = body;
  if (!message_id || (action !== 'star' && action !== 'unstar')) {
    return NextResponse.json({ error: 'missing_or_invalid_params' }, { status: 400 });
  }
  try {
    if (action === 'star') await modifyLabels(user.id, message_id, ['STARRED'], []);
    else                    await modifyLabels(user.id, message_id, [], ['STARRED']);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: 'star_failed', detail: msg }, { status: 500 });
  }
}
