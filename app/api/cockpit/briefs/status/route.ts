// app/api/cockpit/briefs/status/route.ts
// PBS 2026-07-26 (bug #83) — status change action for briefs cockpit.
// Calls fn_set_build_brief_status via service role (cockpit schema write-path law).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  const { slug, status } = (await req.json()) as { slug: string; status: string };
  if (!slug || !status) return NextResponse.json({ error: 'slug + status required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  // FIX 2026-07-27: parameter names must match the function signature
  // (p_shipped_commit / p_actor) — the old p_commit/p_updated_by silently
  // failed EVERY status click since this route shipped (bug #89 root cause).
  const { error } = await sb.rpc('fn_set_build_brief_status', {
    p_slug: slug, p_status: status, p_shipped_commit: null, p_actor: 'pbs',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
