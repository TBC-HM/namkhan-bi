// POST /api/settings/upsert
// Upserts one row into a marketing-schema settings table.
//
// Auth model (v1): the dashboard is password-gated upstream and uses mock auth.
// We service-role through this endpoint (same pattern as /api/marketing/upload),
// because client-side anon writes are blocked by RLS on every settings table.
//
// Body shape:
//   { section: string, table: string, pk: string, row: Record<string, unknown> }
//
// Validates section is one of the 15 known sections, sanitizes the row to drop
// audit columns (created_at, updated_at, updated_by) so the trigger sets them.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SECTION_TO_TABLE } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPPED_COLS = new Set(['created_at', 'updated_at', 'updated_by']);

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { section, table, pk, row } = body ?? {};
  if (!section || !table || !pk || !row || typeof row !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields: section, table, pk, row' },
      { status: 400 },
    );
  }

  const cfg = SECTION_TO_TABLE[section];
  if (!cfg) {
    return NextResponse.json({ ok: false, error: `Unknown section: ${section}` }, { status: 400 });
  }
  if (cfg.table !== table || cfg.pk !== pk) {
    return NextResponse.json(
      { ok: false, error: `Section ${section} table/pk mismatch` },
      { status: 400 },
    );
  }

  // Sanitize: strip audit cols (server trigger handles them).
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRIPPED_COLS.has(k)) continue;
    clean[k] = v;
  }

  // For tables with property_id, force the canonical id (defense-in-depth).
  if (cfg.hasPropertyId) {
    clean['property_id'] = 260955;
  }

  // For new rows in multi-row tables, drop a null PK so the DB can generate it.
  if (cfg.multiRow && (clean[pk] == null || clean[pk] === '')) {
    delete clean[pk];
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'admin client unavailable' }, { status: 500 });
  }

  const sb = admin.schema('marketing').from(table);

  // Distinguish insert vs upsert: if PK is present, upsert on the PK conflict.
  // For single-row property tables (pk = property_id), always upsert on property_id.
  let queryRes;
  if (cfg.multiRow && (!(pk in clean) || clean[pk] == null)) {
    queryRes = await sb.insert(clean).select('*').single();
  } else {
    queryRes = await sb.upsert(clean, { onConflict: pk }).select('*').single();
  }

  if (queryRes.error) {
    return NextResponse.json(
      { ok: false, error: queryRes.error.message, code: queryRes.error.code },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, row: queryRes.data });
}
