// app/api/marketing/media/clarify-assign/route.ts
// PBS 2026-07-17 · media-pipeline-frontend brief · SCOPE 3 — one-shot
// endpoint used by ClarifyTab inline dropdown. Routes to the correct
// public.fn_* RPC based on the taxonomy row `kind`:
//   destination → public.fn_place_destination(asset_id, folder_slug)
//   else        → public.fn_assign_area(asset_id, kind_singular, ref_id)
// Bulk mode (asset_ids[] instead of asset_id) → public.fn_bulk_clarify.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KIND_SINGULAR: Record<string, string> = {
  rooms: 'room',
  facilities: 'facility',
  activities: 'activity',
  certifications: 'certification',
  team: 'contact',
  contacts: 'contact',
  // PBS 2026-07-19 · taxonomy exposes these as their own top-level groups but the
  // underlying storage is still property.facilities / content.activities_catalog.
  // Map to their canonical singular so fn_assign_area writes the right FK column.
  jungle_spa: 'facility',
  fnb: 'facility',
  transport: 'facility',
  imekong: 'facility',
  retreats: 'activity',
};

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  let body: {
    asset_id?: string;
    asset_ids?: string[];
    kind?: string;       // rooms|facilities|activities|certifications|team|destination
    ref_id?: string | number | null;  // taxonomy ref_id OR destination folder slug
    area_key?: string | null;         // fallback: for destination when ref_id missing
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const kindRaw = (body.kind ?? '').toLowerCase();
  if (!kindRaw) return NextResponse.json({ error: 'kind required' }, { status: 400 });

  // Virtual-folder path — anything the DB's fn_manage_virtual_folders knows how
  // to unpack: destination:X · facility:X · facility:X:Y · boat:X · cruise:X ·
  // plus bare destination slugs from the destination kind.
  // PBS 2026-07-19 · imekong/fnb/jungle_spa/transport rows carry non-numeric ref_ids
  // (boat:1, cruise:1, facility:1, facility:1:food). Routing them through the
  // virtual-folder RPC fixes 'unsupported kind' + 'ref_id required (numeric)'.
  const areaKey = typeof body.area_key === 'string' ? body.area_key.trim() : '';
  const refIdStr = String(body.ref_id ?? '').trim();
  const looksVirtual = /^(destination|facility|boat|cruise):/.test(areaKey) || /^(destination|facility|boat|cruise):/.test(refIdStr);
  if (kindRaw === 'destination' || looksVirtual) {
    const id = body.asset_id;
    if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'asset_id must be UUID' }, { status: 400 });
    const folder = areaKey || refIdStr;
    if (!folder) return NextResponse.json({ error: 'destination folder slug required' }, { status: 400 });
    const { data, error } = await sb.rpc('fn_place_destination', { p_asset_id: id, p_folder: folder });
    if (error) return NextResponse.json({ error: 'place_failed', detail: error.message }, { status: 500 });
    const r = (data as { ok?: boolean; error?: string } | null) ?? null;
    if (!r || !r.ok) return NextResponse.json({ error: r?.error ?? 'place_failed', folder }, { status: 400 });
    return NextResponse.json(r);
  }

  const kindSing = KIND_SINGULAR[kindRaw];
  if (!kindSing) return NextResponse.json({ error: 'unsupported kind: ' + kindRaw }, { status: 400 });
  const refId = body.ref_id != null ? Number(body.ref_id) : NaN;
  if (!Number.isFinite(refId) || refId <= 0) return NextResponse.json({ error: 'ref_id required (numeric)' }, { status: 400 });

  // Bulk path
  if (Array.isArray(body.asset_ids) && body.asset_ids.length > 0) {
    for (const a of body.asset_ids) {
      if (!UUID_RE.test(String(a))) return NextResponse.json({ error: 'each asset_id must be UUID' }, { status: 400 });
    }
    const { data, error } = await sb.rpc('fn_bulk_clarify', {
      p_asset_ids: body.asset_ids, p_kind: kindSing, p_ref_id: refId,
    });
    if (error) return NextResponse.json({ error: 'bulk_failed', detail: error.message }, { status: 500 });
    const r = (data as { ok?: boolean; error?: string } | null) ?? null;
    if (!r || !r.ok) return NextResponse.json({ error: r?.error ?? 'bulk_failed' }, { status: 400 });
    return NextResponse.json(r);
  }

  // Single asset path
  const id = body.asset_id;
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'asset_id must be UUID (or provide asset_ids)' }, { status: 400 });
  const { data, error } = await sb.rpc('fn_assign_area', {
    p_asset_id: id, p_kind: kindSing, p_ref_id: refId,
  });
  if (error) return NextResponse.json({ error: 'assign_failed', detail: error.message }, { status: 500 });
  const r = (data as { ok?: boolean; error?: string } | null) ?? null;
  if (!r || !r.ok) return NextResponse.json({ error: r?.error ?? 'assign_failed' }, { status: 400 });
  return NextResponse.json(r);
}