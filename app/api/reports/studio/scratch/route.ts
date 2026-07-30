// app/api/reports/studio/scratch/route.ts
// Spreadsheet Studio r2 — from-scratch sheets (brief §10.3) + workbook registry list.
// A scratch sheet is a plain value grid: created blank, edited in the Studio,
// snapshot-on-save into reports.workbooks (type=custom_scratch) via
// public.fn_studio_save_scratch. No formulas, no metric writes — canon values
// always come from gold views through the builder, never from scratch grids.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { StudioScratchSnapshot, StudioWorkbookRow } from '@/lib/studio/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_COLS = 40;
const MAX_ROWS = 500;
const MAX_CELL = 500;

function sanitizeSnapshot(raw: unknown): StudioScratchSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const name = typeof s.name === 'string' ? s.name.trim().slice(0, 120) : '';
  if (!name) return null;
  const cols = Array.isArray(s.cols)
    ? s.cols.slice(0, MAX_COLS).map((c) => String(c ?? '').slice(0, 80))
    : [];
  if (cols.length === 0) return null;
  const rows = Array.isArray(s.rows)
    ? s.rows
        .slice(0, MAX_ROWS)
        .filter((r): r is unknown[] => Array.isArray(r))
        .map((r) => r.slice(0, cols.length).map((c) => String(c ?? '').slice(0, MAX_CELL)))
    : [];
  return { name, cols, rows };
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // ?id=<uuid> → one scratch workbook incl. snapshot (bridge view omits snapshot)
  const id = url.searchParams.get('id');
  if (id) {
    const { data, error } = await supabase.rpc('fn_studio_get_scratch', { p_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'scratch workbook not found' }, { status: 404 });
    return NextResponse.json({ workbook: data });
  }

  // workbook registry list (all types — Workbooks panel)
  const scope = url.searchParams.get('scope');
  const propertyId = Number(url.searchParams.get('property_id')) || null;
  let query = supabase
    .from('v_studio_workbooks')
    .select(
      'id, scope, property_id, sheet_id, url, type, owner, source_modules, template_id, template_version, status, access_classification, parent_workbook_id, derived_by, derived_at, last_refresh, data_timestamp, created_at, display_name',
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(200);
  if (scope === 'holding') query = query.eq('scope', 'holding');
  else if (propertyId) query = query.eq('scope', 'property').eq('property_id', propertyId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workbooks: (data ?? []) as StudioWorkbookRow[] });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const snapshot = sanitizeSnapshot(body.snapshot);
  if (!snapshot) {
    return NextResponse.json({ error: 'snapshot with name and at least one column required' }, { status: 400 });
  }

  const workbookId = typeof body.workbook_id === 'string' && body.workbook_id ? body.workbook_id : null;
  const scope = body.scope === 'holding' ? 'holding' : 'property';
  const propertyId = scope === 'property' ? Number(body.property_id) || 0 : null;
  if (scope === 'property' && !workbookId && !propertyId) {
    return NextResponse.json({ error: 'property_id required for property-scope scratch sheets' }, { status: 400 });
  }

  const { data: id, error } = await supabase.rpc('fn_studio_save_scratch', {
    p_workbook_id: workbookId,
    p_scope: scope,
    p_property_id: propertyId,
    p_owner: typeof body.owner === 'string' ? body.owner.slice(0, 60) : 'pbs',
    p_snapshot: snapshot,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id, saved: true });
}
