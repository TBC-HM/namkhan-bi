// POST /api/standards/load-slh
// Parses the stored SLH inspection body into standards.requirements.
// Deterministic and idempotent — no AI, no cost, safe to re-run.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { parseSlhInspection } from '@/lib/standards/slhParser';
import { deptForSection, categoryForSection } from '@/lib/standards/deptMap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOURCE_KEY = 'slh_mystery_2026';

export async function POST() {
  const admin = getSupabaseAdmin();

  // standards.* is not exposed to PostgREST — go through the public bridges.
  const { data: srcJson, error: srcErr } = await admin.rpc('fn_standards_source', { p_source_key: SOURCE_KEY });
  const src = srcJson as { source_id: string; doc_id: string } | null;
  if (srcErr || !src) {
    return NextResponse.json({ ok: false, error: `source ${SOURCE_KEY} not seeded` }, { status: 400 });
  }

  // dms IS exposed, so this one can use schema() directly.
  const { data: doc, error: docErr } = await admin.schema('dms')
    .from('documents').select('extracted_md').eq('doc_id', src.doc_id).single();
  if (docErr || !doc?.extracted_md) {
    return NextResponse.json({ ok: false, error: 'source document has no extracted_md' }, { status: 400 });
  }

  const parsed = parseSlhInspection(doc.extracted_md);
  const rows = parsed.map((r) => {
    const d = deptForSection(r.subsection ? `${r.section} - ${r.subsection}` : r.section);
    return {
      section: r.section,
      subsection: r.subsection,
      question_no: r.question_no,
      text: r.text,
      weight: r.missed ? 1 : null,
      dept_code: d.dept_code,
      dept_code_2: d.dept_code_2,
      category: categoryForSection(r.subsection ?? r.section),
      verdict_2026: r.verdict,
    };
  });

  const { data: res, error: insErr } = await admin.rpc('fn_standards_load_requirements', {
    p_source_key: SOURCE_KEY, p_rows: rows,
  });
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  const inserted = (res as any)?.inserted ?? 0;

  return NextResponse.json({
    ok: true, source_key: SOURCE_KEY,
    parsed: parsed.length, inserted, skipped: parsed.length - inserted,
  });
}
