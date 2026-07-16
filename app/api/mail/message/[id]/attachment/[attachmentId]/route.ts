// app/api/mail/message/[id]/attachment/[attachmentId]/route.ts
// PBS 2026-07-16 · Item 7 — download a Gmail attachment. Streams raw bytes
// with Content-Disposition: attachment so the browser saves it with the
// original filename.
//
// PBS 2026-07-16 (patch) · corrupted-download fix. Trust the decoded buffer
// length for content-length (Gmail's j.size can drift or be missing for some
// mime parts, and any mismatch causes the browser to truncate the file →
// "downloaded PDF won't open in Preview"). Pass the Buffer straight to
// NextResponse (Buffer is a valid BodyInit; the extra Uint8Array copy was
// unnecessary and one more place for byteOffset drift).
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
    const { data, mimeType, filename } = await getAttachmentBytes(user.id, id, attachmentId);
    const safe = filename.replace(/[^\w\.\-]+/g, '_');
    const enc = encodeURIComponent(filename);
    // PBS 2026-07-16 (tsc fix): TS 5.6 dom types tightened BodyInit. Copy the
    // Buffer bytes into a fresh ArrayBuffer (widely accepted BodyInit shape).
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    return new NextResponse(ab, {
      status: 200,
      headers: {
        'content-type': mimeType,
        'content-length': String(data.length),
        'content-disposition': 'attachment; filename="' + safe + '"; filename*=UTF-8\'\'' + enc,
        'cache-control': 'private, no-store',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'attachment_failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
