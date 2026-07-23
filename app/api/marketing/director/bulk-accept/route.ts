// app/api/marketing/director/bulk-accept/route.ts
// PBS 2026-07-21 pm (Newsletter Calendar v2): accept every un-linked slot in a
// date range (optionally filtered by group_slug). Wraps fn_director_bulk_approve
// which creates draft campaigns for every proposed/refined slot.
//
// Body: { property_id, from, to, group_slug?, schedule?: boolean }
// - schedule=false (default) → all created campaigns are drafts.
// - schedule=true → matches legacy Bulk-Approve behaviour (schedule at slot_date 10:00).
//
// PBS 2026-07-23: response now includes campaign_ids[] (the campaigns created
// by THIS call) so DirectorClient can auto-write each one via propose-one's
// campaign_id mode. Group-scoped path collects ids from the per-slot RPC;
// the global fn_director_bulk_approve path diffs linked_campaign_id before/after.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  property_id?: number;
  from?: string;
  to?: string;
  group_slug?: string | null;
  schedule?: boolean;
};

type SlotLite = { id: number; status: string; linked_campaign_id: string | null };

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const property_id = Number(body?.property_id);
  const from = String(body?.from || '').trim();
  const to = String(body?.to || '').trim();
  const group_slug = body?.group_slug ? String(body.group_slug) : null;
  const schedule = body?.schedule === true;

  if (!property_id || !from || !to) {
    return NextResponse.json({ ok: false, error: 'property_id + from + to required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  async function linkedIdsInRange(): Promise<Set<string>> {
    const { data } = await sb
      .from('v_director_calendar')
      .select('linked_campaign_id')
      .eq('property_id', property_id)
      .gte('slot_date', from).lte('slot_date', to)
      .not('linked_campaign_id', 'is', null);
    const out = new Set<string>();
    for (const r of (data as Array<{ linked_campaign_id: string | null }> | null) ?? []) {
      if (r.linked_campaign_id) out.add(r.linked_campaign_id);
    }
    return out;
  }

  // Group-scoped path: manual loop so we can filter by group_slug (fn_director_bulk_approve is group-agnostic).
  if (group_slug) {
    const { data: slots, error: loadErr } = await sb
      .from('v_director_calendar')
      .select('id, status, linked_campaign_id')
      .eq('property_id', property_id)
      .eq('group_slug', group_slug)
      .gte('slot_date', from).lte('slot_date', to);
    if (loadErr) return NextResponse.json({ ok: false, error: `load slots failed: ${loadErr.message}` }, { status: 500 });

    const eligible = (slots as SlotLite[] | null)
      ?.filter(s => !s.linked_campaign_id && (s.status === 'proposed' || s.status === 'refined')) ?? [];

    let accepted = 0;
    const campaign_ids: string[] = [];
    const errors: string[] = [];
    for (const s of eligible) {
      if (schedule) {
        const { data, error } = await sb.rpc('fn_director_slot_approve', { p_slot_id: s.id, p_scheduled_at: null });
        if (error) { errors.push(`slot ${s.id}: ${error.message}`); continue; }
        if (data) campaign_ids.push(String(data));
      } else {
        const { data, error } = await sb.rpc('fn_director_slot_accept', { p_slot_id: s.id });
        if (error) { errors.push(`slot ${s.id}: ${error.message}`); continue; }
        const cid = (data as { campaign_id?: string } | null)?.campaign_id;
        if (cid) campaign_ids.push(cid);
      }
      accepted++;
    }

    return NextResponse.json({
      ok: true,
      accepted_count: accepted,
      considered_count: eligible.length,
      campaign_ids,
      group_slug,
      errors,
    });
  }

  // No group filter: delegate to fn_director_bulk_approve (existing behaviour).
  // Collect the campaigns it created by diffing linked ids before/after.
  const before = await linkedIdsInRange();
  const { data, error } = await sb.rpc('fn_director_bulk_approve', {
    p_property_id: property_id,
    p_from: from, p_to: to,
    p_schedule: schedule,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const after = await linkedIdsInRange();
  const campaign_ids = Array.from(after).filter(id => !before.has(id));

  const count = (data as { approved_count?: number } | null)?.approved_count
    ?? (typeof data === 'number' ? data : 0);
  return NextResponse.json({
    ok: true,
    accepted_count: count,
    approved_count: count,
    campaign_ids,
    group_slug: null,
  });
}
