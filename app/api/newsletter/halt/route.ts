// app/api/newsletter/halt/route.ts
// PBS 2026-07-04: cancel all pending sends + revert campaign to draft.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const campaign_id = String(body?.campaign_id || '');
  if (!campaign_id) return NextResponse.json({ ok: false, error: 'campaign_id required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('guest').rpc('fn_halt_campaign', { p_campaign_id: campaign_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
