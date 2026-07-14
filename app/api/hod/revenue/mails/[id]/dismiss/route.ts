// app/api/hod/revenue/mails/[id]/dismiss/route.ts
// POST — apply the hidden HOD-DISMISSED Gmail label on the SHARED mailbox.
// Auth required — shared token is used for the label write.
// PBS 2026-07-14.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { logSharedMailboxEvent } from '@/lib/sharedGmail';
import { ensureHodDismissLabelId, modifyLabelsShared } from '@/lib/hodRevenueMail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const labelId = await ensureHodDismissLabelId();
    await modifyLabelsShared(id, [labelId], []);
    logSharedMailboxEvent({
      user_id: user.id, user_email: user.email,
      action: 'dismiss', thread_id: id, mailbox_alias: 'rm',
      metadata: { queue: 'hod_revenue' },
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'dismiss_failed' }, { status: 500 });
  }
}
