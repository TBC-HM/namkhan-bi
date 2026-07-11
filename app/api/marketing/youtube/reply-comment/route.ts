// app/api/marketing/youtube/reply-comment/route.ts
// PBS 2026-07-11 pm — Post a reply on a YouTube comment thread.
import { NextResponse } from 'next/server';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { replyToComment } from '@/lib/youtube/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

interface Body {
  parent_comment_id?: string;
  video_id?: string;
  text?: string;
  property_id?: number;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const parentId = String(body.parent_comment_id ?? '').trim();
  const text     = String(body.text ?? '').trim();
  const propId   = Number(body.property_id ?? NAMKHAN);
  if (!parentId || !text) {
    return NextResponse.json({ ok: false, error: 'missing_parent_or_text' }, { status: 400 });
  }
  if (text.length > 10000) {
    return NextResponse.json({ ok: false, error: 'text_too_long' }, { status: 400 });
  }

  const tok = await getFreshAccessToken(propId);
  if (!tok.ok || !tok.access_token) {
    return NextResponse.json({ ok: false, error: tok.error ?? 'no_token', detail: tok.detail ?? null }, { status: 400 });
  }

  const r = await replyToComment(tok.access_token, parentId, text);
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error, detail: r.detail ?? null }, { status: 400 });
  }
  return NextResponse.json({ ok: true, comment: r.data });
}
