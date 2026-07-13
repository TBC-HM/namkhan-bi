// app/api/hod/operations/mails/[id]/dismiss/route.ts
// POST — apply the SHARED hidden HOD-DISMISSED Gmail label to a single message.
// Idempotent — the label is created on the fly if missing.
// Same label as Revenue's panel — dismiss once, hide from both queues.
// PBS 2026-07-14.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, modifyLabelsForUser } from '@/lib/userGmail';
import { ensureHodDismissLabelId } from '@/lib/hodOperationsMail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const labelId = await ensureHodDismissLabelId(user.id);
    await modifyLabelsForUser(user.id, id, [labelId], []);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'dismiss_failed' }, { status: 500 });
  }
}
