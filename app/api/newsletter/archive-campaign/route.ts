// app/api/newsletter/archive-campaign/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const { campaign_id } = await req.json().catch(() => ({}));
  if (!campaign_id) return NextResponse.json({ ok: false, error: 'campaign_id_required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.schema('guest').from('campaigns')
    .update({ archived_at: new Date().toISOString() })
    .eq('campaign_id', campaign_id)
    .is('archived_at', null);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
