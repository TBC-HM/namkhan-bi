// app/api/mail/message/[id]/attachment/[attachmentId]/route.ts
// PBS 2026-07-16 · Item 7 — download a Gmail attachment. Streams raw bytes
// with Content-Disposition: attachment so the browser saves it with the
// original filename.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, getAttachmentBytes } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const { id, attachmentId } = await ctx.params;
  try {
    const { data, mimeType, filename, size } = await getAttachmentBytes(user.id, id, attachmentId);
    // RFC 6266 · fallback ASCII + UTF-8 encoded filename for wide client support.
    const safe = filename.replace(/[^\w\.\-]+/g, '_');
    const enc = encodeURIComponent(filename);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'content-type': mimeType,
        'content-length': String(size),
        'content-disposition': 'attachment; filename="' + safe + '"; filename*=UTF-8\'\'' + enc,
        'cache-control': 'private, no-store',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'attachment_failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
