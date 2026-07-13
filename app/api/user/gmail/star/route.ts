// app/api/user/gmail/star/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, refreshIfExpired, modifyLabels } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { message_id?: string; action?: 'add' | 'remove' };
  if (!body.message_id) return NextResponse.json({ error: 'missing_message_id' }, { status: 400 });
  const add = body.action !== 'remove';
  try {
    const { access } = await refreshIfExpired(user.id);
    await modifyLabels(access, body.message_id, add ? ['STARRED'] : [], add ? [] : ['STARRED']);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: 'star_failed', detail: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
