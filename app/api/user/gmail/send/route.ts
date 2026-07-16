// app/api/user/gmail/send/route.ts
// POST: send an email from the currently-signed-in user's Gmail. Builds
// a multipart/alternative RFC 2822 message and calls Gmail v1's send.
// If thread_id is provided, Gmail keeps the message in that thread.
// If in_reply_to is provided, we set In-Reply-To + References so external
// mail clients thread it correctly.
// PBS 2026-07-17 · accepts `attachments`: [{ url, name, content_type?, size? }].
//   We fetch each URL server-side, base64-encode it, and inline it as a
//   multipart/mixed part. Public URLs from bucket `mail-attachments` are
//   the primary use-case; media-library public URLs work too.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, refreshIfExpired } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AttachmentIn {
  url?: string;
  name?: string;
  content_type?: string;
}

interface Body {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body_html?: string;
  body_plain?: string;
  in_reply_to?: string;
  thread_id?: string;
  attachments?: AttachmentIn[];
}

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

function b64Url(input: string | Uint8Array): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64Std(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

// Split base64 into 76-char lines (RFC 2045).
function chunk76(s: string): string {
  return s.replace(/(.{76})/g, '$1\r\n');
}

async function fetchAttachment(a: AttachmentIn): Promise<{ name: string; contentType: string; bytes: Uint8Array }> {
  if (!a.url) throw new Error('attachment_missing_url');
  const r = await fetch(a.url);
  if (!r.ok) throw new Error('attachment_fetch_failed_' + r.status);
  const ct = a.content_type || r.headers.get('content-type') || 'application/octet-stream';
  const ab = await r.arrayBuffer();
  const name = (a.name || a.url.split('/').pop() || 'attachment').replace(/[\r\n"]/g, '_');
  return { name, contentType: ct.split(';')[0].trim(), bytes: new Uint8Array(ab) };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.to || !b.subject || !b.body_html) {
    return NextResponse.json({ error: 'missing_fields', detail: 'to, subject, body_html required' }, { status: 400 });
  }
  try {
    const { access, gmail } = await refreshIfExpired(user.id);
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const display = typeof meta.full_name === 'string' ? meta.full_name : gmail;
    const from = display + ' <' + gmail + '>';
    const plain = b.body_plain ?? b.body_html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
    const attachments = (b.attachments ?? []).filter((a) => a && a.url);
    const hasAtt = attachments.length > 0;
    const altBoundary = 'nmkbi_alt_' + Math.random().toString(36).slice(2, 10);
    const mixBoundary = 'nmkbi_mix_' + Math.random().toString(36).slice(2, 10);

    const headers: string[] = [
      'From: ' + from,
      'To: ' + b.to,
    ];
    if (b.cc) headers.push('Cc: ' + b.cc);
    if (b.bcc) headers.push('Bcc: ' + b.bcc);
    headers.push('Subject: ' + b.subject);
    if (b.in_reply_to) { headers.push('In-Reply-To: ' + b.in_reply_to); headers.push('References: ' + b.in_reply_to); }
    headers.push('MIME-Version: 1.0');
    headers.push('Content-Type: ' + (hasAtt ? 'multipart/mixed; boundary="' + mixBoundary + '"' : 'multipart/alternative; boundary="' + altBoundary + '"'));

    const altPart = [
      '--' + altBoundary,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      plain,
      '',
      '--' + altBoundary,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      b.body_html,
      '',
      '--' + altBoundary + '--',
      '',
    ].join('\r\n');

    let bodyBlock: string;
    if (!hasAtt) {
      bodyBlock = altPart;
    } else {
      const parts: string[] = [];
      parts.push('--' + mixBoundary);
      parts.push('Content-Type: multipart/alternative; boundary="' + altBoundary + '"');
      parts.push('');
      parts.push(altPart);
      for (const a of attachments) {
        try {
          const att = await fetchAttachment(a);
          parts.push('--' + mixBoundary);
          parts.push('Content-Type: ' + att.contentType + '; name="' + att.name + '"');
          parts.push('Content-Transfer-Encoding: base64');
          parts.push('Content-Disposition: attachment; filename="' + att.name + '"');
          parts.push('');
          parts.push(chunk76(b64Std(att.bytes)));
          parts.push('');
        } catch (e) {
          // Skip broken attachments; do not fail the whole send.
          // eslint-disable-next-line no-console
          console.warn('[gmail-send] attachment skipped', a.url, e instanceof Error ? e.message : e);
        }
      }
      parts.push('--' + mixBoundary + '--');
      parts.push('');
      bodyBlock = parts.join('\r\n');
    }

    const rfc = headers.join('\r\n') + '\r\n\r\n' + bodyBlock;
    const raw = b64Url(rfc);
    const sendBody: Record<string, unknown> = { raw };
    if (b.thread_id) sendBody.threadId = b.thread_id;

    const r = await fetch(GMAIL_API + '/users/me/messages/send', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' },
      body: JSON.stringify(sendBody),
    });
    if (!r.ok) throw new Error('gmail_send_failed_' + r.status + '_' + (await r.text()).slice(0, 200));
    const j = (await r.json()) as { id: string; threadId: string };
    return NextResponse.json({ ok: true, id: j.id, threadId: j.threadId });
  } catch (e: unknown) {
    return NextResponse.json({ error: 'send_failed', detail: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
