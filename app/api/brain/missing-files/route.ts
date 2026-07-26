// app/api/brain/missing-files/route.ts
// BRAIN v5 (autospec-brain_module-20260725 · D4b): CSV export of registry rows
// whose file is missing or terminally unreadable (no_source /
// storage_object_missing / empty_file / terminal OCR failure), so PBS can
// chase re-uploads deliberately. Registry honesty: rows are never deleted —
// this is the actionable surface for them.
//
// GET → text/csv download. Session-gated by middleware like every /api/* route.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_brain_missing_files')
    .select('*')
    .limit(5000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const cols = ['file_name', 'title', 'project', 'dms_doc_type', 'doc_kind', 'entity', 'missing_reason', 'storage_bucket', 'created_at', 'doc_id'];
  const header = cols.join(',');
  const body = rows.map(r => cols.map(c => csvCell(r[c])).join(',')).join('\n');
  const csv = header + '\n' + body + '\n';

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="brain-missing-files-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}