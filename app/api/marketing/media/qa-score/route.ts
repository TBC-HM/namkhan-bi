// app/api/marketing/media/qa-score/route.ts
// Iris skill handler: score_asset.
// POST { asset_id, force_rescore?: boolean }
// - Looks up asset in v_marketing_media_page.
// - If already scored and !force_rescore → returns current scores.
// - Else invokes edge fn media-qa-score.
// - Records cap_skill_calls row (agent inferred from property_id).
// PBS 2026-07-14 — Media QA v2.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IRIS_ROLE_NAMKHAN = 'mkt_qa_photo';
const IRIS_ROLE_DONNA   = 'mkt_qa_photo_donna';
const NAMKHAN_PID = 260955;

function roleForProperty(pid: number | null | undefined): string {
  return pid === 1000001 ? IRIS_ROLE_DONNA : IRIS_ROLE_NAMKHAN;
}

async function recordCall(admin: any, opts: {
  role: string;
  skill_name: string;
  input: any;
  output: any;
  success: boolean;
  error?: string;
  cost_usd_milli: number;
  duration_ms: number;
}) {
  try {
    await admin.from('cap_skill_calls').insert({
      role: opts.role,
      skill_name: opts.skill_name,
      input: opts.input,
      output: opts.output,
      error: opts.error ?? null,
      status: opts.success ? 'ok' : 'error',
      duration_ms: opts.duration_ms,
      cost_usd_milli: opts.cost_usd_milli,
      completed_at: new Date().toISOString(),
    });
  } catch { /* skill log is best-effort */ }
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const asset_id: string | undefined = body?.asset_id;
  const force = Boolean(body?.force_rescore);
  if (!asset_id || !UUID_RE.test(asset_id)) {
    return NextResponse.json({ ok: false, error: 'asset_id must be a UUID' }, { status: 400 });
  }

  const { data: asset, error: aErr } = await admin
    .from('v_marketing_media_page')
    .select('asset_id, property_id, asset_type, technical_score, aesthetic_score, marketing_score, quality_index, qa_scored_at, qa_notes, qa_model, detected_text, primary_tier')
    .eq('asset_id', asset_id)
    .maybeSingle();
  if (aErr || !asset) {
    return NextResponse.json({ ok: false, error: 'asset_not_found', detail: aErr?.message }, { status: 404 });
  }
  if (asset.asset_type !== 'photo') {
    return NextResponse.json({ ok: false, error: 'not_a_photo', asset_type: asset.asset_type }, { status: 400 });
  }

  const role = roleForProperty(asset.property_id);

  // Short-circuit if already scored + not forced.
  if (asset.qa_scored_at && !force) {
    const output = {
      cached: true,
      technical_score: asset.technical_score,
      aesthetic_score: asset.aesthetic_score,
      marketing_score: asset.marketing_score,
      quality_index: asset.quality_index,
      qa_scored_at: asset.qa_scored_at,
      qa_model: asset.qa_model,
      primary_tier: asset.primary_tier,
    };
    await recordCall(admin, { role, skill_name: 'score_asset', input: { asset_id, force_rescore: false }, output, success: true, cost_usd_milli: 0, duration_ms: Date.now() - t0 });
    return NextResponse.json({ ok: true, data: output });
  }

  const { data, error } = await admin.functions.invoke('media-qa-score', { body: { asset_id } });
  const success = !error && !(data as any)?.error;
  const output = data ?? { error: error?.message };
  await recordCall(admin, {
    role,
    skill_name: 'score_asset',
    input: { asset_id, force_rescore: force },
    output,
    success,
    error: success ? undefined : (error?.message ?? (data as any)?.error ?? 'unknown'),
    cost_usd_milli: 15,
    duration_ms: Date.now() - t0,
  });
  if (!success) {
    return NextResponse.json({ ok: false, error: 'qa_score_failed', detail: output }, { status: 502 });
  }
  return NextResponse.json({ ok: true, data: output });
}
