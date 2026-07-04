// app/api/newsletter/send-test/route.ts
// PBS 2026-07-04: send a test copy of a campaign to any email.
// Proxies to send-newsletter-test edge fn — RESEND_API_KEY stays in edge env,
// not Vercel. Cron token is pulled from Supabase vault via SECURITY DEFINER RPC.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const campaign_id = String(body?.campaign_id || '');
  const to_email    = String(body?.to_email    || '').trim().toLowerCase();
  const first_name  = String(body?.first_name  || '').trim();
  if (!campaign_id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email)) {
    return NextResponse.json({ ok: false, error: 'Enter a valid email address' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: tokenData } = await sb.rpc('fn_get_newsletter_cron_token');
  const cronToken: string = (tokenData as unknown as string) || '';

  const { data, error } = await sb.functions.invoke('send-newsletter-test', {
    body: { campaign_id, to_email, first_name },
    headers: cronToken ? { 'x-cron-token': cronToken } : undefined,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: (error as { message?: string })?.message || 'invoke_failed' },
      { status: 502 },
    );
  }
  return NextResponse.json(data);
}
