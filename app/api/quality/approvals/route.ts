// app/api/quality/approvals/route.ts
// PBS 2026-09-15 · the QA approvals workbench API.
// Two queues, one motion — both were counted on the dashboard and neither had a surface:
//   coverage suggestions : atom <-> existing SOP, proposed by embedding (288 open at Namkhan)
//   SOP proposals        : new SOPs that should exist (332 accepted, 11 written)
// GET   ?pid=&dept=            -> { coverage, proposals }
// POST  { kind:'coverage', atom_id, sop_code, verdict:'confirm'|'reject', note? }
// PATCH { kind:'proposal', id, verdict:'accept'|'archive'|'reprioritise', priority?, note? }
// All four RPCs already existed in the database; this route only exposes them.
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pid(req: NextRequest): number | null {
  const raw = req.nextUrl.searchParams.get('pid');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const propertyId = pid(req);
  if (propertyId === null) {
    return NextResponse.json({ ok: false, error: 'pid required — scope fails closed' }, { status: 400 });
  }
  const dept = req.nextUrl.searchParams.get('dept') || null;
  const sb = getSupabaseAdmin();

  const [cov, prop] = await Promise.all([
    sb.rpc('fn_standards_suggestion_queue', { p_property_id: propertyId, p_dept: dept, p_limit: 200 }),
    sb.rpc('fn_sop_proposal_queue', { p_property_id: propertyId, p_status: 'accepted', p_dept: dept, p_limit: 300 }),
  ]);

  return NextResponse.json({
    ok: true,
    coverage: cov.data ?? [],
    coverageError: cov.error?.message ?? null,
    proposals: prop.data ?? [],
    proposalsError: prop.error?.message ?? null,
  });
}

export async function POST(req: NextRequest) {
  let body: { atom_id?: string; sop_code?: string; verdict?: string; note?: string; pid?: number } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const { atom_id, sop_code, verdict } = body;
  const propertyId = body.pid ?? pid(req);

  if (!atom_id || !sop_code || !verdict || propertyId == null) {
    return NextResponse.json({ ok: false, error: 'atom_id, sop_code, verdict and pid required' }, { status: 400 });
  }
  if (verdict !== 'confirm' && verdict !== 'reject') {
    return NextResponse.json({ ok: false, error: 'verdict must be confirm or reject' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_standards_suggestion_decide', {
    p_atom_id: atom_id, p_sop_code: sop_code, p_property_id: propertyId,
    p_verdict: verdict, p_note: body.note ?? null, p_decided_by: 'PBS',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}

export async function PATCH(req: NextRequest) {
  let body: { id?: number; verdict?: string; priority?: number; note?: string; pid?: number } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const { id, verdict } = body;
  const propertyId = body.pid ?? pid(req);

  if (!id || !verdict || propertyId == null) {
    return NextResponse.json({ ok: false, error: 'id, verdict and pid required' }, { status: 400 });
  }
  if (!['accept', 'archive', 'reprioritise'].includes(verdict)) {
    return NextResponse.json({ ok: false, error: 'verdict must be accept, archive or reprioritise' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_sop_proposal_decide', {
    p_id: id, p_property_id: propertyId, p_verdict: verdict,
    p_priority: body.priority ?? null, p_note: body.note ?? null, p_decided_by: 'PBS',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}
