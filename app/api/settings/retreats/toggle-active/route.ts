// POST /api/settings/retreats/toggle-active
// Toggles content.retreat_programs.is_active for one retreat, so a retreat can
// be pulled from the newsletter loop and the public settings UI without
// deleting it — same effect PBS used manually via SQL on 2026-08-17, now a button.
// Service-role write (same pattern as /api/settings/upsert): client-side anon
// writes are blocked by RLS, and content.* isn't in the SECTION_TO_TABLE
// marketing-schema whitelist that route uses, so this gets its own tiny route.
//
// Body: { retreat_id: number, property_id: number, is_active: boolean }
// property_id is required and checked against the row server-side so a bad
// or tampered client can't flip another tenant's retreat.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { retreat_id, property_id, is_active } = body ?? {};
  if (retreat_id == null || property_id == null || typeof is_active !== 'boolean') {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields: retreat_id, property_id, is_active' },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'admin client unavailable' }, { status: 500 });
  }

  const res = await admin
    .schema('content')
    .from('retreat_programs')
    .update({ is_active })
    .eq('retreat_id', retreat_id)
    .eq('property_id', property_id)
    .select('retreat_id, is_active')
    .single();

  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message, code: res.error.code }, { status: 400 });
  }

  return NextResponse.json({ ok: true, row: res.data });
}
