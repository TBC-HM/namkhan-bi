// app/api/brain/review/route.ts
// BRAIN v1 · review-queue endpoints.
//   GET  ?pid=<property_id> → { status, queue, missing, battery } scoped to that brain.
//          pid=0   → Holding brain (dms.documents WHERE property_id IS NULL)
//          pid=n   → Tenant brain  (dms.documents WHERE property_id = n)
//          no pid  → all three brains combined
//   POST → { doc_id, doc_kind, sensitivity, note? } → fn_brain_review_confirm.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { BRAIN_DOC_KINDS, BRAIN_TIERS } from '@/lib/brain/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = new Set<string>(BRAIN_DOC_KINDS);
const TIERS = new Set<string>(BRAIN_TIERS);

export async function GET(req: NextRequest) {
  const pidStr = req.nextUrl.searchParams.get('pid');
  const propertyId = pidStr !== null && pidStr !== '' ? parseInt(pidStr, 10) : null;

  const sb = getSupabaseAdmin();
  const [statusRes, queueRes, missingRes, batteryRes] = await Promise.all([
    sb.rpc('fn_brain_pipeline_status', { p_property_id: propertyId }).single(),
    sb.rpc('fn_brain_review_queue', { p_property_id: propertyId }),
    sb.rpc('fn_brain_missing_summary', { p_property_id: propertyId }).single(),
    sb.from('v_brain_battery_recent').select('*').limit(5),
  ]);

  if (statusRes.error) return NextResponse.json({ ok: false, error: statusRes.error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    status: statusRes.data,
    queue: queueRes.data ?? [],
    queueError: queueRes.error?.message ?? null,
    missing: missingRes.data ?? null,
    battery: batteryRes.data ?? [],
  });
}

export async function POST(req: NextRequest) {
  let body: { doc_id?: string; doc_kind?: string; sensitivity?: string; note?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const { doc_id, doc_kind, sensitivity } = body;
  if (!doc_id || !doc_kind || !sensitivity) {
    return NextResponse.json({ ok: false, error: 'doc_id, doc_kind, sensitivity required' }, { status: 400 });
  }
  if (!KINDS.has(doc_kind)) return NextResponse.json({ ok: false, error: 'unknown doc_kind' }, { status: 400 });
  if (!TIERS.has(sensitivity)) return NextResponse.json({ ok: false, error: 'unknown sensitivity' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_brain_review_confirm', {
    p_doc_id: doc_id, p_doc_kind: doc_kind, p_sensitivity: sensitivity, p_note: body.note ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}

// PBS 2026-09-15 · the two dismiss paths. A generic "dismiss" is deliberately NOT offered:
// fn_brain_review_dismiss raises unless the mode says what the dismissal means.
//   not_brain_material → brain_excluded = true, gone for good
//   wrong_guess        → proposal cleared, document returns to the classifier queue
export async function PATCH(req: NextRequest) {
  let body: { doc_id?: string; mode?: string; note?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const { doc_id, mode } = body;
  if (!doc_id || !mode) {
    return NextResponse.json({ ok: false, error: 'doc_id and mode required' }, { status: 400 });
  }
  if (mode !== 'not_brain_material' && mode !== 'wrong_guess') {
    return NextResponse.json({ ok: false, error: 'mode must be not_brain_material or wrong_guess' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_brain_review_dismiss', {
    p_doc_id: doc_id, p_mode: mode, p_note: body.note ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}
