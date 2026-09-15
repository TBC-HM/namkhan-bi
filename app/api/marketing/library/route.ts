// app/api/marketing/library/route.ts
// PBS 2026-09-15 · marketing asset library API.
// GET    ?pid=&shelf=   -> { shelves, assets }
// DELETE { pid, doc_id, reason? } -> dismiss: hide from THIS surface only
// PATCH  { pid, doc_id }          -> restore a dismissed document
// Dismiss is deliberately not archive and not brain_excluded — the document stays in the register
// and stays answerable; the owner simply does not want it in the library.
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pidOf(req: NextRequest, body?: { pid?: number }): number | null {
  const raw = body?.pid ?? req.nextUrl.searchParams.get('pid');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const pid = pidOf(req);
  if (pid === null) return NextResponse.json({ ok: false, error: 'pid required' }, { status: 400 });
  const shelf = req.nextUrl.searchParams.get('shelf');
  const sb = getSupabaseAdmin();

  const [sh, as] = await Promise.all([
    sb.rpc('fn_marketing_shelves', { p_property_id: pid }),
    sb.rpc('fn_marketing_assets', { p_property_id: pid, p_shelf: shelf, p_limit: 1000 }),
  ]);
  return NextResponse.json({
    ok: true,
    shelves: sh.data ?? [], shelvesError: sh.error?.message ?? null,
    assets: as.data ?? [],  assetsError: as.error?.message ?? null,
  });
}

export async function DELETE(req: NextRequest) {
  let body: { pid?: number; doc_id?: string; reason?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const pid = pidOf(req, body);
  if (pid === null || !body.doc_id) {
    return NextResponse.json({ ok: false, error: 'pid and doc_id required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_marketing_dismiss', {
    p_doc_id: body.doc_id, p_property_id: pid, p_reason: body.reason ?? null, p_by: 'PBS',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}

export async function PATCH(req: NextRequest) {
  let body: { pid?: number; doc_id?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const pid = pidOf(req, body);
  if (pid === null || !body.doc_id) {
    return NextResponse.json({ ok: false, error: 'pid and doc_id required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_marketing_restore', { p_doc_id: body.doc_id, p_property_id: pid });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}
