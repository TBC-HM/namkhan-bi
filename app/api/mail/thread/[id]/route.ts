// app/api/mail/thread/[id]/route.ts
// GET: full thread with all messages (oldest→newest).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, getThread } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const data = await getThread(user.id, id);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'thread_failed' }, { status: 500 });
  }
}
