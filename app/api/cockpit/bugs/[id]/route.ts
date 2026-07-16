// app/api/cockpit/bugs/[id]/route.ts
// PBS 2026-07-16 — lifecycle transitions for a bug row. PATCH ?id=<id> with
// { action: 'acknowledge' | 'start' | 'done' | 'dismiss' } sets the matching
// timestamp column + updates status. Body remains editable via notes-only PATCH.
//
// Admin gate — anyone can REPORT a bug (via the widget), only admins can move it
// through the lifecycle.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

async function isAdmin(): Promise<boolean> {
  try {
    const jar = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })), setAll: () => {} } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const role = (user.app_metadata?.holding_role ?? user.user_metadata?.holding_role) as string | undefined;
    return role === 'owner' || role === 'admin';
  } catch { return false; }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
  return NextResponse.json({ ok: true, row: data }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
