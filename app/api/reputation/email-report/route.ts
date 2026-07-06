// app/api/reputation/email-report/route.ts
// PBS 2026-07-06: Routes through Supabase edge fn `send-report-email` which has the
// RESEND_API_KEY env access (same as the newsletter engine). Auth via NEWSLETTER_CRON_TOKEN
// pulled from Supabase Vault.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Req {
  to: string;
  subject: string;
  text: string;
  html_bullets: string[];
}

export async function POST(req: Request) {
  let body: Req;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  if (!body.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  // Auth token for the shared secret between Next.js and the edge fn.
  const { data: tokenData } = await sb.rpc('fn_read_vault_secret', { p_name: 'newsletter_cron_token' });
  const sharedSecret = tokenData ? String(tokenData) : '';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kpenyneooigsyuuomgct.supabase.co';
  const edgeUrl = `${supabaseUrl}/functions/v1/send-report-email`;

  const res = await fetch(edgeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-shared-secret': sharedSecret,
    },
    body: JSON.stringify({
      to: body.to,
      subject: body.subject,
      text: body.text,
      html_bullets: body.html_bullets,
    }),
  });

  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: j?.error ?? 'send_failed', detail: j }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: j.id });
}