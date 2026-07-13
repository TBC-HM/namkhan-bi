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
  const tier: string | null = body?.tier ?? null;

  let q = admin.from('v_marketing_media_page')
    .select('asset_id, property_id, primary_tier, qa_scored_at')
    .eq('asset_type', 'photo')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!force) q = q.is('qa_scored_at', null);
  if (tier)   q = q.eq('primary_tier', tier);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: 'list_failed', detail: error.message }, { status: 500 });

  const items = rows ?? [];
  if (items.length === 0) return NextResponse.json({ ok: true, data: { scored: 0, avg_quality_index: null, fails_by_rule: {} } });

  const role = roleForProperty(items[0].property_id);
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

  const output = { scored: scored_ok.length, attempted: results.length, avg_quality_index: avg, fails_by_rule: fails };
  await log(admin, { role, skill: 'score_batch', status: 'ok', duration_ms: Date.now() - t0, cost_milli: scored_ok.length * 15, input: { limit, tier, force_rescore: force }, output });
  return NextResponse.json({ ok: true, data: output });
}
