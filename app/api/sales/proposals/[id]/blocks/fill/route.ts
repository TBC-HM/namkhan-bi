// app/api/sales/proposals/[id]/blocks/fill/route.ts
// PBS 2026-07-16 — "Fill from Property Settings" per block.
// Body: { block_id: string, block_type: 'room'|'activity'|'facility'|..., ref_id?: string|number }
// Behaviour:
//   - room     → pull display_name + short_pitch + long_description + size_sqm + bed_config
//                from public.v_room_catalog, also pick hero asset from
//                public.v_proposal_photo_library room_type_id match (marketing_score DESC).
//   - activity → pull name + description + duration_min + price_amount from
//                public.v_activity_catalog_full, also pick hero asset.
//   - facility → hero asset only (no facility catalog view yet; PBS to seed).
//   - fnb/spa/transfer/note → hero asset only (fallback by property_area).
//
// Returns the resulting patch + selected hero asset_id so the client can updateBlock().

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }
interface Body {
  block_id: string;
  block_type: 'room' | 'activity' | 'facility' | 'fnb' | 'spa' | 'transfer' | 'note';
  ref_id?: string | number | null;
}

const TIER_OK = ['tier_ota_profile', 'tier_website_hero'];

async function pickHero(sb: ReturnType<typeof getSupabaseAdmin>, propertyId: number, blockType: string, refId: string | number | null | undefined): Promise<string | null> {
  let q = sb
    .from('v_proposal_photo_library')
    .select('asset_id')
    .eq('property_id', propertyId)
    .overlaps('target_usage_tiers', TIER_OK)
    .order('marketing_score', { ascending: false, nullsFirst: false })
    .limit(1);

  if (refId != null) {
    switch (blockType) {
      case 'room':     q = q.eq('room_type_id', Number(refId)); break;
      case 'activity': q = q.eq('activity_id',  Number(refId)); break;
      case 'facility': q = q.eq('facility_id',  Number(refId)); break;
    }
  } else {
    switch (blockType) {
      case 'activity': q = q.eq('property_area', 'activity'); break;
      case 'facility': q = q.eq('property_area', 'facility'); break;
      case 'fnb':      q = q.in('property_area', ['restaurant','bar','dining','fnb']); break;
      case 'spa':      q = q.eq('property_area', 'spa'); break;
      case 'transfer': q = q.in('property_area', ['transport','boat','tuktuk','car']); break;
    }
  }
  const { data } = await q.maybeSingle();
  return (data as { asset_id?: string } | null)?.asset_id ?? null;
}

export async function POST(req: Request, { params }: Ctx) {
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_body' }, { status: 400 }); }
  if (!body.block_id) return NextResponse.json({ error: 'block_id_required' }, { status: 400 });
  if (!body.block_type) return NextResponse.json({ error: 'block_type_required' }, { status: 400 });

  const sb = getSupabaseAdmin();

  // resolve property_id from the proposal
  const { data: prop } = await sb.schema('sales')
    .from('proposals')
    .select('property_id')
    .eq('id', params.id)
    .maybeSingle();
  const propertyId = Number((prop as { property_id?: number } | null)?.property_id ?? 260955);

  const patch: Record<string, unknown> = {};
  let filled: Record<string, unknown> = {};

  if (body.block_type === 'room' && body.ref_id != null) {
    const { data: room } = await sb
      .from('v_room_catalog')
      .select('display_name, short_pitch, long_description, size_sqm, bed_config, max_occupancy')
      .eq('property_id', propertyId)
      .eq('room_type_id', Number(body.ref_id))
      .maybeSingle();
    if (room) {
      const r = room as { display_name: string; short_pitch: string | null; long_description: string | null; size_sqm: number | null; bed_config: string | null; max_occupancy: number | null };
      patch.label = r.display_name;
      const bits: string[] = [];
      if (r.size_sqm)      bits.push(`${r.size_sqm} sqm`);
      if (r.bed_config)    bits.push(String(r.bed_config));
      if (r.max_occupancy) bits.push(`sleeps ${r.max_occupancy}`);
      const meta = bits.join(' · ');
      const desc = r.short_pitch ?? r.long_description ?? '';
      patch.note = [meta, desc].filter(Boolean).join(' — ').slice(0, 480);
      filled = { ...r };
    }
  } else if (body.block_type === 'activity' && body.ref_id != null) {
    const { data: act } = await sb
      .from('v_activity_catalog_full')
      .select('name, description, duration_min, price_amount, price_currency, price_includes_vat_service')
      .eq('property_id', propertyId)
      .eq('activity_id', Number(body.ref_id))
      .maybeSingle();
    if (act) {
      const a = act as { name: string; description: string | null; duration_min: number | null; price_amount: number | null; price_currency: string | null; price_includes_vat_service: boolean | null };
      patch.label = a.name;
      const bits: string[] = [];
      if (a.duration_min) bits.push(`${a.duration_min} min`);
      if (a.price_amount) bits.push(`${a.price_amount} ${a.price_currency ?? 'LAK'}${a.price_includes_vat_service ? ' (incl VAT+service)' : ''}`);
      patch.note = [bits.join(' · '), a.description ?? ''].filter(Boolean).join(' — ').slice(0, 480);
      filled = { ...a };
    }
  }

  // Always try to also pick a hero photo (unless block explicitly declines).
  const heroAssetId = await pickHero(sb, propertyId, body.block_type, body.ref_id ?? null);
  if (heroAssetId) patch.hero_asset_id = heroAssetId;

  // Persist the patch.
  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await sb.schema('sales').from('proposal_blocks').update(patch).eq('id', body.block_id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, patch, hero_asset_id: heroAssetId, filled });
}
