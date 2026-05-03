// POST /api/settings/delete
// Deletes one row from a marketing-schema settings table by PK.
// Single-row sections (property_profile, booking_policies) reject deletion.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
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

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'admin client unavailable' }, { status: 500 });
  }

  const { error } = await admin.schema('marketing').from(table).delete().eq(pk, id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
