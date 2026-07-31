// app/api/reports/studio/export/route.ts
// Spreadsheet Studio v1 — export a shaped result as .xlsx with the TBC
// header + footer stamp (source view · generated-at · data-as-of) so every
// exported number is reproducible from the named source view (brief A3).
// Workbook construction lives in lib/studio/xlsxBuild.ts (shared with the
// scheduled-exports cron). Each export is registered in reports.workbooks
// via public.fn_studio_register_workbook (§9.2 registry).

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sanitizeDefinition, fetchStudioRows } from '@/lib/studio/server';
import { buildStudioWorkbook } from '@/lib/studio/xlsxBuild';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const def = sanitizeDefinition(body?.definition ?? body);
  if (!def) return NextResponse.json({ error: 'invalid definition' }, { status: 400 });

  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : 'Studio export';
  const propertyId = Number(body.property_id) || null;
  const templateId = typeof body.template_id === 'string' ? body.template_id : null;
  const templateVersion = Number(body.template_version) || null;

  try {
    const rawRows = await fetchStudioRows(def);
    const built = buildStudioWorkbook(def, rawRows, { title, propertyId });

    // ── register in the workbook registry (best-effort; export still ships on failure)
    let workbookId: string | null = null;
    try {
      const { data, error } = await supabase.rpc('fn_studio_register_workbook', {
        p_scope: propertyId ? 'property' : 'holding',
        p_property_id: propertyId,
        p_type: 'xlsx_export',
        p_owner: 'studio',
        p_source_modules: [built.sourceView],
        p_template_id: templateId,
        p_template_version: templateVersion,
        p_snapshot: { title, definition: def, row_count: built.rowCount, generated_at: built.generatedAt },
        p_data_timestamp: built.dataAsOf,
      });
      if (!error) workbookId = (data as string) ?? null;
    } catch {
      // registry is metadata; the export itself already validated
    }

    return new NextResponse(new Uint8Array(built.buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${built.safeName}-${built.generatedAt.slice(0, 10)}.xlsx"`,
        'X-Workbook-Id': workbookId ?? '',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'export failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
