// app/api/sop/[sop_code]/docx/route.ts
// PBS 2026-07-11 pm: SOP .doc download. Returns a Word-compatible HTML payload with
// application/msword Content-Type + Content-Disposition attachment so Word/Docs/Pages
// open it natively. Same HTML shape as the preview page (single source of truth in
// lib/sop-docx.ts) so what the user sees on-screen is what they get in the doc.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildSopHtml, docFilename, type SopDocRow, type SopMetaRow } from '@/lib/sop-docx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ sop_code: string }> }) {
  try {
    const { sop_code } = await params;
    const code = String(sop_code || '').trim();
    if (!code) return NextResponse.json({ error: 'sop_code required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data: row, error } = await sb
      .from('v_sop_catalog')
      .select('sop_code, title, dept_code, short_summary, body_md, version, author, sop_date, status, primary_audience, property_id, created_at, updated_at')
      .eq('sop_code', code)
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'lookup failed: ' + error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'SOP not found' }, { status: 404 });

    const docRow = row as unknown as SopDocRow;
    // sop_meta lives in the non-PostgREST schema `knowledge`; we deliberately skip it
    // here — the preview page also treats it as best-effort. Once a bridge view is
    // added, wire it in without changing the html builder API.
    const meta: SopMetaRow | null = null;

    const html = buildSopHtml(docRow, meta, { forDownload: true });
    const filename = docFilename(docRow);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'application/msword; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
