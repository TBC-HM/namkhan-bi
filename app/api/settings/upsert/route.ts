// POST /api/settings/upsert
// Upserts one row into a settings table (marketing schema, or property for the
// sections that declare schema: 'property').
//
// Auth model (2026-09-09, L22/ADR-281): this endpoint used to be unauthenticated
// AND to overwrite every row's property_id with the literal 260955 — so a Donna
// user's save silently landed on Namkhan, and the tenant scope was decorative.
// Tenant-scoped sections now resolve the property from the request
// (body.property_id, else row.property_id), verify it with requirePropertyAccess()
// and write the VERIFIED value. Sections whose table has no property_id column
// (retreat_pricing) keep the previous behaviour — there is nothing to scope by.
//
// Write shape (2026-09-09): 10 of the 12 live targets are auto-updatable VIEWS,
// and Postgres cannot do INSERT .. ON CONFLICT against a view (no unique index to
// infer) — so the old .upsert() raised 42P10 on every EDIT while adds worked.
// We now UPDATE by pk (scoped by property_id) and INSERT only when nothing matched.
//
// Body shape:
//   { section: string, table: string, pk: string, row: Record<string, unknown>,
//     property_id?: number }
//
// Validates section is one of the known sections, sanitizes the row to drop
// audit columns (created_at, updated_at, updated_by) so the trigger sets them.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';
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
  if (cfg.missing) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `Section ${section} has no live table (${cfg.schema ?? 'marketing'}.${cfg.table} was dropped). ` +
          `This editor is disconnected — the data is read from property.* and needs an owner decision before it can be edited here.`,
      },
      { status: 501 },
    );
  }

  // L22: verify the caller may write this tenant, and use the VERIFIED id.
  let verifiedPropertyId: number | null = null;
  if (cfg.hasPropertyId) {
    const raw = body.property_id ?? (row as Record<string, unknown>).property_id;
    try {
      verifiedPropertyId = await requirePropertyAccess(req, raw as number | string | null | undefined);
    } catch (e) {
      if (e instanceof Response) return e;
      return NextResponse.json({ ok: false, error: 'authorization_check_failed' }, { status: 403 });
    }
  }

  // Sanitize: strip audit cols (server trigger handles them).
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRIPPED_COLS.has(k)) continue;
    clean[k] = v;
  }
  if (verifiedPropertyId != null) clean['property_id'] = verifiedPropertyId;

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

  const schema = cfg.schema ?? 'marketing';
  const from = () => admin.schema(schema).from(table);

  const pkValue = clean[pk];
  let queryRes;
  if (pkValue == null || pkValue === '') {
    queryRes = await from().insert(clean).select('*').single();
  } else {
    // UPDATE first — always scoped by the verified tenant so a shared pk
    // (e.g. data_integrations.slug, unique per property) cannot cross tenants.
    let upd = from().update(clean).eq(pk, pkValue);
    if (verifiedPropertyId != null) upd = upd.eq('property_id', verifiedPropertyId);
    const updRes = await upd.select('*');
    if (updRes.error) {
      return NextResponse.json(
        { ok: false, error: updRes.error.message, code: updRes.error.code },
        { status: 400 },
      );
    }
    queryRes = (updRes.data ?? []).length
      ? { data: updRes.data![0], error: null }
      : await from().insert(clean).select('*').single();
  }

  if (queryRes.error) {
    return NextResponse.json(
      { ok: false, error: queryRes.error.message, code: queryRes.error.code },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, row: queryRes.data });
}
