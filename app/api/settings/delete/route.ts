// POST /api/settings/delete
// Deletes one row from a settings table by PK.
// Single-row sections (property_profile, booking_policies) reject deletion.
//
// 2026-09-09 (L22/ADR-281): was unauthenticated and deleted by PK alone, so a
// caller could remove another tenant's row by guessing an id. Tenant-scoped
// sections now verify access and add .eq('property_id', <verified>) to the
// delete. Sections whose live table was dropped fail loudly instead of
// returning a raw Postgres 42P01.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';
import { SECTION_TO_TABLE } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { section, table, pk, id } = body ?? {};
  if (!section || !table || !pk || id == null) {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields: section, table, pk, id' },
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
  if (!cfg.multiRow) {
    return NextResponse.json(
      { ok: false, error: `Section ${section} is single-row — cannot delete` },
      { status: 400 },
    );
  }
  if (cfg.missing) {
    return NextResponse.json(
      { ok: false, error: `Section ${section} has no live table (${cfg.schema ?? 'marketing'}.${cfg.table} was dropped).` },
      { status: 501 },
    );
  }

  let verifiedPropertyId: number | null = null;
  if (cfg.hasPropertyId) {
    try {
      verifiedPropertyId = await requirePropertyAccess(req, body.property_id);
    } catch (e) {
      if (e instanceof Response) return e;
      return NextResponse.json({ ok: false, error: 'authorization_check_failed' }, { status: 403 });
    }
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'admin client unavailable' }, { status: 500 });
  }

  let del = admin.schema(cfg.schema ?? 'marketing').from(table).delete().eq(pk, id);
  if (verifiedPropertyId != null) del = del.eq('property_id', verifiedPropertyId);
  const { error } = await del;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
