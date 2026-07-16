// app/api/mail/modify/route.ts
// PBS 2026-07-15 · Item 6 — generic Gmail label modify endpoint (add/remove labels).
// POST body: { messageId: string, add?: string[], remove?: string[] }
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, modifyLabelsForUser } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  let body: { messageId?: string; add?: string[]; remove?: string[] } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const messageId = (body.messageId || '').trim();
  if (!messageId) return NextResponse.json({ ok: false, error: 'missing_message_id' }, { status: 400 });
  const add = Array.isArray(body.add) ? body.add.filter((s) => typeof s === 'string') : [];
  const remove = Array.isArray(body.remove) ? body.remove.filter((s) => typeof s === 'string') : [];
  try {
    await modifyLabelsForUser(user.id, messageId, add, remove);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'modify_failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
