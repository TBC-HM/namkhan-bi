// app/api/marketing/director/reject-slot/route.ts
// PBS 2026-07-21 pm (Newsletter Calendar v2): mark a director slot as 'skipped'
// without creating a campaign. Loads the slot then upserts (idempotent) with
// status='skipped'. Existing group_slug + parent_plan_run_id are preserved by
// the RPC's COALESCE guards.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slot_id = Number(body?.slot_id);
  if (!slot_id || !Number.isFinite(slot_id)) {
    return NextResponse.json({ ok: false, error: 'slot_id required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Load current slot to preserve required fields on the upsert.
  const { data: slot, error: loadErr } = await sb.from('v_director_calendar')
    .select('slot_date, audience_type, campaign_kind, goal_tag, title, subject, body_md, hero_asset_id, ctas, target_segments, ai_notes, property_id')
    .eq('id', slot_id).maybeSingle();
  if (loadErr) return NextResponse.json({ ok: false, error: loadErr.message }, { status: 500 });
  if (!slot) return NextResponse.json({ ok: false, error: `slot ${slot_id} not found` }, { status: 404 });

  const { data, error } = await sb.rpc('fn_director_slot_upsert', {
    p_property_id: slot.property_id,
    p_slot_date: slot.slot_date,
    p_audience_type: slot.audience_type,
    p_campaign_kind: slot.campaign_kind,
    p_goal_tag: slot.goal_tag,
    p_title: slot.title,
    p_subject: slot.subject,
    p_body_md: slot.body_md,
    p_hero_asset_id: slot.hero_asset_id,
    p_ctas: slot.ctas ?? [],
    p_target_segments: slot.target_segments ?? [],
    p_status: 'skipped',
    p_ai_notes: slot.ai_notes,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, slot_id: data ?? slot_id });
}
