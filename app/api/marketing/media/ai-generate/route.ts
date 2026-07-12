// app/api/marketing/media/ai-generate/route.ts
// POST — invokes edge fn generate-media. Propagates edge-fn `{ok:false, error, reason}` as non-2xx.
// GET  ?id=… — returns a single v_ai_generations row for polling.
// 2026-07-12: forwards optional room_type_id / facility_id (per category.requires_context).
// 2026-07-12 pm: 3-field composer (Category · What · Where) enriches the prompt with
//   Settings data (activity / meeting-space / transport / where-facility). Edge fn already
//   handles room + facility via the legacy IDs; we just augment its prompt with the extra
//   entity blocks server-side so no edge-fn redeploy is needed.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TIERS = new Set([
  'tier_website_hero', 'tier_ota_profile', 'tier_social_pool',
  'tier_internal', 'tier_logos', 'tier_archive',
]);

type WhatKind = 'room' | 'facility' | 'activity' | 'meeting_space' | 'transport' | 'boat' | 'boat_cruise';

function joinNonEmpty(parts: Array<string | null | undefined>, sep = '. '): string {
  return parts.filter(p => typeof p === 'string' && p.trim().length > 0).join(sep);
}

function arrToStr(a: any): string {
  return Array.isArray(a) && a.length ? a.filter(Boolean).map(String).join(', ') : '';
}

function activityBlock(row: any, facilityName: string | null): string {
  if (!row) return '';
  const bits: string[] = [];
  bits.push(`SPECIFIC ACTIVITY: ${row.name}`);
  if (facilityName) bits.push(`held at ${facilityName}`);
  if (row.description) bits.push(`Description: ${String(row.description).slice(0, 400)}`);
  if (row.duration_min) bits.push(`Duration ~${row.duration_min} min`);
  if (row.price_amount) bits.push(`Price ${row.price_amount} ${row.price_currency ?? ''}`.trim());
  const seasons = arrToStr(row.available_season_codes);
  if (seasons) bits.push(`Seasons: ${seasons}`);
  if (row.service_time_from || row.service_time_to) bits.push(`Service hours ${row.service_time_from ?? '?'}–${row.service_time_to ?? '?'}`);
  if (row.age_restriction) bits.push(`Age: ${row.age_restriction}`);
  bits.push('Render this exact on-property activity — do not invent a generic version.');
  return joinNonEmpty(bits);
}

function transportBlock(row: any): string {
  if (!row) return '';
  const bits: string[] = [];
  const kind = row.transport_type ? ` (${row.transport_type})` : '';
  bits.push(`SPECIFIC TRANSPORT: ${row.name}${kind}`);
  if (row.route_from && row.route_to) bits.push(`Route: ${row.route_from} → ${row.route_to}`);
  if (row.distance_km) bits.push(`Distance ~${row.distance_km} km`);
  if (row.duration_min) bits.push(`Duration ~${row.duration_min} min`);
  if (row.capacity_pax) bits.push(`Capacity ${row.capacity_pax} pax`);
  if (row.description) bits.push(`Description: ${String(row.description).slice(0, 300)}`);
  bits.push('Render this exact vehicle/service in the correct route context.');
  return joinNonEmpty(bits);
}

function meetingSpaceBlock(row: any): string {
  if (!row) return '';
  const bits: string[] = [];
  bits.push(`SPECIFIC MEETING SPACE: ${row.name}`);
  const capacities = [
    row.meeting_capacity_theatre    ? `theatre ${row.meeting_capacity_theatre}`     : null,
    row.meeting_capacity_classroom  ? `classroom ${row.meeting_capacity_classroom}` : null,
    row.meeting_capacity_ushape     ? `U-shape ${row.meeting_capacity_ushape}`      : null,
    row.meeting_capacity_boardroom  ? `boardroom ${row.meeting_capacity_boardroom}` : null,
    row.meeting_capacity_banquet    ? `banquet ${row.meeting_capacity_banquet}`     : null,
    row.meeting_capacity_reception  ? `reception ${row.meeting_capacity_reception}` : null,
  ].filter(Boolean).join(', ');
  if (capacities) bits.push(`Capacities: ${capacities}`);
  if (row.meeting_location_tag) bits.push(`Location tag: ${row.meeting_location_tag}`);
  if (row.meeting_ceiling_height_m) bits.push(`Ceiling ${row.meeting_ceiling_height_m} m`);
  const kit: string[] = [];
  if (row.meeting_has_ac)           kit.push('AC');
  if (row.meeting_has_daylight)     kit.push('natural daylight');
  if (row.meeting_has_blackout)     kit.push('blackout');
  if (row.meeting_has_projector)    kit.push('projector');
  if (row.meeting_has_screen)       kit.push('screen');
  if (row.meeting_has_sound_system) kit.push('sound system');
  if (kit.length) bits.push(`AV/climate: ${kit.join(', ')}`);
  bits.push('Render this exact on-property meeting space with the correct setup.');
  return joinNonEmpty(bits);
}

function boatBlock(row: any): string {
  if (!row) return '';
  const bits: string[] = [];
  bits.push(`SPECIFIC VESSEL: ${row.name}`);
  if (row.model) bits.push(`Model: ${row.model}`);
  if (row.length_m) bits.push(`${row.length_m} m long`);
  if (row.engine_type) bits.push(`${row.engine_type}${row.engine_hp ? ` ${row.engine_hp} HP` : ''}`);
  if (row.top_speed_knots) bits.push(`Top speed ${row.top_speed_knots} kn`);
  if (row.capacity_pax) bits.push(`Capacity ${row.capacity_pax} pax`);
  const amenities = arrToStr(row.amenities);
  if (amenities) bits.push(`Onboard: ${amenities}`);
  if (row.home_port) bits.push(`Home port: ${row.home_port}`);
  if (row.description) bits.push(`Description: ${String(row.description).slice(0, 300)}`);
  bits.push('Render this exact vessel — do not substitute a generic boat.');
  return joinNonEmpty(bits);
}

function boatCruiseBlock(row: any, boatName: string | null): string {
  if (!row) return '';
  const bits: string[] = [];
  bits.push(`SPECIFIC CRUISE: ${row.name}`);
  if (boatName) bits.push(`aboard the ${boatName}`);
  if (row.cruise_type) bits.push(`Type: ${row.cruise_type}`);
  if (row.route_from && row.route_to) bits.push(`Route: ${row.route_from} → ${row.route_to}`);
  if (row.duration_min) bits.push(`Duration ~${row.duration_min} min`);
  if (row.capacity_pax) bits.push(`Capacity ${row.capacity_pax} pax`);
  if (row.price_amount) bits.push(`Price ${row.price_amount} ${row.price_currency ?? ''}`.trim());
  const seasons = arrToStr(row.available_season_codes);
  if (seasons) bits.push(`Seasons: ${seasons}`);
  if (row.description) bits.push(`Description: ${String(row.description).slice(0, 300)}`);
  bits.push('Render this exact cruise package aboard the exact vessel.');
  return joinNonEmpty(bits);
}

function whereFacilityBlock(row: any): string {
  if (!row) return '';
  const bits: string[] = [];
  bits.push(`WHERE — Facility "${row.name}"`);
  if (row.category) bits.push(`type: ${row.category}`);
  if (row.description) bits.push(String(row.description).slice(0, 250));
  return joinNonEmpty(bits, ' · ');
}

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const {
    property_id, mode, prompt, target_tier, source_asset_id, category_key,
    room_type_id, facility_id,
    what_kind, what_id, where_facility_id,
  } = body || {};
  if (!property_id || !prompt || !mode) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  if (!['prompt', 'from_asset'].includes(mode)) return NextResponse.json({ error: 'bad_mode' }, { status: 400 });
  if (!ALLOWED_TIERS.has(target_tier)) return NextResponse.json({ error: 'tier_not_allowed_for_ai' }, { status: 400 });
  if (mode === 'from_asset' && !source_asset_id) return NextResponse.json({ error: 'missing_source_asset_id' }, { status: 400 });
  if (!category_key || typeof category_key !== 'string' || !category_key.trim()) {
    return NextResponse.json({ error: 'missing_category_key' }, { status: 400 });
  }

  // === 3-field enrichment ===
  // Edge fn already enriches by room_type_id + facility_id + reality profile + category style.
  // We add server-side ENTITY blocks for the kinds it doesn't know about (activity, transport,
  // meeting_space specific fields, WHERE facility) and append them to the user's prompt.
  let promptSuffix = '';
  const kind = (what_kind && ['room','facility','activity','meeting_space','transport','boat','boat_cruise'].includes(what_kind)) ? (what_kind as WhatKind) : null;
  const whatIdNum = what_id ? Number(what_id) : null;
  const whereIdNum = where_facility_id ? Number(where_facility_id) : null;

  try {
    if (kind === 'activity' && whatIdNum) {
      const { data: act } = await sb.schema('property' as any).from('activities')
        .select('*').eq('activity_id', whatIdNum).eq('property_id', property_id).maybeSingle();
      let facName: string | null = null;
      if (act?.facility_id) {
        const { data: f } = await sb.schema('property' as any).from('facilities')
          .select('name').eq('facility_id', act.facility_id).maybeSingle();
        facName = f?.name ?? null;
      }
      const blk = activityBlock(act, facName);
      if (blk) promptSuffix += `\n\n${blk}`;
    }
    if (kind === 'transport' && whatIdNum) {
      const { data: trp } = await sb.schema('property' as any).from('transport_options')
        .select('*').eq('transport_id', whatIdNum).eq('property_id', property_id).maybeSingle();
      const blk = transportBlock(trp);
      if (blk) promptSuffix += `\n\n${blk}`;
    }
    if (kind === 'meeting_space' && whatIdNum) {
      const { data: fac } = await sb.schema('property' as any).from('facilities')
        .select('*').eq('facility_id', whatIdNum).eq('property_id', property_id).maybeSingle();
      const blk = meetingSpaceBlock(fac);
      if (blk) promptSuffix += `\n\n${blk}`;
    }
    if (kind === 'boat' && whatIdNum) {
      const { data: boat } = await sb.schema('property' as any).from('boats')
        .select('*').eq('boat_id', whatIdNum).eq('property_id', property_id).maybeSingle();
      const blk = boatBlock(boat);
      if (blk) promptSuffix += `\n\n${blk}`;
    }
    if (kind === 'boat_cruise' && whatIdNum) {
      const { data: cruise } = await sb.schema('property' as any).from('boat_cruises')
        .select('*').eq('cruise_id', whatIdNum).eq('property_id', property_id).maybeSingle();
      let boatName: string | null = null;
      if (cruise?.boat_id) {
        const { data: b } = await sb.schema('property' as any).from('boats')
          .select('name').eq('boat_id', cruise.boat_id).maybeSingle();
        boatName = b?.name ?? null;
      }
      const blk = boatCruiseBlock(cruise, boatName);
      if (blk) promptSuffix += `\n\n${blk}`;
    }
    if (whereIdNum && (!kind || kind !== 'facility' || whereIdNum !== whatIdNum)) {
      // Only add WHERE block when it's actually a distinct location (not the same as What).
      const { data: fac } = await sb.schema('property' as any).from('facilities')
        .select('facility_id, name, category, description').eq('facility_id', whereIdNum).eq('property_id', property_id).maybeSingle();
      const blk = whereFacilityBlock(fac);
      if (blk) promptSuffix += `\n\n${blk}`;
    }
  } catch (e) {
    // enrichment failures should not block generation — log via reality_reason downstream if needed.
    // eslint-disable-next-line no-console
    console.error('[ai-generate] enrichment_failed', e);
  }

  const enrichedPrompt = promptSuffix ? `${prompt}${promptSuffix}` : prompt;

  try {
    const { data, error } = await sb.functions.invoke('generate-media', {
      body: {
        property_id, mode, prompt: enrichedPrompt, target_tier,
        source_asset_id: source_asset_id ?? null,
        category_key: String(category_key).trim(),
        // Backward-compat legacy IDs (edge fn uses these to enrich room + facility blocks).
        room_type_id: room_type_id ? Number(room_type_id) : (kind === 'room' && whatIdNum ? whatIdNum : null),
        facility_id:  facility_id  ? Number(facility_id)  : ((kind === 'facility' || kind === 'meeting_space') && whatIdNum ? whatIdNum : null),
        n:            Math.max(1, Math.min(4, Number(body?.n ?? 1))),
      },
    });

    if (error) {
      let bodyText = '';
      const anyErr = error as any;
      if (anyErr?.context?.text) { try { bodyText = await anyErr.context.text(); } catch {} }
      let parsed: any = null;
      try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch { /* ignore */ }
      const msg = (parsed?.error) ?? (anyErr?.message ?? String(error));
      if (/OPENAI_IMAGE_KEY/i.test(msg) || /openai_key_missing/i.test(msg)) {
        return NextResponse.json({ error: 'openai_key_missing_in_vault', reason: parsed?.reason ?? null }, { status: 503 });
      }
      return NextResponse.json({
        error: msg,
        reason: parsed?.reason ?? null,
        generation_id: parsed?.generation_id ?? null,
      }, { status: 502 });
    }

    if (data && typeof data === 'object' && (data as any).ok === false) {
      const err = String((data as any).error ?? 'edge_fn_returned_ok_false');
      return NextResponse.json({
        error: err,
        reason: (data as any).reason ?? null,
        generation_id: (data as any).generation_id ?? null,
      }, { status: 502 });
    }

    return NextResponse.json(data ?? {});
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  try {
    const { data, error } = await sb.from('v_ai_generations').select('*').eq('id', id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
