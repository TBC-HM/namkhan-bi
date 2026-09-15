// app/api/sales/library/route.ts
// PBS 2026-09-15 · sales document library API — the Marketing · Docs pattern applied to Sales.
// GET    ?pid=&shelf=   -> { shelves, assets }
// DELETE { pid, doc_id, reason? } -> dismiss: hide from THIS surface only
// PATCH  { pid, doc_id }          -> restore a dismissed document
//
// Reads public.fn_sales_shelves / fn_sales_assets. Those admit documents by what the document IS
// (folder + filename), not by doc_type — sales material is spread across legal 660, partner 484,
// financial 415, vendor_doc, other and compliance, so a doc_type filter reaches almost none of it.
//
// TENANCY: every handler resolves the property through requirePropertyAccess() before touching
// data. `pid` from the query string or body is UNTRUSTED until that returns — middleware does NOT
// protect /api/*, and getSupabaseAdmin() is service-role, so it bypasses RLS. No defaults: a
// missing or unauthorised pid fails closed, never falls back to a constant.
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function verifiedPid(
  req: NextRequest,
  body?: { pid?: number },
): Promise<{ pid: number } | { fail: Response }> {
  const raw = body?.pid ?? req.nextUrl.searchParams.get('pid');
  try {
    return { pid: await requirePropertyAccess(req, raw) };
  } catch (err) {
    if (err instanceof Response) return { fail: err };
    return { fail: NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 }) };
  }
}

export async function GET(req: NextRequest) {
  const v = await verifiedPid(req);
  if ('fail' in v) return v.fail;
  const shelf = req.nextUrl.searchParams.get('shelf');
  const sb = getSupabaseAdmin();

  const [sh, as] = await Promise.all([
    sb.rpc('fn_sales_shelves', { p_property_id: v.pid }),
    sb.rpc('fn_sales_assets', { p_property_id: v.pid, p_shelf: shelf, p_limit: 2000 }),
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
  const v = await verifiedPid(req, body);
  if ('fail' in v) return v.fail;
  if (!body.doc_id) {
    return NextResponse.json({ ok: false, error: 'doc_id required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_marketing_dismiss', {
    p_doc_id: body.doc_id, p_property_id: v.pid, p_reason: body.reason ?? null, p_by: 'PBS',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}

export async function PATCH(req: NextRequest) {
  let body: { pid?: number; doc_id?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }
  const v = await verifiedPid(req, body);
  if ('fail' in v) return v.fail;
  if (!body.doc_id) {
    return NextResponse.json({ ok: false, error: 'doc_id required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_marketing_restore', { p_doc_id: body.doc_id, p_property_id: v.pid });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}
