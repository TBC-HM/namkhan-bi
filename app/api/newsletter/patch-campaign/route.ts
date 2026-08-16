// app/api/newsletter/patch-campaign/route.ts
// Saves a refine result (subject + body_md) back to a draft campaign.
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const { campaign_id, property_id, subject, body_md } = await req.json().catch(() => ({}));
  if (!campaign_id || !subject || !body_md) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.schema('guest').from('campaigns')
    .update({ subject, body_md, updated_at: new Date().toISOString() })
    .eq('campaign_id', campaign_id)
    .eq('property_id', property_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
