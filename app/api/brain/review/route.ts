// app/api/brain/review/route.ts
// BRAIN v1 · review-queue endpoints for /holding/it/brain.
//   GET  → { status, queue }  (pipeline tiles + needs_human rows)
//   POST → { doc_id, doc_kind, sensitivity, note? } → fn_brain_review_confirm.
// Confirm sets classification_status='human_confirmed'; newly-included docs are
// picked up by the classify worker's chunk stage on its next pass.
// Session-gated by middleware like every /api/* route; DB via service role.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { BRAIN_DOC_KINDS, BRAIN_TIERS } from '@/lib/brain/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = new Set<string>(BRAIN_DOC_KINDS);
const TIERS = new Set<string>(BRAIN_TIERS);

export async function GET() {
  const sb = getSupabaseAdmin();
  const [statusRes, queueRes] = await Promise.all([
    sb.from('v_brain_pipeline_status').select('*').single(),
    sb.from('v_brain_review_queue').select('*').limit(200),
  ]);
  if (statusRes.error) return NextResponse.json({ ok: false, error: statusRes.error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    status: statusRes.data,
    queue: queueRes.data ?? [],
    queueError: queueRes.error?.message ?? null,
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
