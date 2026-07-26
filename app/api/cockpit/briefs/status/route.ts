// app/api/cockpit/briefs/status/route.ts
// PBS 2026-07-26 (bug #83) — status change action for briefs cockpit.
// Calls fn_set_build_brief_status via service role (cockpit schema write-path law).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  const { slug, status } = (await req.json()) as { slug: string; status: string };
  if (!slug || !status) return NextResponse.json({ error: 'slug + status required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('fn_set_build_brief_status', {
    p_slug: slug, p_status: status, p_commit: null, p_updated_by: 'pbs',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
