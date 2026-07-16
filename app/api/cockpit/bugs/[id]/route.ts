// app/api/cockpit/bugs/[id]/route.ts
// PBS 2026-07-16 — lifecycle transitions for a bug row. PATCH ?id=<id> with
// { action: 'acknowledge' | 'start' | 'done' | 'dismiss', notes?: string }.
// DELETE removes the row entirely.
//
// PBS 2026-07-17 — auth loosened to "any signed-in user". Bugs aren't PII and
// the widget was already open to everyone signed-in; the CTAs should be too.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

async function isSignedIn(): Promise<boolean> {
  try {
    const jar = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })), setAll: () => {} } },
    );
    const { data: { user } } = await sb.auth.getUser();
    return !!user?.id;
  } catch { return false; }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const signedIn = await isSignedIn();
  if (!signedIn) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; notes?: string };
  const action = body.action;

  const patch: Record<string, string | null> = { updated_at: new Date().toISOString() };
  switch (action) {
    case 'acknowledge': patch.acked_at = new Date().toISOString(); patch.status = 'acknowledged'; break;
    case 'start':       patch.started_at = new Date().toISOString(); patch.status = 'in_progress'; break;
    case 'done':        patch.done_at = new Date().toISOString(); patch.status = 'done'; break;
    case 'dismiss':     patch.status = 'dismissed'; break;
    default:
      if (typeof body.notes === 'string') patch.notes = body.notes;
      else return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('cockpit_bugs')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const signedIn = await isSignedIn();
  if (!signedIn) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('cockpit_bugs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted_id: id }, { headers: { 'Cache-Control': 'no-store' } });
}
