// app/api/marketing/subscribers/send-opt-in/route.ts
// POST { tokens: [{id, email, name, token}] }
// Sends via user's connected Gmail. Each message has a personalised magic-link
// to /subscriber/confirm/<token>. Rate-limited by simple sequential send.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, refreshIfExpired, sendMessage } from '@/lib/userGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Token { id: number; email: string; name: string | null; token: string }
interface Body { tokens?: Token[]; subject?: string }

const APP_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://namkhan-bi.vercel.app';

function buildBody(name: string | null, url: string): { html: string; plain: string } {
  const greeting = name ? 'Hello ' + name + ',' : 'Hello,';
  const plain = [
    greeting,
    '',
    'We would love to keep you in the loop with occasional stories from The Namkhan — a boutique retreat in Luang Prabang.',
    '',
    'Please confirm you want to receive our newsletter by clicking:',
    url,
    '',
    'If this was not you, ignore this email — you will not hear from us.',
    '',
    'With warmth,',
    'The Namkhan',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:Georgia,serif;color:#1B1B1B;background:#FFFFFF;padding:24px;max-width:560px;margin:0 auto;">
  <p>${greeting}</p>
  <p>We would love to keep you in the loop with occasional stories from <strong>The Namkhan</strong> — a boutique retreat in Luang Prabang.</p>
  <p>Please confirm you want to receive our newsletter:</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:#084838;color:#FFFFFF;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:14px;">Confirm subscription</a>
  </p>
  <p style="font-size:12px;color:#5A5A5A;">Or paste this link into your browser: <br/><span style="font-family:monospace;">${url}</span></p>
  <p style="font-size:12px;color:#5A5A5A;">If this was not you, ignore this email — you will not hear from us.</p>
  <p>With warmth,<br/>The Namkhan</p>
  </body></html>`;
  return { html, plain };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  const tokens = Array.isArray(b.tokens) ? b.tokens : [];
  if (!tokens.length) return NextResponse.json({ ok: false, error: 'no_tokens' }, { status: 400 });

  let access: string; let gmail: string;
  try {
    ({ access, gmail } = await refreshIfExpired(user.id));
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'gmail_not_connected · ' + (e instanceof Error ? e.message : 'unknown') }, { status: 400 });
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const display = typeof meta.full_name === 'string' && meta.full_name ? meta.full_name : 'The Namkhan';
  const from = display + ' <' + gmail + '>';
  const subject = b.subject || 'Please confirm your subscription to The Namkhan';

  let sent = 0; let failed = 0;
  const errors: string[] = [];
  for (const t of tokens.slice(0, 500)) {
    const url = APP_BASE.replace(/\/$/, '') + '/subscriber/confirm/' + encodeURIComponent(t.token);
    const { html, plain } = buildBody(t.name, url);
    try {
      await sendMessage(access, {
        from, to: t.email, subject, body_html: html, body_plain: plain,
      });
      sent++;
    } catch (e) {
      failed++;
      if (errors.length < 3) errors.push(t.email + ': ' + (e instanceof Error ? e.message : 'send_failed'));
    }
  }

  return NextResponse.json({ ok: true, sent, failed, errors });
}
