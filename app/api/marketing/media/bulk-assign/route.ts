// app/api/marketing/media/bulk-assign/route.ts
// POST { asset_ids: uuid[], kind: 'room'|'facility'|'activity'|'certification'|'contact'|'property_area'|'clear'|'tier'|'delete', ref_id?: number, property_area?: string, tier?: string }
// PBS 2026-07-14 · #203 — mass-assign / tier / delete on selected photos.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSIGN_KINDS = new Set(['room','facility','activity','certification','contact','property_area','clear']);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ids: unknown = body?.asset_ids;
  const kind: string = String(body?.kind ?? '');
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'asset_ids_required' }, { status: 400 });
  const cleanIds = ids.filter((x: unknown) => typeof x === 'string' && UUID_RE.test(x)) as string[];
  if (cleanIds.length === 0) return NextResponse.json({ error: 'no_valid_uuids' }, { status: 400 });

  const sb = getSupabaseAdmin();

  if (kind === 'tier') {
    const tier = String(body?.tier ?? '');
    const { data, error } = await sb.rpc('fn_media_bulk_set_tier', { p_asset_ids: cleanIds, p_tier: tier });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (kind === 'delete') {
    const { data, error } = await sb.rpc('fn_media_bulk_soft_delete', { p_asset_ids: cleanIds });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (!ASSIGN_KINDS.has(kind)) return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });

  const args: Record<string, unknown> = { p_asset_ids: cleanIds, p_kind: kind };
  if (kind === 'property_area') args.p_property_area = String(body?.property_area ?? '');
  else if (kind !== 'clear') args.p_ref_id = Number(body?.ref_id ?? 0) || null;

  const { data, error } = await sb.rpc('fn_media_bulk_assign_area', args);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
