// app/api/marketing/newsletter/retry-recipient/route.ts
// PBS 2026-07-22 · Retry a failed guest.campaign_recipients row.
// Delegates to public.fn_retry_campaign_recipient (SECURITY DEFINER).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { campaign_id?: string; email?: string };
    if (!body.campaign_id || !body.email) {
      return NextResponse.json({ ok: false, error: 'campaign_id and email required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_retry_campaign_recipient', {
      p_campaign_id: body.campaign_id,
      p_email: body.email,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: data === true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
