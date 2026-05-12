// app/api/cockpit/messages/route.ts
// Intake #16 (2026-05-12) — messages box for the dept-entry pages.
//
// GET: returns unseen + last-50-seen messages from cockpit.exec_notifications
//      (via the public.cockpit_notifications view).
// POST { id, action: 'ack' } : sets seen_at + seen_by so the row disappears
//      from the "unseen" filter.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  // Public view aliases cockpit.exec_notifications
  const { data, error } = await admin
    .from('cockpit_notifications')
    .select('id, created_at, kind, title, url, ticket_id, pr_number, branch, metadata, seen_at, seen_by')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  return NextResponse.json({
    ok: true,
    unseen: rows.filter((r) => !r.seen_at),
    recent_acked: rows.filter((r) => !!r.seen_at).slice(0, 10),
  });
}

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: { id?: number; action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 }); }
  if (!body.id || typeof body.id !== 'number') {
    return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  }
  if (body.action !== 'ack') {
    return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
  }

  const { error } = await admin
    .schema('cockpit').from('exec_notifications')
    .update({ seen_at: new Date().toISOString(), seen_by: 'PBS' })
    .eq('id', body.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: body.id });
}
