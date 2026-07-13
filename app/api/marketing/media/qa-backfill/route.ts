// app/api/marketing/media/qa-backfill/route.ts
// POST { limit?: 20, offset?: 0, property_id?: 260955 } — fires media-qa-score
// for photos that have never been QA-scored.
//
// Runs invocations in parallel batches of 3 to keep total time reasonable while
// avoiding worker overload. Returns per-asset ok/error result rows.
//
// PBS 2026-07-13 — v1 QA engine backfill route.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_LIMIT = 20;
const CONCURRENCY = 3;
const NAMKHAN_PROPERTY_ID = 260955;

async function invokeQa(admin: any, assetId: string): Promise<{ asset_id: string; ok: boolean; error?: string; result?: any }> {
  try {
    const { data, error } = await admin.functions.invoke('media-qa-score', { body: { asset_id: assetId } });
    if (error) return { asset_id: assetId, ok: false, error: error.message ?? String(error) };
    if ((data as any)?.error) return { asset_id: assetId, ok: false, error: (data as any).error, result: data };
    return { asset_id: assetId, ok: true, result: data };
  } catch (e: any) {
    return { asset_id: assetId, ok: false, error: e.message ?? String(e) };
  }
}

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any = {};
  try { body = await req.json().catch(() => ({})); } catch {}

  const limit = Math.max(1, Math.min(100, Number(body?.limit ?? DEFAULT_LIMIT)));
  const offset = Math.max(0, Number(body?.offset ?? 0));
  const propertyId = Number(body?.property_id ?? NAMKHAN_PROPERTY_ID);

  // Pull unscored photos from the bridge view.
  const { data: rows, error } = await admin
    .from('v_marketing_media_page')
    .select('asset_id, original_filename, asset_type, qa_scored_at')
    .eq('asset_type', 'photo')
    .is('qa_scored_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: 'list_failed', detail: error.message }, { status: 500 });
  }
  const ids = (rows ?? []).map(r => r.asset_id).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, results: [], message: 'no unscored photos remain' });
  }

  // Batch by CONCURRENCY
  const results: Array<{ asset_id: string; ok: boolean; error?: string }> = [];
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const slice = ids.slice(i, i + CONCURRENCY);
    const batch = await Promise.all(slice.map(id => invokeQa(admin, id)));
    for (const r of batch) results.push({ asset_id: r.asset_id, ok: r.ok, error: r.error });
  }

  const ok_count = results.filter(r => r.ok).length;
  return NextResponse.json({
    ok: true,
    scanned: ids.length,
    ok_count,
    error_count: results.length - ok_count,
    property_id: propertyId,
    results,
  });
}
