// app/api/marketing/media/qa-score-batch/route.ts
// Iris skill handler: score_batch.
// POST { limit?: 50, tier?: string, force_rescore?: boolean }  (cap 200)
// Fanout in chunks of 4 to media-qa-score edge fn.
// Returns { scored, avg_quality_index, fails_by_rule }.
// PBS 2026-07-14 — Media QA v2.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CHUNK = 4;
const IRIS_ROLE_NAMKHAN = 'mkt_qa_photo';
const IRIS_ROLE_DONNA   = 'mkt_qa_photo_donna';

function roleForProperty(pid: number | null | undefined): string {
  return pid === 1000001 ? IRIS_ROLE_DONNA : IRIS_ROLE_NAMKHAN;
}

async function log(admin: any, o: { role: string; skill: string; status: 'ok'|'error'; duration_ms: number; cost_milli: number; input: any; output: any }) {
  try { await admin.rpc('fn_log_skill_call', { p_role: o.role, p_skill: o.skill, p_status: o.status, p_duration_ms: o.duration_ms, p_cost_milli: o.cost_milli, p_input: o.input, p_output: o.output }); } catch {}
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: any = {};
  try { body = await req.json().catch(() => ({})); } catch {}

  const limit = Math.max(1, Math.min(200, Number(body?.limit ?? 50)));
  const force = Boolean(body?.force_rescore);
  const tier: string | null = body?.tier ?? null; // accepted for compatibility; the queue view defines eligibility

  // L22 — property_id is required. This route previously selected across EVERY
  // tenant and then applied roleForProperty(items[0].property_id) to the whole
  // batch, so a mixed batch scored Donna's photos with Namkhan's agent.
  const property_id = Number(body?.property_id);
  if (!Number.isFinite(property_id) || property_id <= 0) {
    return NextResponse.json({ ok: false, error: 'property_scope_required' }, { status: 400 });
  }

  // Scoring costs real money per asset, so the eligible set is defined once, in
  // public.v_media_qa_score_queue (skip_reason IS NULL AND quality_index IS NULL).
  // That excludes zero-byte files, assets with no object in storage, mimes the
  // scorer cannot read, sub-20KB web sprites and logos — 472 assets at Donna.
  // Never re-derive that predicate here; extend the view.
  let items: any[] = [];
  if (force) {
    // Forced re-score still respects the prefilter: an asset that cannot be
    // scored does not become scoreable because someone passed force.
    let q = admin.from('v_media_qa_prefilter')
      .select('asset_id, property_id')
      .eq('property_id', property_id)
      .is('skip_reason', null)
      .limit(limit);
    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: 'list_failed', detail: error.message }, { status: 500 });
    items = data ?? [];
  } else {
    const { data, error } = await admin.from('v_media_qa_score_queue')
      .select('asset_id, property_id')
      .eq('property_id', property_id)
      .limit(limit);
    if (error) return NextResponse.json({ ok: false, error: 'list_failed', detail: error.message }, { status: 500 });
    items = data ?? [];
  }

  if (items.length === 0) return NextResponse.json({ ok: true, data: { scored: 0, avg_quality_index: null, fails_by_rule: {}, note: 'queue empty for this property' } });

  const role = roleForProperty(property_id);
  const results: any[] = [];

  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    const batch = await Promise.all(slice.map(async (r: any) => {
      const { data, error } = await admin.functions.invoke('media-qa-score', { body: { asset_id: r.asset_id } });
      if (error || (data as any)?.error) return { asset_id: r.asset_id, ok: false, error: error?.message ?? (data as any)?.error, result: data };
      return { asset_id: r.asset_id, ok: true, result: data };
    }));
    for (const b of batch) results.push(b);
  }

  const scored_ok = results.filter(r => r.ok);
  const scores = scored_ok.map(r => Number(r.result?.quality_index ?? 0)).filter(n => !Number.isNaN(n));
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null;

  const fails: Record<string, number> = {};
  for (const r of scored_ok) {
    const naming = r.result?.naming_convention;
    if (naming && naming.matched === false) fails['naming'] = (fails['naming'] ?? 0) + 1;
    if (r.result?.is_hotel_property === false) fails['non_hotel'] = (fails['non_hotel'] ?? 0) + 1;
  }
  for (const r of results.filter(x => !x.ok)) {
    fails['errors'] = (fails['errors'] ?? 0) + 1;
  }

  // Real spend, summed from what media-qa-score actually metered (v11+).
  // Every scored asset returns cost_usd priced by public.fn_meter_ai_call from
  // costs.price_book_rates; the authoritative row is already in ai_token_meter.
  // This previously read `cost_milli: scored_ok.length * 15` — a flat
  // $0.015/asset invention that ran ~5.4x under the real ~$0.081.
  let cost_usd = 0;
  let tokens_in = 0;
  let tokens_out = 0;
  let unmetered = 0;
  for (const r of scored_ok) {
    const c = Number(r.result?.cost_usd);
    if (Number.isFinite(c)) cost_usd += c; else unmetered += 1;
    tokens_in  += Number(r.result?.tokens?.input  ?? 0);
    tokens_out += Number(r.result?.tokens?.output ?? 0);
  }
  cost_usd = Math.round(cost_usd * 1e6) / 1e6;

  const output = {
    scored: scored_ok.length, attempted: results.length, avg_quality_index: avg,
    fails_by_rule: fails, cost_usd, tokens_in, tokens_out,
    // >0 means those assets ran on a pre-v11 engine that reported no usage.
    unmetered_assets: unmetered,
  };
  await log(admin, {
    role, skill: 'score_batch', status: 'ok', duration_ms: Date.now() - t0,
    cost_milli: Math.round(cost_usd * 1000),
    input: { limit, tier, force_rescore: force }, output,
  });
  return NextResponse.json({ ok: true, data: output });
}
