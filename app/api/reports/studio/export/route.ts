// app/api/reports/studio/export/route.ts
// Spreadsheet Studio v1 — export a shaped result as .xlsx with the TBC
// header + footer stamp (source view · generated-at · data-as-of) so every
// exported number is reproducible from the named source view (brief A3).
// Each export is registered in reports.workbooks via
// public.fn_studio_register_workbook (§9.2 registry — the system always
// knows who/why/where-from/how-fresh).

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { shapeRows, columnOrder } from '@/lib/studio/engine';
import { sanitizeDefinition, fetchStudioRows } from '@/lib/studio/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function findDataAsOf(rows: Record<string, unknown>[]): string | null {
  // Best-effort freshness: max value of common date/timestamp columns.
  const candidates = ['updated_at', 'data_timestamp', 'night_date', 'stay_date', 'date', 'month', 'day'];
  let best: string | null = null;
  for (const row of rows) {
    for (const c of candidates) {
      const v = row[c];
      if (typeof v === 'string' && v.length >= 7) {
        if (best === null || v > best) best = v;
      }
    }
  }
  return best;
}

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
  const propertyLabel =
    propertyId === 260955 ? 'The Namkhan' : propertyId === 1000001 ? 'Donna Portals' : 'Holding';
  const templateId = typeof body.template_id === 'string' ? body.template_id : null;
  const templateVersion = Number(body.template_version) || null;

  try {
    const rawRows = await fetchStudioRows(def);
    const rows = shapeRows(rawRows, def);
    const cols = columnOrder(rows);
    const generatedAt = new Date().toISOString();
    const dataAsOf = findDataAsOf(rawRows) ?? generatedAt;
    const sourceView = `${def.schema}.${def.view}`;

    // ── data sheet: TBC header block + column headers + rows + footer stamp
    const aoa: unknown[][] = [
      ['The Beyond Circle — Spreadsheet Studio'],
      [title, propertyLabel],
      [],
      cols,
      ...rows.map((r) => cols.map((c) => (r[c] === undefined ? null : (r[c] as unknown)))),
      [],
      ['Source view', sourceView],
      ['Generated at', generatedAt],
      ['Data as of', dataAsOf],
      ['Rows', rows.length],
      ['Canon note', 'Values are platform-computed from gold views (read-only). Reproduce by opening the named source view.'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = cols.map((c) => ({ wch: Math.min(Math.max(c.length + 2, 12), 40) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // ── source log sheet (workbook standards §9.7)
    const logSheet = XLSX.utils.aoa_to_sheet([
      ['Field', 'Value'],
      ['Title', title],
      ['Property', propertyLabel],
      ['Source view', sourceView],
      ['Columns', def.columns.length ? def.columns.join(', ') : 'all'],
      ['Filters', JSON.stringify(def.filters)],
      ['Group by', def.groupBy.join(', ') || '—'],
      ['Aggregations', def.aggregations.map((a) => `${a.fn}(${a.col})`).join(', ') || '—'],
      ['Computed columns', def.computed.map((c) => `${c.name} = ${c.expr}`).join('; ') || '—'],
      ['Generated at', generatedAt],
      ['Data as of', dataAsOf],
    ]);
    logSheet['!cols'] = [{ wch: 20 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, logSheet, 'Source Log');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    // ── register in the workbook registry (best-effort; export still ships on failure)
    let workbookId: string | null = null;
    try {
      const { data, error } = await supabase.rpc('fn_studio_register_workbook', {
        p_scope: propertyId ? 'property' : 'holding',
        p_property_id: propertyId,
        p_type: 'xlsx_export',
        p_owner: 'studio',
        p_source_modules: [sourceView],
        p_template_id: templateId,
        p_template_version: templateVersion,
        p_snapshot: { title, definition: def, row_count: rows.length, generated_at: generatedAt },
        p_data_timestamp: dataAsOf,
      });
      if (!error) workbookId = (data as string) ?? null;
    } catch {
      // registry is metadata; the export itself already validated
    }

    const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'studio-export';
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeName}-${generatedAt.slice(0, 10)}.xlsx"`,
        'X-Workbook-Id': workbookId ?? '',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'export failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
