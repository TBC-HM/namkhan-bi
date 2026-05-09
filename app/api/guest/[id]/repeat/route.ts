// app/api/guest/[id]/repeat/route.ts
// PBS 2026-05-09 (PR repair-list batch — guest directory wiring, JOB 2):
//   Toggle the `is_repeat` boolean on `public.guests` for the given guest_id.
//   The materialized view `guest.mv_guest_profile` is refreshed nightly so the
//   UI flips optimistically; persistence is real but the matview won't reflect
//   the new value until the next refresh tick (or a manual REFRESH MATERIALIZED
//   VIEW). Caller passes either { is_repeat: boolean } to set explicitly, or
//   nothing to toggle whatever the current value is.
//
// Verified columns (see CLAUDE.md / Supabase information_schema query
// 2026-05-09): public.guests has is_repeat boolean DEFAULT false NULLABLE.
// No new column required.
//
// Why service-role: the dashboard is password-gated, not user-auth, and
// public.guests has restrictive RLS for anon. Same pattern as
// app/api/bookmarks/route.ts.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guestId = params.id;
  if (!guestId) {
    return NextResponse.json({ ok: false, error: 'missing guest id' }, { status: 400 });
  }

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }

  // Optional explicit value; otherwise toggle.
  let body: { is_repeat?: boolean } = {};
  try { body = await req.json(); } catch { /* fine, no body */ }

  let next: boolean;
  if (typeof body.is_repeat === 'boolean') {
    next = body.is_repeat;
  } else {
    const { data: row, error: readErr } = await admin
      .from('guests')
      .select('is_repeat')
      .eq('guest_id', guestId)
      .maybeSingle();
    if (readErr) {
      return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ ok: false, error: 'guest not found' }, { status: 404 });
    }
    next = !row.is_repeat;
  }

  const { data, error } = await admin
    .from('guests')
    .update({ is_repeat: next, updated_at: new Date().toISOString() })
    .eq('guest_id', guestId)
    .select('guest_id, is_repeat')
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Best-effort matview refresh so the directory list reflects the new value
  // without waiting for the nightly cron. RPC verified 2026-05-09:
  //   guest.refresh_guest_profile  (SECURITY DEFINER, refreshes
  //   guest.mv_guest_profile concurrently). Never fails the request on this.
  try {
    await admin.schema('guest').rpc('refresh_guest_profile');
  } catch { /* matview refresh is best-effort */ }

  return NextResponse.json({ ok: true, guest_id: data.guest_id, is_repeat: data.is_repeat });
}
