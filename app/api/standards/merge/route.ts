// POST /api/standards/merge
// Collapses standards.requirements into standards.atoms (department-scoped,
// normalised) and records every citation. Deterministic, idempotent, no AI.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { atomKeyFor } from '@/lib/standards/atomKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const admin = getSupabaseAdmin();

  // Read the requirements through the public bridge view.
  const { data: reqs, error } = await admin
    .from('v_standards_requirements')
    .select('requirement_id, text, dept_code, dept_code_2, category, section');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const byKey = new Map<string, any>();
  for (const r of reqs ?? []) {
    const key = atomKeyFor(r.dept_code, r.text);
    const existing = byKey.get(key);
    if (existing) { existing.requirement_ids.push(r.requirement_id); continue; }
    byKey.set(key, {
      atom_key: key,
      dept_code: r.dept_code,
      dept_code_2: r.dept_code_2,
      title: r.text.slice(0, 200),
      requirement_text: r.text,
      category: r.category,
      requirement_ids: [r.requirement_id],
    });
  }

  // One transactional call: atoms + citations together.
  const { data: merged, error: mErr } = await admin.rpc('fn_standards_merge_atoms', {
    p_rows: [...byKey.values()],
  });
  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });

  // fn_standards_merge_atoms is ON CONFLICT DO NOTHING, so atoms_total/citations_total
  // are table-wide totals AFTER the upsert, not deltas — a re-run that creates nothing
  // still reports the full totals, and that's correct (a no-op re-run, not new rows).
  return NextResponse.json({
    ok: true,
    atoms_submitted: byKey.size,
    atoms_total: (merged as any)?.atoms ?? 0,
    citations_total: (merged as any)?.citations ?? 0,
  });
}
