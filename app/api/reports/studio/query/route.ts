// app/api/reports/studio/query/route.ts
// Spreadsheet Studio v1 — run a template definition against a whitelisted
// gold view. Read path: public.fn_studio_query (SECURITY DEFINER, view +
// column + operator whitelists enforced in SQL). Shaping (group/aggregate/
// computed) happens server-side in TypeScript — no raw SQL surface exists.

import { NextResponse } from 'next/server';
import { shapeRows, columnOrder } from '@/lib/studio/engine';
import { sanitizeDefinition, fetchStudioRows } from '@/lib/studio/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const def = sanitizeDefinition((body as Record<string, unknown>)?.definition ?? body);
  if (!def) return NextResponse.json({ error: 'invalid definition' }, { status: 400 });

  try {
    const raw = await fetchStudioRows(def);
    const rows = shapeRows(raw, def);
    return NextResponse.json({
      rows,
      columns: columnOrder(rows),
      row_count: rows.length,
      source_view: `${def.schema}.${def.view}`,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'query failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
