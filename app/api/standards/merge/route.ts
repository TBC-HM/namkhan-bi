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

  // Read the requirements through the public bridge view, PAGED.
  //
  // A single unpaginated .select() silently truncates. PostgREST caps this project at
  // 1,000 rows: probed live on 2026-09-10, the bare request returns
  //   HTTP 206  Content-Range: 0-999/1880
  // so the merge would have built the corpus from 1,000 of 1,880 requirements — 47%
  // dropped, in arbitrary order, with no error anywhere. The live corpus is intact
  // (1,880 citations, 0 orphaned) only because it was built through SQL/RPC and this
  // route never ran against the full set. It was a loaded gun, not a wound.
  //
  // Paging alone is not the fix. The failure mode that matters is SILENCE, so the
  // exact count is fetched with the first page and reconciled below: a short read now
  // fails loudly instead of quietly merging a partial standard.
  const PAGE = 1000;
  const reqs: any[] = [];
  let expected: number | null = null;

  for (let from = 0; ; from += PAGE) {
    const q = admin
      .from('v_standards_requirements')
      .select('requirement_id, text, dept_code, dept_code_2, category, section',
              from === 0 ? { count: 'exact' } : {})
      .order('requirement_id', { ascending: true })   // stable paging; without it rows can repeat or vanish between pages
      .range(from, from + PAGE - 1);

    const { data, error, count } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (from === 0 && typeof count === 'number') expected = count;

    const page = data ?? [];
    reqs.push(...page);
    if (page.length < PAGE) break;
  }

  // Refuse to build a partial standard. Merging 1,000 of 1,880 requirements produces a
  // corpus that looks healthy and is missing almost half its obligations.
  if (expected !== null && reqs.length !== expected) {
    return NextResponse.json({
      ok: false,
      error: `truncated read: got ${reqs.length} of ${expected} requirements — refusing to merge a partial corpus`,
    }, { status: 500 });
  }

  const byKey = new Map<string, any>();
  for (const r of reqs) {
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
    requirements_read: reqs.length,
    atoms_submitted: byKey.size,
    atoms_total: (merged as any)?.atoms ?? 0,
    citations_total: (merged as any)?.citations ?? 0,
  });
}
